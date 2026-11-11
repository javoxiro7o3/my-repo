import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'

interface KNode { name: string; cpu: number; mem: number; usedCpu: number; usedMem: number; labels: Record<string, string>; taints: { key: string; value: string; effect: string }[]; pods: string[] }
interface KPod { name: string; app: string; cpu: number; mem: number; nodeSelector?: Record<string, string>; tolerations?: { key: string; value?: string }[]; antiAffinity?: string; prefer?: Record<string, string> }
interface Puzzle { title: string; nodes: KNode[]; pod: KPod; lesson: string }
const n = (name: string, cpu: number, mem: number, usedCpu: number, usedMem: number, labels: Record<string, string> = {}, taints: KNode['taints'] = [], pods: string[] = []): KNode => ({ name, cpu, mem, usedCpu, usedMem, labels, taints, pods })

const PUZZLES: Puzzle[] = [
  { title: 'Resurs yetadimi?', lesson: 'Scheduler haqiqiy iste\'molni emas, mavjud Pod larning requests YIG\'INDISINI hisoblaydi. node-1 "bo\'sh" ko\'rinsa ham, unga 3500m allaqachon va\'da qilingan.', nodes: [n('node-1', 4000, 8192, 3500, 2048), n('node-2', 4000, 8192, 2000, 6144), n('node-3', 2000, 4096, 500, 1024)], pod: { name: 'api-7f9c', app: 'api', cpu: 1000, mem: 2048 } },
  { title: 'Taint va toleration', lesson: 'Taint node ni "itaradi": toleration siz Pod u yerga tusha olmaydi. node-1 da NoSchedule taint bor, Pod da esa toleration yo\'q.', nodes: [n('node-1', 8000, 16384, 0, 0, { disk: 'ssd' }, [{ key: 'dedicated', value: 'db', effect: 'NoSchedule' }]), n('node-2', 4000, 8192, 3200, 4096), n('node-3', 4000, 8192, 1000, 2048)], pod: { name: 'web-5d8b', app: 'web', cpu: 500, mem: 512 } },
  { title: 'Toleration jalb qilmaydi', lesson: 'Toleration faqat RUXSAT beradi, majburlamaydi. Pod node-1 ga ham, boshqalarga ham tusha oladi — scheduler eng yaxshi ball olganini tanlaydi (bu yerda eng bo\'sh node). Ajratilgan node ga majburlash uchun toleration + nodeSelector/affinity birga kerak.', nodes: [n('node-1', 4000, 8192, 3000, 6000, {}, [{ key: 'dedicated', value: 'db', effect: 'NoSchedule' }]), n('node-2', 4000, 8192, 500, 1024), n('node-3', 4000, 8192, 2500, 5000)], pod: { name: 'pg-0', app: 'postgres', cpu: 500, mem: 1024, tolerations: [{ key: 'dedicated', value: 'db' }] } },
  { title: 'nodeSelector', lesson: 'nodeSelector — qat\'iy filtr: label mos kelmagan node lar darhol chiqarib tashlanadi. disk=ssd faqat node-3 da.', nodes: [n('node-1', 4000, 8192, 500, 1024, { disk: 'hdd' }), n('node-2', 4000, 8192, 1000, 2048, { disk: 'hdd' }), n('node-3', 4000, 8192, 3000, 6144, { disk: 'ssd' })], pod: { name: 'cache-2x', app: 'redis', cpu: 500, mem: 1024, nodeSelector: { disk: 'ssd' } } },
  { title: 'Pod anti-affinity', lesson: 'required podAntiAffinity (topologyKey: hostname): app=web li Pod bor node larga tushmaydi. node-1 va node-2 da web bor → faqat node-3.', nodes: [n('node-1', 4000, 8192, 1000, 2048, {}, [], ['web']), n('node-2', 4000, 8192, 1000, 2048, {}, [], ['web']), n('node-3', 4000, 8192, 3000, 6000, {}, [], ['db'])], pod: { name: 'web-c', app: 'web', cpu: 500, mem: 512, antiAffinity: 'web' } },
  { title: 'Pending!', lesson: 'Hech bir node filtrdan o\'tmadi → Pod Pending. "kubectl describe pod" da: 0/3 nodes are available: 1 node(s) had untolerated taint, 2 Insufficient memory. Yechim: requests ni kamaytirish, node qo\'shish (Cluster Autoscaler) yoki toleration.', nodes: [n('node-1', 8000, 32768, 0, 0, {}, [{ key: 'gpu', value: 'true', effect: 'NoSchedule' }]), n('node-2', 4000, 8192, 1000, 6144), n('node-3', 4000, 8192, 2000, 7168)], pod: { name: 'ml-job', app: 'ml', cpu: 1000, mem: 4096 } },
  { title: 'Preferred affinity', lesson: 'preferred (soft) affinity filtr emas — faqat ball qo\'shadi. zone=a afzal, va node-2 unga mos, resursi ham yetarli → node-2. Agar zone=a to\'la bo\'lganida, Pod baribir boshqa zonaga joylashardi.', nodes: [n('node-1', 4000, 8192, 800, 1024, { zone: 'b' }), n('node-2', 4000, 8192, 1500, 3072, { zone: 'a' }), n('node-3', 4000, 8192, 3800, 7900, { zone: 'a' })], pod: { name: 'front-1', app: 'front', cpu: 500, mem: 512, prefer: { zone: 'a' } } }
]

export interface Verdict { node: string; ok: boolean; reasons: string[]; score: number }
/** kube-scheduler ning soddalashtirilgan Filter → Score mantig'i */
export function schedule(nodes: KNode[], pod: KPod): { verdicts: Verdict[]; chosen: string | null } {
  const verdicts = nodes.map((nd) => {
    const r: string[] = []
    if (nd.cpu - nd.usedCpu < pod.cpu) r.push(`Insufficient cpu (bo'sh ${nd.cpu - nd.usedCpu}m < ${pod.cpu}m)`)
    if (nd.mem - nd.usedMem < pod.mem) r.push(`Insufficient memory (bo'sh ${nd.mem - nd.usedMem}Mi < ${pod.mem}Mi)`)
    for (const t of nd.taints) if (!pod.tolerations?.some((x) => x.key === t.key && (x.value === undefined || x.value === t.value))) r.push(`untolerated taint {${t.key}=${t.value}:${t.effect}}`)
    if (pod.nodeSelector) for (const [k, v] of Object.entries(pod.nodeSelector)) if (nd.labels[k] !== v) r.push(`node(s) didn't match Pod's node affinity/selector (${k}=${v})`)
    if (pod.antiAffinity && nd.pods.includes(pod.antiAffinity)) r.push(`node(s) didn't match pod anti-affinity rules (app=${pod.antiAffinity} bor)`)
    const freeCpu = (nd.cpu - nd.usedCpu - pod.cpu) / nd.cpu, freeMem = (nd.mem - nd.usedMem - pod.mem) / nd.mem
    let score = Math.round(((freeCpu + freeMem) / 2) * 100) // LeastAllocated
    if (pod.prefer && Object.entries(pod.prefer).every(([k, v]) => nd.labels[k] === v)) score += 100
    return { node: nd.name, ok: !r.length, reasons: r, score: r.length ? 0 : score }
  })
  const ok = verdicts.filter((v) => v.ok).sort((a, b) => b.score - a.score)
  return { verdicts, chosen: ok[0]?.node ?? null }
}

const Bar = ({ used, add, total, unit }: { used: number; add: number; total: number; unit: string }) => (
  <div><div className="flex justify-between text-[10.5px] text-faint"><span>{unit}</span><span className="font-mono">{used}{add ? `+${add}` : ''} / {total}</span></div><div className="mt-0.5 flex h-2 overflow-hidden rounded-full bg-elev"><div className="bg-info/70" style={{ width: `${(used / total) * 100}%` }} /><motion.div initial={{ width: 0 }} animate={{ width: `${(add / total) * 100}%` }} className={used + add > total ? 'bg-bad' : 'bg-accent'} /></div></div>
)

export default function Scheduler() {
  const [i, setI] = useState(0)
  const [pick, setPick] = useState<string | null>(null)
  const [score, setScore] = useState({ ok: 0, all: 0 })
  const p = PUZZLES[i]
  const res = useMemo(() => schedule(p.nodes, p.pod), [p])
  const answered = pick !== null, right = pick === (res.chosen ?? 'Pending')
  const choose = (v: string) => { if (answered) return; setPick(v); setScore((s) => ({ ok: s.ok + (v === (res.chosen ?? 'Pending') ? 1 : 0), all: s.all + 1 })) }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">{PUZZLES.map((x, k) => <button key={k} onClick={() => { setI(k); setPick(null) }} className={cn('chip hover:border-accent hover:text-fg', k === i && '!border-accent !text-fg')}>{k + 1}. {x.title}</button>)}<span className="chip ml-auto tabular-nums">{score.ok} / {score.all} to'g'ri</span></div>
      <div className="grid gap-5 @4xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="card p-5">
          <div className="label mb-2">Rejalashtirilmagan Pod</div>
          <div className="text-lg font-semibold">{p.pod.name}</div>
          <pre className="mt-3 overflow-x-auto rounded-lg border bg-bg p-3 font-mono text-[11.5px] leading-relaxed">{[`labels: { app: ${p.pod.app} }`, 'resources:', '  requests:', `    cpu: ${p.pod.cpu}m`, `    memory: ${p.pod.mem}Mi`, p.pod.nodeSelector && `nodeSelector:\n${Object.entries(p.pod.nodeSelector).map(([k, v]) => `  ${k}: ${v}`).join('\n')}`, p.pod.tolerations && `tolerations:\n${p.pod.tolerations.map((t) => `  - key: ${t.key}\n    value: ${t.value}\n    effect: NoSchedule`).join('\n')}`, p.pod.antiAffinity && `podAntiAffinity (required):\n  app: ${p.pod.antiAffinity}\n  topologyKey: hostname`, p.pod.prefer && `nodeAffinity (preferred):\n${Object.entries(p.pod.prefer).map(([k, v]) => `  ${k}: ${v}`).join('\n')}`].filter(Boolean).join('\n')}</pre>
          <p className="mt-3 text-[13px] font-medium">Scheduler bu Pod ni qayerga joylaydi?</p>
          <Button className="mt-2 w-full" variant={answered && !res.chosen ? 'ok' : answered && pick === 'Pending' ? 'danger' : 'secondary'} onClick={() => choose('Pending')} disabled={answered}>Hech qayerga — Pending</Button>
        </div>
        <div className="grid gap-3 @2xl:grid-cols-3">
          {p.nodes.map((nd) => { const v = res.verdicts.find((x) => x.node === nd.name)!; const win = answered && res.chosen === nd.name, bad = answered && pick === nd.name && !win; return (
            <motion.button key={nd.name} disabled={answered} onClick={() => choose(nd.name)} whileHover={answered ? {} : { y: -3 }} animate={bad ? { x: [0, -6, 6, -3, 3, 0] } : {}} className={cn('card flex flex-col gap-2.5 p-4 text-left transition', !answered && 'hover:border-accent hover:shadow-glow', win && '!border-ok bg-ok/[.06]', bad && '!border-bad bg-bad/[.06]', answered && !win && !bad && 'opacity-80')}>
              <div className="flex items-center justify-between"><span className="text-[15px] font-semibold">🖥️ {nd.name}</span>{win && <Check size={18} className="text-ok" />}{bad && <X size={18} className="text-bad" />}</div>
              <Bar used={nd.usedCpu} add={win ? p.pod.cpu : 0} total={nd.cpu} unit="CPU requests (m)" /><Bar used={nd.usedMem} add={win ? p.pod.mem : 0} total={nd.mem} unit="Xotira requests (Mi)" />
              <div className="flex min-h-[22px] flex-wrap gap-1">{Object.entries(nd.labels).map(([k, val]) => <span key={k} className="rounded bg-info/15 px-1.5 py-0.5 font-mono text-[10px] text-info">{k}={val}</span>)}{nd.taints.map((t) => <span key={t.key} className="rounded bg-warn/15 px-1.5 py-0.5 font-mono text-[10px] text-warn">⚠ {t.key}={t.value}:{t.effect}</span>)}{nd.pods.map((x) => <span key={x} className="rounded bg-elev px-1.5 py-0.5 font-mono text-[10px]">pod app={x}</span>)}</div>
              {answered && <div className="border-t pt-2 text-[11.5px] leading-relaxed">{v.ok ? <span className="text-ok">✓ Filtrdan o'tdi · ball: <b>{v.score}</b></span> : v.reasons.map((r) => <div key={r} className="text-bad">✗ {r}</div>)}</div>}
            </motion.button>
          ) })}
        </div>
      </div>
      {answered && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn('rounded-xl border px-5 py-4', right ? 'border-ok/40 bg-ok/[.07]' : 'border-bad/40 bg-bad/[.07]')} role="status">
          <div className="flex items-start justify-between gap-4"><div><div className={cn('font-semibold', right ? 'text-ok' : 'text-bad')}>{right ? 'To\'g\'ri!' : 'Noto\'g\'ri.'} Natija: {res.chosen ?? 'Pending (0/3 nodes are available)'}</div><p className="mt-1.5 text-[13.5px] leading-relaxed">{p.lesson}</p><p className="mt-1.5 text-xs text-muted">Bosqichlar: <b>Filter</b> (mumkin bo'lmaganlarni chiqarish) → <b>Score</b> (bu yerda LeastAllocated: bo'sh resursi ko'p node yuqori ball; preferred affinity +100) → <b>Bind</b>.</p></div>
            {i < PUZZLES.length - 1 && <Button variant="primary" onClick={() => { setI(i + 1); setPick(null) }}>Keyingisi <ArrowRight size={14} /></Button>}</div>
        </motion.div>
      )}
    </div>
  )
}
