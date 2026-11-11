import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Bug, FileSearch, GraduationCap, MessagesSquare, Mic, ScanSearch, Siren, Sparkles, Target } from 'lucide-react'
import type { QuizQuestion, Stats } from '@shared/types'
import { LESSONS, lessonById } from '@shared/curriculum'
import { extractJson } from '@shared/geminiCore'
import { invoke, runAi, type AiRun } from '@/lib/api'
import { cn, uid } from '@/lib/utils'
import { useApp } from '@/store/app'
import { Button, Empty, PageHeader, SkeletonText } from '@/components/ui'
import { Markdown } from '@/components/Markdown'
import { ChatView } from '@/components/AiPanel'
import Quiz, { validQuiz } from '@/components/Quiz'
import { LANGS } from '@/components/Monaco'

const Monaco = lazy(() => import('@/components/Monaco'))
const MODES = [
  { id: 'explain', icon: FileSearch, title: 'Buyruqni tushuntir', desc: 'Buyruq, YAML, Dockerfile, Nginx conf yoki Terraform ni qo\'ying — qator-qator tahlil' },
  { id: 'review', icon: ScanSearch, title: 'Kod review', desc: 'Dockerfile / compose / K8s YAML / Terraform yozing — xavfsizlik va best-practice tekshiruvi' },
  { id: 'interview', icon: Mic, title: 'Intervyu simulyatori', desc: 'AI intervyuer savol beradi, javobingizni 0–10 baholaydi' },
  { id: 'incident', icon: Siren, title: 'Debug o\'yini', desc: 'Tasodifiy production incident: log va metrikalardan ildiz sababni toping' },
  { id: 'quiz', icon: Target, title: 'Adaptiv test', desc: 'Zaif joylaringizga qarab yangi savollar' },
  { id: 'sokrat', icon: MessagesSquare, title: 'Sokratik suhbat', desc: 'AI javob bermaydi — savollar bilan o\'zingiz topishingizga yordam beradi' }
] as const

const SAMPLES: Record<string, string> = {
  dockerfile: 'FROM node:latest\nWORKDIR /app\nCOPY . .\nRUN npm install\nENV DB_PASSWORD=supersecret\nEXPOSE 3000\nCMD npm start\n',
  yaml: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: web\n  template:\n    metadata:\n      labels:\n        app: web\n    spec:\n      containers:\n        - name: web\n          image: nginx:latest\n          securityContext:\n            privileged: true\n',
  hcl: 'resource "aws_security_group" "web" {\n  name = "web"\n  ingress {\n    from_port   = 0\n    to_port     = 65535\n    protocol    = "tcp"\n    cidr_blocks = ["0.0.0.0/0"]\n  }\n}\n',
  nginx: 'server {\n    listen 80;\n    server_name example.uz;\n    location / {\n        proxy_pass http://127.0.0.1:8000;\n    }\n}\n',
  shell: 'tar -czvf backup.tar.gz -C /var/www html && rsync -avz --delete backup.tar.gz deploy@10.0.0.5:/backups/\n'
}

function CodeTool({ kind }: { kind: 'explain' | 'review' }) {
  const [lang, setLang] = useState(kind === 'review' ? 'dockerfile' : 'shell')
  const [code, setCode] = useState(SAMPLES[kind === 'review' ? 'dockerfile' : 'shell'])
  const [out, setOut] = useState<{ text: string; busy: boolean; err?: string; cached?: boolean } | null>(null)
  const run = useRef<AiRun | null>(null)
  const { ctx, settings } = useApp()
  useEffect(() => () => run.current?.cancel(), [])
  const go = (force = false) => {
    run.current?.cancel(); setOut({ text: '', busy: true })
    const r = runAi({ kind, text: code, lang, lessonId: ctx.lessonId, force }, { onChunk: (f) => setOut({ text: f, busy: true }) })
    run.current = r
    r.done.then((x) => setOut({ text: x.text, busy: false, cached: x.cached })).catch((e) => setOut({ text: '', busy: false, err: e.message }))
  }
  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-5 @5xl:grid-cols-2">
      <div className="flex min-h-0 flex-col gap-3">
        <div className="flex items-center gap-2">
          <select value={lang} onChange={(e) => { setLang(e.target.value); if (SAMPLES[e.target.value] && Object.values(SAMPLES).includes(code)) setCode(SAMPLES[e.target.value]) }} className="input w-auto" aria-label="Til">{LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select>
          <Button variant="primary" disabled={!code.trim() || out?.busy || !settings?.hasKey} onClick={() => go()} data-testid="run-ai"><Sparkles size={15} /> {out?.busy ? 'Tahlil qilinmoqda…' : kind === 'review' ? 'Review qilish' : 'Tushuntirish'}</Button>
          {out?.cached && <Button size="sm" variant="ghost" onClick={() => go(true)}>Qayta generatsiya</Button>}
          {!settings?.hasKey && <span className="text-xs text-warn">API kalit kerak</span>}
        </div>
        <Suspense fallback={<div className="skeleton h-[420px] rounded-xl" />}><Monaco value={code} onChange={setCode} language={lang} height="min(62vh, 640px)" /></Suspense>
      </div>
      <div className="card min-h-[300px] overflow-y-auto p-5">
        {!out ? <Empty icon={kind === 'review' ? <ScanSearch size={24} /> : <FileSearch size={24} />} title={kind === 'review' ? 'Kodingizni yozing va review ni bosing' : 'Buyruq yoki konfiguratsiyani qo\'ying'} desc={kind === 'review' ? 'Namuna Dockerfile da kamida 5 ta muammo bor — avval o\'zingiz toping, keyin AI bilan solishtiring.' : 'Har bir flag va qator nima qilishi, nega kerakligi va o\'chirilsa nima bo\'lishi tushuntiriladi.'} />
          : out.err ? <Empty icon="⚠️" title="Bajarib bo'lmadi" desc={out.err} /> : out.text ? <Markdown text={out.text} streaming={out.busy} className="!text-[14.5px]" /> : <SkeletonText lines={8} />}
      </div>
    </div>
  )
}

function AdaptiveQuiz() {
  const [weak, setWeak] = useState<Stats['weakTopics']>([])
  const [lessonId, setLessonId] = useState(0)
  const [qs, setQs] = useState<QuizQuestion[] | null>(null)
  const [st, setSt] = useState<{ busy: boolean; chars: number; err?: string }>({ busy: false, chars: 0 })
  const { stats, settings } = useApp()
  useEffect(() => { invoke<Stats['weakTopics']>('quiz:weak').then((w) => { setWeak(w); setLessonId(w[0]?.lessonId ?? stats?.last?.lessonId ?? 2) }) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const gen = async () => {
    setSt({ busy: true, chars: 0 }); setQs(null)
    try {
      const topics = weak.filter((w) => w.lessonId === lessonId).map((w) => `${w.topic} (${w.wrong}/${w.total} xato)`)
      const r = await runAi({ kind: 'quizgen', lessonId, weakTopics: topics }, { onChunk: (f) => setSt({ busy: true, chars: f.length }) }).done
      const v = validQuiz(extractJson(r.text)).map((q) => ({ ...q, id: `ai-${uid()}` }))
      if (!v.length) throw new Error('AI noto\'g\'ri formatda javob qaytardi. Qayta urinib ko\'ring.')
      setQs(v); setSt({ busy: false, chars: 0 })
    } catch (e: any) { setSt({ busy: false, chars: 0, err: e.message }) }
  }
  const lw = weak.filter((w) => w.lessonId === lessonId)
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="card p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1 text-sm"><span className="mb-1.5 block font-medium">Dars</span><select value={lessonId} onChange={(e) => setLessonId(+e.target.value)} className="input">{LESSONS.map((l) => <option key={l.id} value={l.id}>#{l.id} {l.title}{weak.some((w) => w.lessonId === l.id) ? '  ⚠ zaif' : ''}</option>)}</select></label>
          <Button variant="primary" disabled={st.busy || !settings?.hasKey} onClick={gen}><Sparkles size={15} /> {st.busy ? `Tuzilmoqda… (${st.chars})` : 'Yangi savollar yaratish'}</Button>
        </div>
        <div className="mt-3 text-[13px] text-muted">{lw.length ? <>Zaif mavzular: {lw.map((w) => <span key={w.topic} className="chip mr-1.5 !border-bad/40 !text-bad">{w.topic} · {w.wrong}/{w.total}</span>)}</> : 'Bu dars bo\'yicha hali xato qayd etilmagan — savollar darsning barcha mavzularidan tuziladi.'}</div>
        {st.err && <p className="mt-2 text-sm text-bad">{st.err}</p>}
      </div>
      {st.busy && <div className="card p-6"><SkeletonText lines={6} /></div>}
      {qs && <Quiz lessonId={lessonId} questions={qs} title={`Adaptiv test · #${lessonId} ${lessonById(lessonId)?.title}`} />}
      {!qs && !st.busy && <Empty icon={<Target size={24} />} title="Adaptiv test" desc="Mini-testlarda xato qilgan mavzularingiz yozib boriladi. AI aynan o'sha bo'shliqlarni yopadigan yangi savollar tuzadi — natijalar yana statistikaga qo'shiladi." />}
    </div>
  )
}

export default function AiLab() {
  const { mode } = useParams()
  const nav = useNavigate()
  const { ctx, stats, settings } = useApp()
  const [session, setSession] = useState(() => uid())
  const cur = MODES.find((m) => m.id === mode)
  const lessonId = ctx.lessonId ?? stats?.last?.lessonId
  if (!cur) return (
    <div className="h-full overflow-y-auto"><div className="mx-auto max-w-5xl p-8">
      <PageHeader icon={<Sparkles size={22} />} title="AI laboratoriya" desc="AI-Ustoz bilan amaliy mashg'ulotlar" />
      {!settings?.hasKey && <div className="mb-5 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">Bu bo'limdagi funksiyalar uchun Gemini API kaliti kerak. <button className="underline" onClick={() => nav('/settings')}>Sozlamalarda kiritish →</button></div>}
      <div className="grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3">{MODES.map((m) => (
        <button key={m.id} onClick={() => nav(`/ai/${m.id}`)} className="card group p-5 text-left transition hover:-translate-y-0.5 hover:border-accent hover:shadow-glow">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-accent/12 text-accent transition group-hover:scale-110"><m.icon size={22} /></div>
          <div className="text-[15px] font-semibold">{m.title}</div><p className="mt-1 text-[13px] leading-relaxed text-muted">{m.desc}</p>
        </button>
      ))}</div>
    </div></div>
  )
  const chat = cur.id === 'interview' || cur.id === 'incident' || cur.id === 'sokrat'
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b px-6 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/12 text-accent"><cur.icon size={18} /></div>
        <div className="min-w-0 flex-1"><h1 className="text-[17px] font-semibold tracking-tight">{cur.title}</h1><p className="truncate text-xs text-muted">{cur.desc}{chat && lessonId ? ` · mavzu: #${lessonId} ${lessonById(lessonId)?.title}` : ''}</p></div>
        <div className="flex gap-1">{MODES.map((m) => <Button key={m.id} variant={m.id === cur.id ? 'secondary' : 'ghost'} size="iconSm" onClick={() => nav(`/ai/${m.id}`)} aria-label={m.title} title={m.title}><m.icon size={15} /></Button>)}</div>
        {chat && <Button size="sm" onClick={() => setSession(uid())}>{cur.id === 'incident' ? <><Bug size={13} /> Yangi incident</> : <><GraduationCap size={13} /> Yangi sessiya</>}</Button>}
      </div>
      <div className={cn('min-h-0 flex-1', chat ? 'flex' : 'overflow-y-auto p-6')}>
        {cur.id === 'explain' && <CodeTool key="explain" kind="explain" />}
        {cur.id === 'review' && <CodeTool key="review" kind="review" />}
        {cur.id === 'quiz' && <AdaptiveQuiz />}
        {chat && (settings?.hasKey
          ? <ChatView key={`${cur.id}-${session}`} thread={`${cur.id}:${session}`} kind={cur.id === 'sokrat' ? 'chat' : cur.id} lessonId={lessonId} autoStart={cur.id !== 'sokrat'} className="mx-auto w-full max-w-4xl"
              placeholder={cur.id === 'incident' ? 'Buyruq "bajaring" (masalan: kubectl describe pod …) yoki gipotezangizni yozing' : cur.id === 'interview' ? 'Javobingizni yozing… ("yakunla" — xulosa)' : 'Mavzu yoki savolni yozing…'}
              intro={cur.id === 'sokrat' ? <Empty icon={<MessagesSquare size={24} />} title="Sokratik suhbat" desc="Mavzuni yozing (masalan: «Service qanday ishlaydi?»). Pastdagi rejimni «Sokrat» ga o'tkazing — AI javob o'rniga yo'naltiruvchi savollar beradi." /> : undefined} />
          : <div className="m-auto"><Empty icon="🔑" title="API kalit kerak" desc="Bu rejim Gemini API orqali ishlaydi." action={<Button variant="primary" onClick={() => nav('/settings')}>Sozlamalar</Button>} /></div>)}
      </div>
    </div>
  )
}
