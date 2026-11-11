import { useMemo, useState } from 'react'
import { Eye, Flame, Lightbulb, RotateCcw, Sparkles, CheckCircle2 } from 'lucide-react'
import { invoke, runAi } from '@/lib/api'
import { useApp } from '@/store/app'
import { Button } from './ui'
import Monaco from './Monaco'
import { Markdown } from './Markdown'

interface BF { title: string; lang: string; broken: string; hints: string[]; solution: string; explain: string }
const norm = (s: string) => s.replace(/#.*$/gm, '').replace(/\s+/g, ' ').trim()

/** "Buzib o'rgan" — buzilgan konfiguratsiyani Monaco da tuzatish, ishoralar va AI maslahati */
export default function BreakFix({ raw, context }: { raw: string; context?: string }) {
  const bf = useMemo<BF | null>(() => { try { const d = JSON.parse(raw); return d.broken && d.solution ? { hints: [], explain: '', lang: 'yaml', title: 'Topshiriq', ...d } : null } catch { return null } }, [raw])
  const [code, setCode] = useState(bf?.broken ?? '')
  const [hints, setHints] = useState(0)
  const [show, setShow] = useState(false)
  const [ai, setAi] = useState('')
  const [busy, setBusy] = useState(false)
  const [state, setState] = useState<'idle' | 'ok' | 'no'>('idle')
  const { toast, refreshStats, ctx } = useApp()
  if (!bf) return <div className="codeblock"><pre><code>{raw}</code></pre></div>

  const check = async () => {
    const ok = norm(code) === norm(bf.solution)
    setState(ok ? 'ok' : 'no')
    if (ok) { await invoke('event:add', { kind: 'breakfix', ref: `${context ?? ctx.lessonId}:${bf.title}` }); void refreshStats() }
  }
  const askHint = async () => {
    setBusy(true); setAi('')
    try { await runAi({ kind: 'hint', lessonId: ctx.lessonId, section: 'breakfix', text: code, selection: `${bf.title}\n\n${bf.broken}` }, { onChunk: (f) => setAi(f) }).done }
    catch (e: any) { toast({ kind: 'error', title: 'AI ishora bera olmadi', desc: e.message }) }
    setBusy(false)
  }
  return (
    <div className="my-6 overflow-hidden rounded-xl border bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-bad/[.07] px-4 py-2.5">
        <div className="flex items-center gap-2 text-[.95em] font-semibold"><Flame size={16} className="text-bad" /> {bf.title}</div>
        <span className="chip">Xatoni toping va tuzating</span>
      </div>
      <div className="p-3"><Monaco value={code} onChange={(v) => { setCode(v); setState('idle') }} language={bf.lang} height={Math.min(420, Math.max(140, bf.broken.split('\n').length * 21 + 40))} ariaLabel={`${bf.title} — buzilgan konfiguratsiya`} /></div>
      <div className="no-print flex flex-wrap items-center gap-2 px-3 pb-3">
        <Button variant="primary" size="sm" onClick={check}><CheckCircle2 size={14} /> Tekshirish</Button>
        <Button size="sm" disabled={hints >= bf.hints.length} onClick={() => setHints((h) => h + 1)}><Lightbulb size={14} /> Ishora ({hints}/{bf.hints.length})</Button>
        <Button size="sm" disabled={busy} onClick={askHint}><Sparkles size={14} /> {busy ? 'AI o\'ylayapti…' : 'AI maslahati'}</Button>
        <Button variant="ghost" size="sm" onClick={() => { setCode(bf.broken); setState('idle') }}><RotateCcw size={14} /> Boshidan</Button>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setShow((s) => !s)}><Eye size={14} /> {show ? 'Yechimni yashirish' : 'Yechimni ko\'rsatish'}</Button>
      </div>
      {state !== 'idle' && (
        <div role="status" className={`mx-3 mb-3 rounded-lg border px-3 py-2 text-[.92em] ${state === 'ok' ? 'border-ok/40 bg-ok/10 text-ok' : 'border-warn/40 bg-warn/10 text-warn'}`}>
          {state === 'ok' ? '✅ To\'g\'ri! Konfiguratsiya tuzatildi. +20 XP' : 'Hali namunaviy yechimga mos emas. Boshqa to\'g\'ri yechim ham bo\'lishi mumkin — ishoralarni ko\'ring yoki AI maslahatini so\'rang.'}
        </div>
      )}
      {hints > 0 && <ol className="mx-3 mb-3 space-y-1.5">{bf.hints.slice(0, hints).map((h, i) => <li key={i} className="rounded-lg border border-warn/30 bg-warn/[.07] px-3 py-1.5 text-[.92em]"><b className="text-warn">{i + 1}-ishora:</b> {h}</li>)}</ol>}
      {ai && <div className="mx-3 mb-3 rounded-lg border border-accent/30 bg-accent/[.06] px-3 py-1"><Markdown text={ai} streaming={busy} className="!text-[.92em]" /></div>}
      {show && (
        <div className="border-t bg-elev/40 p-3">
          <div className="label mb-2">Namunaviy yechim</div>
          <Monaco value={bf.solution} language={bf.lang} readOnly height={Math.min(380, Math.max(120, bf.solution.split('\n').length * 21 + 40))} />
          {bf.explain && <p className="mt-3 text-[.93em] leading-relaxed"><b>Nega:</b> {bf.explain}</p>}
        </div>
      )}
    </div>
  )
}
