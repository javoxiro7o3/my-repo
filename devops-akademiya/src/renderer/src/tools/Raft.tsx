import { useEffect, useRef, useState } from 'react'
import { Pause, Play, Plus, RotateCcw, Scissors } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'

type Role = 'follower' | 'candidate' | 'leader'
interface Node { id: number; role: Role; term: number; votedFor: number | null; votes: number; timer: number; timeout: number; alive: boolean; log: { term: number; cmd: string }[]; commit: number; side: 0 | 1 }
interface Msg { id: number; from: number; to: number; kind: 'vote' | 'grant' | 'append' | 'ack'; t: number; term: number; data?: any }
interface Sim { nodes: Node[]; msgs: Msg[]; time: number; events: string[]; partition: boolean; mid: number; cmdN: number }
const N = 5, TRAVEL = 6
const rnd = () => 30 + Math.floor(Math.random() * 30)
const mk = (): Sim => ({ nodes: Array.from({ length: N }, (_, id) => ({ id, role: 'follower', term: 0, votedFor: null, votes: 0, timer: 0, timeout: rnd(), alive: true, log: [], commit: 0, side: 0 })), msgs: [], time: 0, events: ['Barcha node lar follower. Kimning election timeout i birinchi tugasa — o\'sha nomzod bo\'ladi.'], partition: false, mid: 0, cmdN: 0 })

/** Soddalashtirilgan Raft simulyatsiyasining bir qadami (tick) */
export function step(s0: Sim): Sim {
  const s: Sim = { ...s0, nodes: s0.nodes.map((n) => ({ ...n, log: [...n.log] })), msgs: [], events: [...s0.events], time: s0.time + 1 }
  const ev = (t: string) => { s.events.push(t); if (s.events.length > 60) s.events.shift() }
  const can = (a: Node, b: Node) => a.alive && b.alive && (!s.partition || a.side === b.side)
  const send = (from: number, to: number, kind: Msg['kind'], term: number, data?: any) => s.msgs.push({ id: ++s.mid, from, to, kind, t: 0, term, data })
  const quorum = Math.floor(N / 2) + 1
  const lastTerm = (n: Node) => n.log[n.log.length - 1]?.term ?? 0
  // xabarlarni yetkazish
  for (const m of s0.msgs) {
    if (m.t + 1 < TRAVEL) { s.msgs.push({ ...m, t: m.t + 1 }); continue }
    const to = s.nodes[m.to], from = s.nodes[m.from]
    if (!can(from, to)) continue
    if (m.term > to.term) { if (to.role === 'leader') ev(`N${to.id}: yuqoriroq term (${m.term}) ko'rdi → leader likdan tushdi`); to.term = m.term; to.role = 'follower'; to.votedFor = null }
    if (m.kind === 'vote') {
      const upToDate = m.data.lastTerm > lastTerm(to) || (m.data.lastTerm === lastTerm(to) && m.data.len >= to.log.length)
      if (m.term >= to.term && (to.votedFor === null || to.votedFor === m.from) && upToDate) { to.votedFor = m.from; to.timer = 0; send(to.id, m.from, 'grant', to.term) }
    } else if (m.kind === 'grant') {
      if (to.role === 'candidate' && m.term === to.term) { to.votes++; if (to.votes >= quorum) { to.role = 'leader'; to.timer = 99; ev(`👑 N${to.id} ${to.votes}/${N} ovoz bilan term ${to.term} uchun LEADER bo'ldi`) } }
    } else if (m.kind === 'append') {
      if (m.term >= to.term) { to.role = 'follower'; to.timer = 0; to.log = m.data.log.map((e: any) => ({ ...e })); to.commit = Math.min(m.data.commit, to.log.length); send(to.id, m.from, 'ack', to.term, { len: to.log.length }) }
    } else if (m.kind === 'ack' && to.role === 'leader') { (to as any)._acks = { ...((to as any)._acks ?? {}), [m.from]: m.data.len } }
  }
  for (const n of s.nodes) {
    if (!n.alive) continue
    n.timer++
    if (n.role === 'leader') {
      const acks: Record<number, number> = (n as any)._acks ?? {}
      for (let i = n.log.length; i > n.commit; i--) { const c = 1 + Object.values(acks).filter((l) => l >= i).length; if (c >= quorum && n.log[i - 1].term === n.term) { ev(`✅ N${n.id}: "${n.log[i - 1].cmd}" ko'pchilikda (${c}/${N}) → COMMIT`); n.commit = i; break } }
      if (n.timer >= 10) { n.timer = 0; for (const o of s.nodes) if (o.id !== n.id) send(n.id, o.id, 'append', n.term, { log: n.log, commit: n.commit }) }
    } else if (n.timer >= n.timeout) {
      n.role = 'candidate'; n.term++; n.votedFor = n.id; n.votes = 1; n.timer = 0; n.timeout = rnd(); (n as any)._acks = {}
      ev(`⏱ N${n.id}: heartbeat kelmadi → term ${n.term} da nomzod, ovoz so'ramoqda`)
      for (const o of s.nodes) if (o.id !== n.id) send(n.id, o.id, 'vote', n.term, { lastTerm: lastTerm(n), len: n.log.length })
    }
  }
  return s
}

export default function Raft() {
  const [sim, setSim] = useState<Sim>(mk)
  const [run, setRun] = useState(true)
  const [speed, setSpeed] = useState(90)
  const ref = useRef(sim); ref.current = sim
  useEffect(() => { if (!run) return; const t = setInterval(() => setSim((s) => step(s)), speed); return () => clearInterval(t) }, [run, speed])
  const pos = (i: number) => { const a = (i / N) * 2 * Math.PI - Math.PI / 2; return { x: 300 + 190 * Math.cos(a), y: 230 + 170 * Math.sin(a) } }
  const leaders = sim.nodes.filter((n) => n.alive && n.role === 'leader')
  const alive = sim.nodes.filter((n) => n.alive).length
  const toggle = (id: number) => setSim((s) => ({ ...s, nodes: s.nodes.map((n) => (n.id === id ? { ...n, alive: !n.alive, role: 'follower' as Role, timer: 0, timeout: rnd() } : n)), events: [...s.events, s.nodes[id].alive ? `💥 N${id} o'chirildi` : `🔌 N${id} qayta yoqildi (follower sifatida)`] }))
  const write = () => setSim((s) => { const targets = s.nodes.filter((n) => n.alive && n.role === 'leader'); if (!targets.length) return { ...s, events: [...s.events, '✋ Mijoz yozuvi rad etildi: leader yo\'q (klaster yozish uchun mavjud emas)'] }; const cmdN = s.cmdN + 1; return { ...s, cmdN, nodes: s.nodes.map((n) => (targets.some((t) => t.id === n.id) ? { ...n, log: [...n.log, { term: n.term, cmd: `x=${cmdN}` }] } : n)), events: [...s.events, ...targets.map((t) => `📝 Mijoz → N${t.id}: "x=${cmdN}" (hali commit emas — ko'pchilik tasdig'i kutilmoqda)`)] } })
  const part = () => setSim((s) => ({ ...s, partition: !s.partition, nodes: s.nodes.map((n) => ({ ...n, side: (!s.partition && n.id >= 3 ? 1 : 0) as 0 | 1 })), events: [...s.events, s.partition ? '🔗 Tarmoq tiklandi: yuqori term li leader qoladi, ikkinchisi follower ga tushadi' : '✂️ Tarmoq bo\'lindi: {N0,N1,N2} | {N3,N4}. Ozchilik (2 ta) leader saylay olmaydi va commit qila olmaydi'] }))
  const C: Record<Role, string> = { follower: 'hsl(var(--info))', candidate: 'hsl(var(--warn))', leader: 'hsl(var(--ok))' }
  const MC = { vote: 'hsl(var(--warn))', grant: 'hsl(var(--ok))', append: 'hsl(var(--accent))', ack: 'hsl(var(--faint))' }
  return (
    <div className="grid gap-5 @5xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-3">
        <div className="card flex flex-wrap items-center gap-2 p-3">
          <Button variant="primary" size="sm" onClick={() => setRun((r) => !r)}>{run ? <><Pause size={14} /> Pauza</> : <><Play size={14} /> Davom</>}</Button>
          <Button size="sm" onClick={() => setSim((s) => step(s))} disabled={run}>+1 qadam</Button>
          <Button size="sm" onClick={write}><Plus size={14} /> Mijoz yozuvi</Button>
          <Button size="sm" variant={sim.partition ? 'danger' : 'secondary'} onClick={part}><Scissors size={14} /> {sim.partition ? 'Tarmoqni tiklash' : 'Tarmoqni bo\'lish'}</Button>
          <label className="ml-auto flex items-center gap-2 text-xs text-muted">Tezlik<input type="range" min={30} max={300} step={10} value={330 - speed} onChange={(e) => setSpeed(330 - +e.target.value)} className="w-24 accent-[hsl(var(--accent))]" aria-label="Simulyatsiya tezligi" /></label>
          <Button variant="ghost" size="sm" onClick={() => setSim(mk())}><RotateCcw size={13} /> Boshidan</Button>
        </div>
        <div className="card relative p-2">
          <svg viewBox="0 0 600 460" className="w-full" role="img" aria-label="Raft klasteri">
            {sim.partition && <><line x1="455" y1="20" x2="120" y2="440" stroke="hsl(var(--bad))" strokeWidth="3" strokeDasharray="10 8" /><text x="440" y="40" fontSize="12" fill="hsl(var(--bad))">tarmoq bo'linishi</text></>}
            {sim.msgs.map((m) => { const a = pos(m.from), b = pos(m.to), k = m.t / TRAVEL, blocked = sim.partition && sim.nodes[m.from].side !== sim.nodes[m.to].side; return <circle key={m.id} cx={a.x + (b.x - a.x) * k} cy={a.y + (b.y - a.y) * k} r={m.kind === 'append' ? 5 : 6} fill={MC[m.kind]} opacity={blocked && k > 0.4 ? 0.15 : 0.95} /> })}
            {sim.nodes.map((n) => { const p = pos(n.id), frac = n.role === 'leader' ? 1 : n.timer / n.timeout, r = 44, c = 2 * Math.PI * r; return (
              <g key={n.id} onClick={() => toggle(n.id)} className="cursor-pointer" role="button" aria-label={`Node ${n.id}: ${n.alive ? n.role : 'o\'chiq'} — bosib o'chirish/yoqish`} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && toggle(n.id)}>
                <circle cx={p.x} cy={p.y} r={38} fill={n.alive ? C[n.role] + '' : 'hsl(var(--elev))'} fillOpacity={n.alive ? 0.2 : 1} stroke={n.alive ? C[n.role] : 'hsl(var(--border))'} strokeWidth="3" strokeDasharray={n.alive ? '' : '5 5'} />
                {n.alive && n.role !== 'leader' && <circle cx={p.x} cy={p.y} r={r} fill="none" stroke={C[n.role]} strokeOpacity="0.55" strokeWidth="3" strokeDasharray={c} strokeDashoffset={c * frac} transform={`rotate(-90 ${p.x} ${p.y})`} />}
                <text x={p.x} y={p.y - 6} textAnchor="middle" fontSize="16" fontWeight="700" fill="hsl(var(--fg))">{n.role === 'leader' && n.alive ? '👑 ' : ''}N{n.id}</text>
                <text x={p.x} y={p.y + 11} textAnchor="middle" fontSize="10.5" fill="hsl(var(--muted))">{n.alive ? `term ${n.term}` : 'O\'CHIQ'}</text>
                <text x={p.x} y={p.y + 24} textAnchor="middle" fontSize="9.5" fill="hsl(var(--faint))">{n.alive ? (n.role === 'candidate' ? `ovoz ${n.votes}/${N}` : n.role) : ''}</text>
                <g transform={`translate(${p.x - 40} ${p.y + 52})`}>{n.log.slice(-6).map((e, i) => { const idx = Math.max(0, n.log.length - 6) + i; return <g key={i}><rect x={i * 14} width={12} height={12} rx={2} fill={idx < n.commit ? 'hsl(var(--ok))' : 'hsl(var(--warn))'} fillOpacity={idx < n.commit ? 0.85 : 0.5} /><text x={i * 14 + 6} y={9} textAnchor="middle" fontSize="7.5" fill="#000">{e.term}</text></g> })}</g>
              </g>
            ) })}
          </svg>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 pb-2 text-[11px] text-muted">
            {(['follower', 'candidate', 'leader'] as Role[]).map((r) => <span key={r} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: C[r] }} />{r}</span>)}<span>·</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: MC.vote }} />RequestVote</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: MC.grant }} />ovoz</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: MC.append }} />AppendEntries/heartbeat</span>
            <span>·</span><span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-ok/85" />commit</span><span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-warn/50" />commit emas</span><span className="ml-auto text-faint">Node ni bosing — o'chadi/yonadi</span>
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <div className="card grid grid-cols-3 divide-x text-center">{[['Tirik', `${alive}/${N}`], ['Quorum', `${Math.floor(N / 2) + 1}`], ['Leader', leaders.length ? leaders.map((l) => `N${l.id}`).join(', ') : 'yo\'q']].map(([k, v]) => <div key={k} className="py-3"><div className={cn('text-lg font-semibold tabular-nums', k === 'Leader' && leaders.length > 1 && 'text-warn', k === 'Tirik' && alive < 3 && 'text-bad')}>{v}</div><div className="text-[11px] text-muted">{k}</div></div>)}</div>
        {alive < 3 && <div className="rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-[13px] text-bad">Quorum yo'qoldi: {alive} &lt; 3. Hech kim leader bo'la olmaydi — term cheksiz o'sadi, yozuvlar to'xtaydi. Bu ataylab: noto'g'ri ma'lumotdan ko'ra to'xtash afzal (CP).</div>}
        {leaders.length > 1 && <div className="rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-[13px] text-warn">Ikki "leader" ko'rinmoqda, lekin term lari farq qiladi. Eskisi (ozchilik tomonda) hech narsani commit qila olmaydi — split-brain yo'q.</div>}
        <ol className="card h-[330px] space-y-1 overflow-y-auto p-3 font-mono text-[11.5px] leading-relaxed" aria-live="polite">{[...sim.events].reverse().map((e, i) => <li key={sim.events.length - i} className={cn(i === 0 ? 'text-fg' : 'text-muted')}>{e}</li>)}</ol>
        <div className="card p-3 text-[12.5px] leading-relaxed text-muted"><b className="text-fg">Sinab ko'ring:</b> (1) leader ni o'chiring — yangi saylov. (2) 3 ta node ni o'chiring — quorum yo'q. (3) Tarmoqni bo'ling, yozuv yuboring: ozchilik tomondagi yozuv sariq (commit emas) qoladi; tarmoq tiklanganda u ustidan yoziladi.</div>
      </div>
    </div>
  )
}
