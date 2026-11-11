import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, ArrowRight, ArrowUp, Check, RotateCcw, Trophy, X } from 'lucide-react'
import type { QuizQuestion } from '@shared/types'
import { invoke } from '@/lib/api'
import { cn, shuffle } from '@/lib/utils'
import { useApp } from '@/store/app'
import { Button } from './ui'

const TYPE_LABEL: Record<string, string> = { mcq: 'Bitta to\'g\'ri javob', fill: 'Buyruqni to\'ldiring', bug: 'Xatoni toping', order: 'Tartibga soling' }
const normFill = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/^["'`]|["'`]$/g, '')

export function validQuiz(q: unknown): QuizQuestion[] {
  if (!Array.isArray(q)) return []
  return q.filter((x: any) => x && typeof x.q === 'string' && (
    ((x.type === 'mcq' || x.type === 'bug') && Array.isArray(x.options) && x.options.length >= 2 && Number.isInteger(x.answer) && x.answer >= 0 && x.answer < x.options.length) ||
    (x.type === 'fill' && Array.isArray(x.accept) && x.accept.length) || (x.type === 'order' && Array.isArray(x.items) && x.items.length >= 3)
  )).map((x: any, i: number) => ({ ...x, id: String(x.id ?? `q${i + 1}`), topic: String(x.topic ?? 'umumiy'), explain: String(x.explain ?? '') }))
}

export default function Quiz({ lessonId, questions, onFinish, title }: { lessonId: number; questions: QuizQuestion[]; onFinish?: (correct: number, total: number) => void; title?: string }) {
  const [round, setRound] = useState(0)
  const qs = useMemo(() => questions, [questions, round]) // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0)
  const [results, setResults] = useState<boolean[]>([])
  const [picked, setPicked] = useState<number | null>(null)
  const [fill, setFill] = useState('')
  const [order, setOrder] = useState<string[]>([])
  const [checked, setChecked] = useState<boolean | null>(null)
  const refreshStats = useApp((s) => s.refreshStats)
  const q = qs[i]
  const shuffled = useMemo(() => (q?.type === 'order' ? shuffle(q.items!, (i + 1) * 0.137 + round * 0.31) : []), [q, i, round])
  const cur = order.length ? order : shuffled

  if (!qs.length) return null
  if (i >= qs.length) {
    const c = results.filter(Boolean).length, pct = Math.round((c / qs.length) * 100)
    return (
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="card flex flex-col items-center gap-3 p-8 text-center">
        <motion.div initial={{ rotate: -20, scale: 0.5 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 12 }} className={cn('flex h-16 w-16 items-center justify-center rounded-2xl', pct >= 80 ? 'bg-ok/15 text-ok' : pct >= 50 ? 'bg-warn/15 text-warn' : 'bg-bad/15 text-bad')}><Trophy size={30} /></motion.div>
        <div className="text-3xl font-semibold tracking-tight">{c} / {qs.length}</div>
        <p className="max-w-md text-sm text-muted">{pct >= 80 ? 'Ajoyib natija! Mavzuni yaxshi o\'zlashtirgansiz.' : pct >= 50 ? 'Yomon emas. Xato qilingan savollar takrorlash kartalariga qo\'shildi.' : 'Bu mavzuni yana bir ko\'rib chiqish kerak. Xato savollar takrorlash kartalariga qo\'shildi — ertaga qaytaramiz.'}</p>
        <div className="flex gap-1.5">{results.map((r, k) => <span key={k} className={cn('h-2 w-6 rounded-full', r ? 'bg-ok' : 'bg-bad')} />)}</div>
        <Button onClick={() => { setRound((r) => r + 1); setI(0); setResults([]); setPicked(null); setFill(''); setOrder([]); setChecked(null) }}><RotateCcw size={14} /> Qayta yechish</Button>
      </motion.div>
    )
  }

  const check = async () => {
    let ok = false
    if (q.type === 'mcq' || q.type === 'bug') ok = picked === q.answer
    else if (q.type === 'fill') ok = q.accept!.some((a) => normFill(a) === normFill(fill))
    else ok = cur.join('\u0001') === q.items!.join('\u0001')
    setChecked(ok)
    const back = q.type === 'fill' ? `${q.accept![0]} — ${q.explain}` : q.type === 'order' ? `${q.items!.map((x, k) => `${k + 1}. ${x}`).join('\n')}\n\n${q.explain}` : `${q.options![q.answer!]} — ${q.explain}`
    await invoke('quiz:record', { lessonId, answers: [{ questionId: q.id, topic: q.topic, correct: ok, front: q.q + (q.code ? `\n\n${q.code}` : ''), back }] })
  }
  const next = () => {
    const r = [...results, !!checked]
    setResults(r); setPicked(null); setFill(''); setOrder([]); setChecked(null); setI(i + 1)
    if (i + 1 >= qs.length) { onFinish?.(r.filter(Boolean).length, qs.length); void refreshStats() }
  }
  const move = (k: number, d: number) => { const a = [...cur]; const j = k + d; if (j < 0 || j >= a.length) return; [a[k], a[j]] = [a[j], a[k]]; setOrder(a) }
  const canCheck = q.type === 'order' || (q.type === 'fill' ? fill.trim().length > 0 : picked !== null)

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b bg-elev/50 px-5 py-3">
        <div className="text-sm font-medium">{title ?? 'Mini-test'} <span className="text-faint">· {i + 1} / {qs.length}</span></div>
        <div className="flex items-center gap-2"><span className="chip">{TYPE_LABEL[q.type]}</span><span className="chip">{q.topic}</span></div>
      </div>
      <div className="h-1 bg-elev"><motion.div className="h-full bg-accent" animate={{ width: `${(i / qs.length) * 100}%` }} /></div>
      <AnimatePresence mode="wait">
        <motion.div key={`${round}-${i}`} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }} className="p-5">
          <p className="whitespace-pre-wrap text-[1.02em] font-medium leading-relaxed">{q.q}</p>
          {q.code && <div className="codeblock"><pre><code>{q.code}</code></pre></div>}

          {(q.type === 'mcq' || q.type === 'bug') && (
            <div role="radiogroup" aria-label="Javob variantlari" className="mt-4 grid gap-2">
              {q.options!.map((o, k) => {
                const st = checked === null ? (picked === k ? 'sel' : '') : k === q.answer ? 'ok' : picked === k ? 'bad' : ''
                return (
                  <motion.button key={k} role="radio" aria-checked={picked === k} disabled={checked !== null} onClick={() => setPicked(k)}
                    animate={st === 'bad' ? { x: [0, -6, 6, -4, 4, 0] } : st === 'ok' && checked !== null ? { scale: [1, 1.02, 1] } : {}} transition={{ duration: 0.35 }}
                    className={cn('flex items-start gap-3 rounded-lg border px-4 py-2.5 text-left text-[.95em] transition', st === 'sel' && 'border-accent bg-accent/10', st === 'ok' && 'border-ok bg-ok/10', st === 'bad' && 'border-bad bg-bad/10', !st && 'hover:bg-elev')}>
                    <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold', st === 'ok' && 'border-ok bg-ok text-bg', st === 'bad' && 'border-bad bg-bad text-bg', st === 'sel' && 'border-accent bg-accent text-accent-fg')}>{st === 'ok' ? <Check size={12} /> : st === 'bad' ? <X size={12} /> : String.fromCharCode(65 + k)}</span>
                    <span className="whitespace-pre-wrap">{o}</span>
                  </motion.button>
                )
              })}
            </div>
          )}
          {q.type === 'fill' && (
            <div className="mt-4">
              <input autoFocus value={fill} disabled={checked !== null} onChange={(e) => setFill(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && canCheck && checked === null) void check() }} placeholder="Javobingizni yozing…" aria-label="Javob" className={cn('input font-mono', checked === true && 'border-ok', checked === false && 'border-bad')} />
              {checked === false && <p className="mt-2 text-sm">To'g'ri javob: <code className="rounded bg-elev px-1.5 py-0.5 font-mono text-ok">{q.accept![0]}</code></p>}
            </div>
          )}
          {q.type === 'order' && (
            <ol className="mt-4 grid gap-2">
              {cur.map((it, k) => (
                <motion.li layout key={it} className={cn('flex items-center gap-3 rounded-lg border px-3 py-2 text-[.95em]', checked !== null && (it === q.items![k] ? 'border-ok bg-ok/10' : 'border-bad bg-bad/10'))}>
                  <span className="w-5 text-center font-mono text-xs text-faint">{k + 1}</span><span className="flex-1">{it}</span>
                  {checked === null && <span className="flex gap-1"><Button variant="ghost" size="iconSm" onClick={() => move(k, -1)} disabled={k === 0} aria-label="Yuqoriga"><ArrowUp size={14} /></Button><Button variant="ghost" size="iconSm" onClick={() => move(k, 1)} disabled={k === cur.length - 1} aria-label="Pastga"><ArrowDown size={14} /></Button></span>}
                </motion.li>
              ))}
              {checked === false && <p className="text-sm text-muted">To'g'ri tartib: {q.items!.join(' → ')}</p>}
            </ol>
          )}

          <AnimatePresence>
            {checked !== null && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} role="status" className={cn('mt-4 overflow-hidden rounded-lg border-l-[3px] px-4 py-3 text-[.94em] leading-relaxed', checked ? 'border-ok bg-ok/[.08]' : 'border-bad bg-bad/[.08]')}>
                <b className={checked ? 'text-ok' : 'text-bad'}>{checked ? 'To\'g\'ri! +5 XP' : 'Noto\'g\'ri.'}</b> {q.explain}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="mt-5 flex justify-end">
            {checked === null ? <Button variant="primary" disabled={!canCheck} onClick={check}>Tekshirish</Button> : <Button variant="primary" onClick={next} autoFocus>{i + 1 >= qs.length ? 'Natijani ko\'rish' : 'Keyingi savol'} <ArrowRight size={14} /></Button>}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
