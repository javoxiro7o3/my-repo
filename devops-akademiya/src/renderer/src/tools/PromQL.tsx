import { useMemo, useState } from 'react'
import { evaluate, fmtLabels, parse, POINTS, sampleData, STEP, type Vec } from '@shared/promql'
import { cn } from '@/lib/utils'

const EXAMPLES: [string, string, string][] = [
  ['Xom counter', 'http_requests_total{status="200",method="GET"}', 'Counter faqat o\'sadi — o\'zi foydasiz. web-2 dagi "tushish" — restart (counter reset).'],
  ['So\'rovlar tezligi', 'rate(http_requests_total[1m])', 'Har bir qator uchun soniyasiga o\'rtacha o\'sish. rate() reset ni o\'zi tuzatadi.'],
  ['Status bo\'yicha RPS', 'sum by (status) (rate(http_requests_total[1m]))', 'Avval rate, keyin sum — aksincha emas!'],
  ['Xato ulushi, %', 'sum(rate(http_requests_total{status=~"5.."}[1m])) / sum(rate(http_requests_total[1m])) * 100', 'Ikki tomon ham label siz (sum) — shuning uchun bo\'lish ishlaydi.'],
  ['p95 kechikish', 'histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[2m])))', 'le saqlanishi shart: kvantil bucket chegaralari orasida chiziqli interpolyatsiya.'],
  ['O\'rtacha kechikish', 'sum(rate(http_request_duration_seconds_sum[2m])) / sum(rate(http_request_duration_seconds_count[2m]))', '_sum / _count — o\'rtacha; p95 bilan solishtiring.'],
  ['CPU band, %', '100 - avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[2m])) * 100', 'idle ulushini 100 dan ayiramiz.'],
  ['Xotira band, %', '(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100', 'Ikki gauge — label lari bir xil, shuning uchun to\'g\'ridan-to\'g\'ri bo\'linadi.'],
  ['Disk 4 soatda to\'ladimi?', 'predict_linear(node_filesystem_avail_bytes[10m], 14400) / 1024 / 1024 / 1024', 'Chiziqli prognoz (GiB): manfiy bo\'lsa — to\'ladi. Alert uchun: … < 0'],
  ['Kim o\'chgan?', 'up == 0', 'Taqqoslash filtr vazifasini bajaradi: faqat shartga mos nuqtalar qoladi.'],
  ['irate vs rate', 'irate(http_requests_total{status="500"}[1m])', 'irate — faqat oxirgi ikki nuqta: keskin, shovqinli. Alertda rate ishlating.'],
  ['Eng band 2 ta', 'topk(2, sum by (instance, method) (rate(http_requests_total[1m])))', '']
]
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#a855f7', '#ef4444', '#84cc16', '#f97316', '#14b8a6']
const data = sampleData()
const METRICS = [...new Set(data.map((s) => s.metric))]
const num = (v: number) => (Math.abs(v) >= 1e9 ? (v / 1e9).toFixed(2) + 'G' : Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : Math.abs(v) >= 1e4 ? (v / 1e3).toFixed(1) + 'k' : Math.abs(v) < 10 ? v.toFixed(3) : v.toFixed(1))

export default function PromQL() {
  const [q, setQ] = useState(EXAMPLES[2][1])
  const [hover, setHover] = useState<number | null>(null)
  const res = useMemo(() => { try { const r = evaluate(parse(q), data); return { vec: typeof r === 'number' ? ([{ labels: {}, values: Array(POINTS).fill(r) }] as Vec) : r, scalar: typeof r === 'number' } } catch (e: any) { return { err: e.message as string } } }, [q])
  const vec = 'vec' in res ? res.vec!.slice(0, 20) : []
  const all = vec.flatMap((s) => s.values).filter((x): x is number => x !== null && isFinite(x))
  const lo = Math.min(0, ...all), hi = Math.max(...all, lo + 1e-9), W = 900, H = 320, L = 60, B = 26, T = 12
  const X = (i: number) => L + (i / (POINTS - 1)) * (W - L - 10), Y = (v: number) => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B)
  const note = EXAMPLES.find((e) => e[1] === q)?.[2]
  return (
    <div className="grid gap-5 @5xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-4">
        <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={2} spellCheck={false} className={cn('input resize-none font-mono text-[14px]', 'err' in res && 'border-bad')} aria-label="PromQL so'rovi" />
        {'err' in res ? <pre className="whitespace-pre-wrap rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 font-mono text-[12.5px] text-bad" role="alert">{res.err}</pre> : note ? <p className="rounded-xl border bg-elev/50 px-4 py-2.5 text-[13px] text-muted">💡 {note}</p> : null}
        <div className="card p-3">
          {!vec.length && !('err' in res) ? <div className="py-20 text-center text-sm text-muted">Natija bo'sh — hech bir qator shartga mos kelmadi.</div> : (
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="So'rov natijasi grafigi" onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const i = Math.round((((e.clientX - r.left) / r.width) * W - L) / (W - L - 10) * (POINTS - 1)); setHover(i >= 0 && i < POINTS ? i : null) }} onMouseLeave={() => setHover(null)}>
              {[0, 0.25, 0.5, 0.75, 1].map((f) => <g key={f}><line x1={L} x2={W - 10} y1={T + f * (H - T - B)} y2={T + f * (H - T - B)} stroke="hsl(var(--border))" strokeDasharray="3 5" /><text x={L - 6} y={T + f * (H - T - B) + 4} textAnchor="end" fontSize="10.5" fontFamily="JetBrains Mono" fill="hsl(var(--faint))">{num(hi - f * (hi - lo))}</text></g>)}
              {[0, 60, 120, 180, 240].map((i) => <text key={i} x={X(i)} y={H - 8} textAnchor="middle" fontSize="10.5" fill="hsl(var(--faint))">{i === 240 ? 'hozir' : `-${60 - (i * STEP) / 60} daq`}</text>)}
              {vec.map((s, k) => { let d = '', pen = false; s.values.forEach((v, i) => { if (v === null || !isFinite(v)) { pen = false; return } d += `${pen ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)} `; pen = true }); const sparse = s.values.filter((v) => v !== null).length < 30; return <g key={k}><path d={d} fill="none" stroke={COLORS[k % 10]} strokeWidth="2" strokeLinejoin="round" />{sparse && s.values.map((v, i) => v !== null && <circle key={i} cx={X(i)} cy={Y(v)} r="2.5" fill={COLORS[k % 10]} />)}</g> })}
              {hover !== null && <line x1={X(hover)} x2={X(hover)} y1={T} y2={H - B} stroke="hsl(var(--fg) / .4)" />}
            </svg>
          )}
        </div>
        {vec.length > 0 && <div className="card max-h-64 overflow-y-auto"><table className="w-full text-[12.5px]"><thead><tr className="sticky top-0 border-b bg-elev text-left"><th className="px-3 py-1.5 font-medium">Qator (label to'plami)</th><th className="px-3 py-1.5 text-right font-medium">{hover !== null ? `-${(60 - (hover * STEP) / 60).toFixed(1)} daq` : 'Oxirgi qiymat'}</th></tr></thead><tbody className="divide-y font-mono">{vec.map((s, k) => { const v = hover !== null ? s.values[hover] : [...s.values].reverse().find((x) => x !== null); return <tr key={k}><td className="px-3 py-1.5"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[k % 10] }} />{Object.keys(s.labels).length ? fmtLabels(s.labels) : '{} (label siz)'}</td><td className="px-3 py-1.5 text-right tabular-nums">{v === null || v === undefined ? '—' : num(v)}</td></tr> })}</tbody></table></div>}
      </div>
      <div className="space-y-4">
        <div className="card p-3"><div className="label mb-2 px-1">Namunalar</div><div className="space-y-0.5">{EXAMPLES.map(([n, e]) => <button key={n} onClick={() => setQ(e)} className={cn('w-full rounded-md px-2 py-1.5 text-left text-[13px] transition hover:bg-elev', q === e ? 'bg-accent/15 text-fg' : 'text-muted')}>{n}</button>)}</div></div>
        <div className="card p-3"><div className="label mb-2 px-1">Mavjud metrikalar</div><div className="space-y-0.5">{METRICS.map((m) => <button key={m} onClick={() => setQ(m)} className="block w-full truncate rounded-md px-2 py-1 text-left font-mono text-[11.5px] text-muted transition hover:bg-elev hover:text-fg" title={m}>{m}</button>)}</div><p className="mt-2 px-1 text-[11.5px] leading-relaxed text-faint">1 soatlik sun'iy ma'lumot, scrape interval {STEP}s. 30–42-daqiqalarda "incident": xatolar va kechikish oshadi.</p></div>
      </div>
    </div>
  )
}
