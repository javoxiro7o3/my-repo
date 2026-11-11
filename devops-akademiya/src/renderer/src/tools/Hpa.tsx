import { useMemo, useState } from 'react'
import { Segmented } from '@/components/ui'

interface P { mode: 'hpa' | 'keda'; pattern: 'step' | 'spike' | 'wave' | 'ramp'; target: number; min: number; max: number; perPod: number; stab: number; startup: number; queueTarget: number }
const LOAD: Record<P['pattern'], (t: number) => number> = {
  step: (t) => (t < 60 ? 200 : t < 360 ? 1400 : 200), spike: (t) => (t > 120 && t < 165 ? 2400 : 300),
  wave: (t) => 900 + 800 * Math.sin(t / 55), ramp: (t) => Math.max(0, t < 300 ? t * 6 : 1800 - (t - 300) * 9)
}
const KLOAD: Record<P['pattern'], (t: number) => number> = { step: (t) => (t >= 60 && t < 240 ? 12 : 0), spike: (t) => (t > 120 && t < 150 ? 60 : 0), wave: (t) => Math.max(0, 8 * Math.sin(t / 50)), ramp: (t) => (t < 200 ? t / 20 : 0) }

/** HPA sikli: har 15 s da desired = ceil(current × metric / target), 10% tolerantlik, scale-down stabilizatsiyasi */
export function simulate(p: P, T = 600) {
  const rows: { t: number; load: number; replicas: number; ready: number; util: number; desired: number; queue: number }[] = []
  let replicas = p.mode === 'keda' ? p.min : Math.max(1, p.min), queue = 0
  const pending: { at: number; n: number }[] = []; let ready = replicas
  const recs: { t: number; d: number }[] = []
  for (let t = 0; t <= T; t++) {
    for (const x of pending) if (x.at === t) ready += x.n
    ready = Math.min(ready, replicas)
    let util = 0, load = 0
    if (p.mode === 'hpa') { load = Math.max(0, LOAD[p.pattern](t)); util = ready ? (load / (ready * p.perPod)) * 100 : 0 }
    else { load = KLOAD[p.pattern](t); queue = Math.max(0, queue + load - ready * (p.perPod / 100)); util = queue }
    let desired = replicas
    if (t % 15 === 0) {
      if (p.mode === 'hpa') { const ratio = Math.min(util, 400) / p.target; desired = Math.abs(ratio - 1) <= 0.1 ? replicas : Math.ceil(ready * ratio) }
      else desired = queue <= 0 ? p.min : Math.ceil(queue / p.queueTarget)
      desired = Math.max(p.mode === 'keda' ? p.min : Math.max(1, p.min), Math.min(p.max, desired))
      recs.push({ t, d: desired })
      // scale-down: stabilizatsiya oynasidagi ENG KATTA tavsiya olinadi
      const stabilized = Math.max(...recs.filter((r) => r.t > t - p.stab).map((r) => r.d))
      const next = desired > replicas ? desired : Math.min(replicas, stabilized)
      if (next > replicas) pending.push({ at: t + p.startup, n: next - replicas })
      if (next < replicas) ready = Math.min(ready, next)
      replicas = next
    }
    rows.push({ t, load, replicas, ready, util, desired, queue })
  }
  return rows
}

export default function Hpa() {
  const [p, setP] = useState<P>({ mode: 'hpa', pattern: 'step', target: 60, min: 2, max: 12, perPod: 100, stab: 300, startup: 20, queueTarget: 5 })
  const rows = useMemo(() => simulate(p.mode === 'keda' ? { ...p, min: Math.min(p.min, 1) === 0 ? 0 : p.min } : p), [p])
  const W = 860, H = 300, L = 44, R = 44, T0 = 14, B = 26
  const x = (t: number) => L + (t / 600) * (W - L - R)
  const maxLoad = Math.max(...rows.map((r) => (p.mode === 'hpa' ? r.load : r.queue)), 10), maxRep = Math.max(p.max, 4)
  const yL = (v: number) => T0 + (1 - v / maxLoad) * (H - T0 - B), yR = (v: number) => T0 + (1 - v / maxRep) * (H - T0 - B)
  const path = (f: (r: (typeof rows)[0]) => number, step = false) => rows.map((r, i) => `${i ? (step ? 'L' : 'L') : 'M'}${x(r.t).toFixed(1)} ${f(r).toFixed(1)}`).join(' ')
  const over = rows.filter((r) => p.mode === 'hpa' && r.util > 100).length
  const podSec = rows.reduce((a, r) => a + r.replicas, 0)
  const set = <K extends keyof P>(k: K, v: P[K]) => setP({ ...p, [k]: v })
  const Sl = ({ k, label, min, max, step = 1, unit = '' }: { k: keyof P; label: string; min: number; max: number; step?: number; unit?: string }) => <label className="block"><div className="flex justify-between text-[12.5px]"><span className="text-muted">{label}</span><span className="font-mono font-semibold">{p[k]}{unit}</span></div><input type="range" min={min} max={max} step={step} value={p[k] as number} onChange={(e) => set(k, +e.target.value as never)} className="w-full accent-[hsl(var(--accent))]" /></label>
  const peak = rows.reduce((a, r) => (r.util > a.util ? r : a), rows[0])
  return (
    <div className="grid gap-5 @5xl:grid-cols-[300px_minmax(0,1fr)]">
      <div className="card space-y-4 p-5">
        <Segmented label="Rejim" value={p.mode} onChange={(v) => setP({ ...p, mode: v, min: v === 'keda' ? 0 : 2, stab: v === 'keda' ? 60 : 300 })} options={[{ value: 'hpa', label: 'HPA (CPU)' }, { value: 'keda', label: 'KEDA (navbat)' }]} />
        <div><div className="mb-1.5 text-[12.5px] text-muted">Yuklama shakli</div><Segmented label="Yuklama" value={p.pattern} onChange={(v) => set('pattern', v)} options={[{ value: 'step', label: 'Pog\'ona' }, { value: 'spike', label: 'Sakrash' }, { value: 'wave', label: 'To\'lqin' }, { value: 'ramp', label: 'O\'sish' }]} /></div>
        {p.mode === 'hpa' ? <Sl k="target" label="Maqsad CPU (requests ga nisbatan)" min={20} max={90} step={5} unit="%" /> : <Sl k="queueTarget" label="Bir Pod ga navbat uzunligi (listLength)" min={1} max={20} />}
        <Sl k="min" label="minReplicas" min={p.mode === 'keda' ? 0 : 1} max={6} /><Sl k="max" label="maxReplicas" min={2} max={30} />
        <Sl k="stab" label="Scale-down stabilizatsiya oynasi" min={0} max={420} step={15} unit=" s" /><Sl k="startup" label="Pod tayyor bo'lish vaqti" min={0} max={90} step={5} unit=" s" />
        <div className="rounded-lg border bg-bg p-3 font-mono text-[11.5px] leading-relaxed">desired = ceil(current × metric / target)<br /><span className="text-faint"># eng yuqori nuqtada (t={peak.t}s):</span><br />{p.mode === 'hpa' ? `ceil(${peak.ready} × ${peak.util.toFixed(0)}% / ${p.target}%) = ${Math.ceil(peak.ready * peak.util / p.target)}` : `ceil(${peak.queue.toFixed(0)} / ${p.queueTarget}) = ${Math.ceil(peak.queue / p.queueTarget)}`}</div>
      </div>
      <div className="space-y-4">
        <div className="card p-3">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Yuklama va replica soni grafigi">
            {[0, 0.25, 0.5, 0.75, 1].map((f) => <g key={f}><line x1={L} x2={W - R} y1={T0 + f * (H - T0 - B)} y2={T0 + f * (H - T0 - B)} stroke="hsl(var(--border))" strokeDasharray="3 5" /><text x={L - 6} y={T0 + f * (H - T0 - B) + 4} textAnchor="end" fontSize="10" fill="hsl(var(--info))">{Math.round(maxLoad * (1 - f))}</text><text x={W - R + 6} y={T0 + f * (H - T0 - B) + 4} fontSize="10" fill="hsl(var(--accent))">{Math.round(maxRep * (1 - f))}</text></g>)}
            {[0, 120, 240, 360, 480, 600].map((t) => <text key={t} x={x(t)} y={H - 8} textAnchor="middle" fontSize="10" fill="hsl(var(--faint))">{t}s</text>)}
            {p.mode === 'hpa' && rows.filter((r) => r.util > 100).map((r) => <rect key={r.t} x={x(r.t)} y={T0} width={(W - L - R) / 600 + 0.6} height={H - T0 - B} fill="hsl(var(--bad) / .14)" />)}
            <path d={`${path((r) => yL(p.mode === 'hpa' ? r.load : r.queue))} L${x(600)} ${H - B} L${L} ${H - B} Z`} fill="hsl(var(--info) / .12)" />
            <path d={path((r) => yL(p.mode === 'hpa' ? r.load : r.queue))} fill="none" stroke="hsl(var(--info))" strokeWidth="2" />
            {p.mode === 'hpa' && <path d={path((r) => yL(r.ready * p.perPod))} fill="none" stroke="hsl(var(--ok))" strokeWidth="1.5" strokeDasharray="5 4" />}
            <path d={rows.map((r, i) => (i ? `H${x(r.t).toFixed(1)} V${yR(r.replicas).toFixed(1)}` : `M${x(0)} ${yR(r.replicas)}`)).join(' ')} fill="none" stroke="hsl(var(--accent))" strokeWidth="2.5" />
          </svg>
          <div className="flex flex-wrap gap-x-5 gap-y-1 px-3 pb-1 text-[11.5px] text-muted"><span className="flex items-center gap-1.5"><span className="h-0.5 w-5 bg-info" />{p.mode === 'hpa' ? 'yuklama (millicore, chap o\'q)' : 'navbat uzunligi (chap o\'q)'}</span><span className="flex items-center gap-1.5"><span className="h-0.5 w-5 bg-accent" />replicas (o'ng o'q)</span>{p.mode === 'hpa' && <><span className="flex items-center gap-1.5"><span className="h-0.5 w-5 border-t-2 border-dashed border-ok" />tayyor Pod lar sig'imi</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-4 bg-bad/25" />sig'imdan ortiq (throttling/xatolar)</span></>}</div>
        </div>
        <div className="grid grid-cols-4 gap-3">{[['Eng ko\'p replica', Math.max(...rows.map((r) => r.replicas))], ['Eng kam replica', Math.min(...rows.map((r) => r.replicas))], ['Ortiqcha yuklangan vaqt', `${over} s`], ['Pod-soniyalar (narx)', podSec]].map(([k, v]) => <div key={k as string} className="card p-3"><div className="text-xl font-semibold tabular-nums">{v}</div><div className="text-[11.5px] text-muted">{k}</div></div>)}</div>
        <div className="card p-4 text-[13px] leading-relaxed text-muted">
          {p.mode === 'hpa' ? <><b className="text-fg">Kuzating:</b> (1) HPA har 15 s da hisoblaydi; ±10% ichida hech narsa qilmaydi. (2) Scale-up darhol, scale-down esa stabilizatsiya oynasidagi <i>eng katta</i> tavsiya bo'yicha — oynani 0 ga tushirib, "To'lqin" da flapping ni ko'ring. (3) "Sakrash" da Pod tayyor bo'lish vaqti hal qiluvchi: qizil zona — foydalanuvchilar sekinlik sezadigan payt. (4) Foiz <b>requests</b> ga nisbatan hisoblanadi — requests bo'lmasa HPA ishlamaydi.</> : <><b className="text-fg">KEDA:</b> metrika CPU emas, tashqi hodisa manbai (Redis list uzunligi). minReplicas=0 bo'lsa navbat bo'shaganda <b>nolga</b> tushadi — 0↔1 o'tishni KEDA o'zi, 1↔N ni u yaratgan HPA boshqaradi. Navbat uchun CPU dan yaxshi signal: ish kelgan zahoti ko'rinadi.</>}
        </div>
      </div>
    </div>
  )
}
