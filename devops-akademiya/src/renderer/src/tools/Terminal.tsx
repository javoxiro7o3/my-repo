import { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { CheckCircle2, Circle, Lightbulb, RotateCcw, ShieldCheck } from 'lucide-react'
import { VShell, SHELL_TASKS } from '@shared/vshell'
import { invoke } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useApp, resolveTheme } from '@/store/app'
import { Button } from '@/components/ui'

const THEMES = {
  dark: { background: '#0b0d17', foreground: '#d7dbf5', cursor: '#8b8ff7', selectionBackground: '#3b3f6e', green: '#4ade80', red: '#f87171', blue: '#7aa2f7', yellow: '#fbbf24', cyan: '#22d3ee' },
  light: { background: '#fbfbfe', foreground: '#1f2340', cursor: '#4f46e5', selectionBackground: '#c7cbf5', green: '#15803d', red: '#b91c1c', blue: '#1d4ed8', yellow: '#a16207', cyan: '#0e7490' },
  terminal: { background: '#050a06', foreground: '#7fe89a', cursor: '#3dfc6b', selectionBackground: '#1f5a30', green: '#3dfc6b', red: '#ff7b6b', blue: '#4dffd2', yellow: '#e8f76a', cyan: '#4dffd2' }
}

export default function Terminal() {
  const el = useRef<HTMLDivElement>(null)
  const sh = useRef(new VShell())
  const term = useRef<XTerm | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())
  const [cur, setCur] = useState(0)
  const [hint, setHint] = useState(false)
  const doneRef = useRef(done); doneRef.current = done
  const theme = useApp((s) => resolveTheme(s.settings?.theme ?? 'dark'))
  const { toast, refreshStats } = useApp()

  useEffect(() => { if (term.current) term.current.options.theme = THEMES[theme] }, [theme])
  useEffect(() => {
    const t = new XTerm({ fontFamily: '"JetBrains Mono", monospace', fontSize: 13.5, lineHeight: 1.25, cursorBlink: true, theme: THEMES[theme], convertEol: true, scrollback: 2000 })
    const fit = new FitAddon(); t.loadAddon(fit); t.open(el.current!); fit.fit(); term.current = t
    const ro = new ResizeObserver(() => { try { fit.fit() } catch { /* yashirin */ } }); ro.observe(el.current!)
    let buf = '', pos = 0, hi = -1, saved = ''
    const prompt = () => { const p = sh.current.prompt(); const [u, rest] = p.split(':'); t.write(`\x1b[1;32m${u}\x1b[0m:\x1b[1;34m${rest.slice(0, -2)}\x1b[0m${rest.slice(-2)}`) }
    const redraw = () => { t.write('\r\x1b[K'); prompt(); t.write(buf); if (pos < buf.length) t.write(`\x1b[${buf.length - pos}D`) }
    t.writeln('\x1b[1mDevOps Akademiya — virtual Linux laboratoriyasi\x1b[0m (Ubuntu 24.04 simulyatsiyasi)')
    t.writeln('\x1b[2mBu terminal haqiqiy tizimingizga tegmaydi. Buyruqlar ro\'yxati: help · tiklash: reset\x1b[0m\n'); prompt()
    const submit = () => {
      t.write('\r\n'); const line = buf; buf = ''; pos = 0; hi = -1
      const r = sh.current.run(line)
      if (r.clear) t.clear()
      if (r.out) t.write(r.out.endsWith('\n') ? r.out : r.out + '\n')
      if (r.err) t.write(`\x1b[31m${r.err.endsWith('\n') ? r.err : r.err + '\n'}\x1b[0m`)
      // Topshiriq tekshiruvchisi (validator)
      for (const task of SHELL_TASKS) if (!doneRef.current.has(task.id)) { let ok = false; try { ok = task.check(sh.current, { line, out: r.out }) } catch { /* tekshiruv xatosi */ } if (ok) { t.writeln(`\x1b[1;32m✔ Topshiriq bajarildi: ${task.title}\x1b[0m`); setDone((d) => new Set(d).add(task.id)); setHint(false); setCur((c) => { const n = SHELL_TASKS.findIndex((x, i) => i > SHELL_TASKS.indexOf(task) && !doneRef.current.has(x.id)); return SHELL_TASKS[c].id === task.id && n >= 0 ? n : c }); void invoke('event:add', { kind: 'lab', ref: `terminal:${task.id}` }).then(() => refreshStats()) } }
      prompt()
    }
    const sub = t.onData((data) => {
      if (data.length > 1 && !data.startsWith('\x1b')) { const clean = data.replace(/[\r\n]+/g, ' '); buf = buf.slice(0, pos) + clean + buf.slice(pos); pos += clean.length; return redraw() } // joylashtirish (paste)
      switch (data) {
        case '\r': return submit()
        case '\x7f': if (pos > 0) { buf = buf.slice(0, pos - 1) + buf.slice(pos); pos--; redraw() } return
        case '\x1b[D': if (pos > 0) { pos--; t.write(data) } return
        case '\x1b[C': if (pos < buf.length) { pos++; t.write(data) } return
        case '\x1b[A': { const h = sh.current.history; if (!h.length) return; if (hi < 0) { saved = buf; hi = h.length } hi = Math.max(0, hi - 1); buf = h[hi]; pos = buf.length; return redraw() }
        case '\x1b[B': { const h = sh.current.history; if (hi < 0) return; hi++; if (hi >= h.length) { hi = -1; buf = saved } else buf = h[hi]; pos = buf.length; return redraw() }
        case '\x1b[H': case '\x01': pos = 0; return redraw()
        case '\x1b[F': case '\x05': pos = buf.length; return redraw()
        case '\x03': t.write('^C\r\n'); buf = ''; pos = 0; return prompt()
        case '\x0c': t.clear(); return redraw()
        case '\x15': buf = buf.slice(pos); pos = 0; return redraw()
        case '\x17': { const left = buf.slice(0, pos).replace(/\S+\s*$/, ''); buf = left + buf.slice(pos); pos = left.length; return redraw() }
        case '\t': { const c = sh.current.complete(buf.slice(0, pos)); if (c.length === 1) { const tok = buf.slice(0, pos).split(/\s+/).pop() ?? ''; const add = c[0].slice(tok.length) + (c[0].endsWith('/') ? '' : ' '); buf = buf.slice(0, pos) + add + buf.slice(pos); pos += add.length; redraw() } else if (c.length > 1) { let pre = c[0]; for (const x of c) while (!x.startsWith(pre)) pre = pre.slice(0, -1); const tok = buf.slice(0, pos).split(/\s+/).pop() ?? ''; if (pre.length > tok.length) { buf = buf.slice(0, pos) + pre.slice(tok.length) + buf.slice(pos); pos += pre.length - tok.length; redraw() } else { t.write('\r\n' + c.map((x) => x.split('/').filter(Boolean).pop() + (x.endsWith('/') ? '/' : '')).join('  ') + '\r\n'); redraw() } } return }
        default: if (data >= ' ' && !data.startsWith('\x1b')) { buf = buf.slice(0, pos) + data + buf.slice(pos); pos += data.length; if (pos === buf.length) t.write(data); else redraw() }
      }
    })
    t.focus()
    return () => { sub.dispose(); ro.disconnect(); t.dispose(); term.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const task = SHELL_TASKS[cur]
  return (
    <div className="grid gap-5 @5xl:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <div ref={el} className="h-[min(68vh,640px)] overflow-hidden rounded-xl border" style={{ background: THEMES[theme].background }} onClick={() => term.current?.focus()} role="application" aria-label="Virtual Linux terminali" />
        <p className="mt-2 flex items-center gap-1.5 text-xs text-faint"><ShieldCheck size={12} className="text-ok" /> Xavfsiz simulyatsiya: virtual fayl tizimi xotirada; real shell ochilmaydi, haqiqiy fayllarga tegilmaydi.</p>
      </div>
      <div className="space-y-4">
        <div className="card p-4">
          <div className="mb-1 flex items-center justify-between"><span className="label">Topshiriq {cur + 1} / {SHELL_TASKS.length}</span><span className="chip">{done.size} bajarildi</span></div>
          <div className="text-[15px] font-semibold">{task.title}</div>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{task.goal}</p>
          {done.has(task.id) ? <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-ok"><CheckCircle2 size={15} /> Bajarildi! +30 XP</p> : hint ? <p className="mt-3 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 font-mono text-[12.5px] text-warn">{task.hint}</p> : <Button size="sm" className="mt-3" onClick={() => setHint(true)}><Lightbulb size={13} /> Ishora</Button>}
        </div>
        <ol className="card max-h-[340px] space-y-0.5 overflow-y-auto p-2">{SHELL_TASKS.map((t, i) => <li key={t.id}><button onClick={() => { setCur(i); setHint(false) }} className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition hover:bg-elev', i === cur && 'bg-accent/14')}>{done.has(t.id) ? <CheckCircle2 size={14} className="shrink-0 text-ok" /> : <Circle size={14} className="shrink-0 text-faint" />}<span className={cn(done.has(t.id) && 'text-muted')}>{t.title}</span></button></li>)}</ol>
        <Button variant="ghost" size="sm" onClick={() => { sh.current.run('reset'); term.current?.clear(); term.current?.write('\r\n\x1b[2mFayl tizimi tiklandi.\x1b[0m\r\n' + sh.current.prompt()); toast({ kind: 'info', title: 'Laboratoriya tiklandi' }) }}><RotateCcw size={13} /> Fayl tizimini tiklash</Button>
      </div>
    </div>
  )
}
