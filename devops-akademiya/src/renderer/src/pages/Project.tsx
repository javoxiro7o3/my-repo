import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, FolderKanban, Sparkles } from 'lucide-react'
import { MODULES } from '@shared/curriculum'
import { invoke, runAi, type AiRun } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useApp } from '@/store/app'
import { Button, Empty, PageHeader, SkeletonText } from '@/components/ui'
import { Markdown } from '@/components/Markdown'

export default function Project() {
  const m = MODULES[Number(useParams().id) - 1]
  const { stats, refreshStats, settings } = useApp()
  const [report, setReport] = useState('')
  const [grade, setGrade] = useState<{ text: string; busy: boolean; err?: string } | null>(null)
  const run = useRef<AiRun | null>(null)
  if (!m || !stats) return <div className="p-10"><Empty icon="🔍" title="Loyiha topilmadi" /></div>
  const done = m.project.tasks.map((_, i) => !!stats.projects[`${m.id}:${i}`])
  const n = done.filter(Boolean).length
  const submit = () => {
    run.current?.cancel(); setGrade({ text: '', busy: true })
    const r = runAi({ kind: 'grade', text: report, selection: `${m.project.title}\n${m.project.brief}\n\nTalablar:\n${m.project.tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}`, pro: true }, { onChunk: (f) => setGrade({ text: f, busy: true }) })
    run.current = r
    r.done.then((x) => setGrade({ text: x.text, busy: false })).catch((e) => setGrade({ text: '', busy: false, err: e.message }))
  }
  return (
    <div className="h-full overflow-y-auto"><div className="mx-auto max-w-4xl p-8">
      <PageHeader icon={<FolderKanban size={22} />} title={`${m.id === 13 ? '🏁 ' : ''}${m.project.title}`} desc={`${m.id}-modul yakuniy loyihasi · ${m.title}`} right={<span className="chip tabular-nums">{n} / {done.length} bajarildi</span>} />
      <p className="mb-5 text-[15px] leading-relaxed text-muted">{m.project.brief}</p>
      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-elev"><motion.div className="h-full rounded-full" style={{ background: m.color }} animate={{ width: `${(n / done.length) * 100}%` }} /></div>
      <ul className="card mb-8 divide-y">
        {m.project.tasks.map((t, i) => (
          <li key={i}><label className="flex cursor-pointer items-start gap-3 px-5 py-3 transition hover:bg-elev/50">
            <input type="checkbox" className="peer sr-only" checked={done[i]} onChange={async (e) => { await invoke('project:toggle', { moduleId: m.id, idx: i, done: e.target.checked }); void refreshStats() }} />
            <motion.span whileTap={{ scale: 0.85 }} className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition peer-focus-visible:ring-2 peer-focus-visible:ring-accent', done[i] ? 'border-ok bg-ok text-bg' : 'border-faint')}>{done[i] && <Check size={13} strokeWidth={3.5} />}</motion.span>
            <span className={cn('text-[14.5px] leading-relaxed', done[i] && 'text-muted line-through decoration-faint')}>{t}</span>
          </label></li>
        ))}
      </ul>
      <h2 className="mb-2 text-lg font-semibold tracking-tight">AI baholash</h2>
      <p className="mb-3 text-sm text-muted">Qilgan ishingizni tasvirlang: arxitektura, asosiy konfiguratsiyalar (sirlarsiz!), tekshiruv buyruqlari natijalari. AI-Ustoz har bir talab bo'yicha baholaydi.</p>
      <textarea value={report} onChange={(e) => setReport(e.target.value)} rows={9} placeholder={'Masalan:\n1. Tarmoq: 10.50.0.0/22 ni ... ga bo\'ldim\n2. Firewall qoidalari:\n   iptables -P INPUT DROP ...\n3. Tekshiruv: curl -I https://... → 200'} className="input resize-y font-mono text-[13px]" aria-label="Loyiha hisoboti" />
      <div className="mt-3 flex items-center gap-3"><Button variant="primary" disabled={report.trim().length < 80 || grade?.busy || !settings?.hasKey} onClick={submit}><Sparkles size={15} /> {grade?.busy ? 'Baholanmoqda…' : 'Baholashga yuborish'}</Button><span className="text-xs text-faint">{settings?.hasKey ? 'Kamida 80 belgi · murakkab model (pro) ishlatiladi' : 'AI baholash uchun API kalit kerak'}</span></div>
      {grade && <div className="card mt-6 p-6">{grade.err ? <p className="text-sm text-bad">{grade.err}</p> : grade.text ? <Markdown text={grade.text} streaming={grade.busy} /> : <SkeletonText />}</div>}
    </div></div>
  )
}
