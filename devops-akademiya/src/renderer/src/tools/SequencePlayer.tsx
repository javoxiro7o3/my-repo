import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'

export interface SeqStep { from: number; to: number; label: string; detail: string; data?: string; color?: string; note?: boolean }
export interface SeqDef { actors: { name: string; sub?: string; icon?: string }[]; steps: SeqStep[] }

/** Umumiy ketma-ketlik (sequence) animatsiyasi: aktorlar orasida xabarlar qadamma-qadam */
export default function SequencePlayer({ def, height = 56 }: { def: SeqDef; height?: number }) {
  const [i, setI] = useState(0)
  const [play, setPlay] = useState(false)
  useEffect(() => { setI(0); setPlay(false) }, [def])
  useEffect(() => { if (!play) return; if (i >= def.steps.length) { setPlay(false); return } const t = setTimeout(() => setI((x) => x + 1), 1900); return () => clearTimeout(t) }, [play, i, def.steps.length])
  const n = def.actors.length, W = 900, colX = (k: number) => (W / n) * (k + 0.5), H = 70 + def.steps.length * height + 20
  const cur = def.steps[Math.min(i, def.steps.length) - 1]
  return (
    <div className="grid gap-4 @5xl:grid-cols-[1fr_340px]">
      <div className="card overflow-x-auto p-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[640px]" role="img" aria-label="Ketma-ketlik diagrammasi">
          {def.actors.map((a, k) => (
            <g key={k}>
              <line x1={colX(k)} y1={56} x2={colX(k)} y2={H - 8} stroke="hsl(var(--border))" strokeWidth="2" strokeDasharray="4 5" />
              <rect x={colX(k) - 78} y={6} width={156} height={48} rx={12} fill="hsl(var(--elev))" stroke="hsl(var(--border))" />
              <text x={colX(k)} y={a.sub ? 27 : 35} textAnchor="middle" fontSize="14" fontWeight="650" fill="hsl(var(--fg))">{a.icon ? a.icon + ' ' : ''}{a.name}</text>
              {a.sub && <text x={colX(k)} y={44} textAnchor="middle" fontSize="10.5" fill="hsl(var(--faint))">{a.sub}</text>}
            </g>
          ))}
          {def.steps.map((s, k) => {
            const y = 70 + (k + 0.5) * height, x1 = colX(s.from), x2 = colX(s.to), shown = k < i, active = k === i - 1, c = s.color ?? 'hsl(var(--accent))', self = s.from === s.to
            if (!shown) return <g key={k} opacity={0.14}><line x1={x1} y1={y} x2={self ? x1 + 60 : x2} y2={y} stroke="hsl(var(--faint))" strokeWidth="1.5" /><text x={(x1 + (self ? x1 + 120 : x2)) / 2} y={y - 7} textAnchor="middle" fontSize="11" fill="hsl(var(--faint))">{k + 1}</text></g>
            return (
              <g key={k} onClick={() => setI(k + 1)} className="cursor-pointer">
                {self ? <motion.path d={`M${x1} ${y - 10} h46 v20 h-40`} fill="none" stroke={c} strokeWidth={active ? 3 : 2} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5 }} />
                  : <motion.line x1={x1} y1={y} y2={y} stroke={c} strokeWidth={active ? 3 : 2} initial={{ x2: x1 }} animate={{ x2: x2 + (x2 > x1 ? -9 : 9) }} transition={{ duration: 0.55, ease: 'easeOut' }} />}
                <motion.polygon initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }} fill={c} points={self ? `${x1 + 6},${y + 10} ${x1 + 16},${y + 5} ${x1 + 16},${y + 15}` : x2 > x1 ? `${x2 - 1},${y} ${x2 - 11},${y - 5} ${x2 - 11},${y + 5}` : `${x2 + 1},${y} ${x2 + 11},${y - 5} ${x2 + 11},${y + 5}`} />
                <motion.text initial={{ opacity: 0 }} animate={{ opacity: 1 }} x={self ? x1 + 56 : (x1 + x2) / 2} y={self ? y + 4 : y - 8} textAnchor={self ? 'start' : 'middle'} fontSize="12.5" fontWeight={active ? 700 : 500} fill={active ? 'hsl(var(--fg))' : 'hsl(var(--muted))'}>{k + 1}. {s.label}</motion.text>
                {active && !self && <motion.circle r={6} cy={y} fill={c} initial={{ cx: x1 }} animate={{ cx: x2 }} transition={{ duration: 0.55, ease: 'easeOut' }} />}
              </g>
            )
          })}
        </svg>
      </div>
      <div className="space-y-3">
        <div className="card flex items-center gap-1.5 p-2">
          <Button variant="primary" size="sm" onClick={() => { if (i >= def.steps.length) setI(0); setPlay((p) => !p) }}>{play ? <><Pause size={14} /> To'xtatish</> : <><Play size={14} /> Ijro</>}</Button>
          <Button size="icon" onClick={() => { setPlay(false); setI((x) => Math.max(0, x - 1)) }} disabled={i === 0} aria-label="Oldingi qadam"><ChevronLeft size={16} /></Button>
          <Button size="icon" onClick={() => { setPlay(false); setI((x) => Math.min(def.steps.length, x + 1)) }} disabled={i >= def.steps.length} aria-label="Keyingi qadam"><ChevronRight size={16} /></Button>
          <Button variant="ghost" size="icon" onClick={() => { setPlay(false); setI(0) }} aria-label="Boshidan"><RotateCcw size={15} /></Button>
          <span className="ml-auto pr-2 text-xs tabular-nums text-faint">{Math.min(i, def.steps.length)} / {def.steps.length}</span>
        </div>
        <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="card min-h-[220px] p-4" aria-live="polite">
          {cur ? <>
            <div className="label mb-1">{i}-qadam · {def.actors[cur.from].name}{cur.from !== cur.to ? ` → ${def.actors[cur.to].name}` : ''}</div>
            <div className="text-[15px] font-semibold">{cur.label}</div>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{cur.detail}</p>
            {cur.data && <pre className="mt-3 overflow-x-auto rounded-lg border bg-bg p-3 font-mono text-[11.5px] leading-relaxed">{cur.data}</pre>}
          </> : <p className="text-sm leading-relaxed text-muted">«Ijro» ni bosing yoki ▸ bilan qadamma-qadam yuring. Har bir qadamda kim kimga nima yuborishi va nega kerakligi tushuntiriladi.</p>}
        </motion.div>
        <ol className="card max-h-64 space-y-0.5 overflow-y-auto p-2 text-[12.5px]">{def.steps.map((s, k) => <li key={k}><button onClick={() => { setPlay(false); setI(k + 1) }} className={cn('w-full rounded-md px-2 py-1 text-left transition hover:bg-elev', k === i - 1 ? 'bg-accent/15 font-medium text-fg' : k < i ? 'text-muted' : 'text-faint')}>{k + 1}. {s.label}</button></li>)}</ol>
      </div>
    </div>
  )
}
