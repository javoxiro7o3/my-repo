import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Pause, Play, Power, RefreshCw, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, Switch } from '@/components/ui'

interface PG { name: string; role: 'primary' | 'replica' | 'down'; lsn: number; timeline: number; sync: boolean }
interface St { nodes: PG[]; leader: string | null; ttl: number; t: number; events: string[]; writes: number; failed: number; lost: number; syncMode: boolean; etcdUp: number; switching: string | null; lastAck: number }
const TTL = 30, LOOP = 10
const init = (syncMode = false): St => ({ nodes: [{ name: 'pg-1', role: 'primary', lsn: 100, timeline: 1, sync: false }, { name: 'pg-2', role: 'replica', lsn: 100, timeline: 1, sync: syncMode }, { name: 'pg-3', role: 'replica', lsn: 100, timeline: 1, sync: false }], leader: 'pg-1', ttl: TTL, t: 0, events: ['Klaster sog\'lom: pg-1 — primary (leader key egasi), pg-2 va pg-3 — streaming replikalar.'], writes: 0, failed: 0, lost: 0, syncMode, etcdUp: 3, switching: null, lastAck: 100 })

/** Patroni HA siklining soddalashtirilgan modeli (1 tick = 1 soniya) */
export function tick(s0: St): St {
  const s: St = { ...s0, nodes: s0.nodes.map((n) => ({ ...n })), events: [...s0.events], t: s0.t + 1 }
  const ev = (m: string) => s.events.push(`[${String(s.t).padStart(3)}s] ${m}`)
  const quorum = s.etcdUp >= 2
  const prim = s.nodes.find((n) => n.role === 'primary')
  // Mijoz yozuvlari HAProxy orqali (/primary health check i bo'yicha)
  if (prim && s.leader === prim.name && quorum) {
    const syncRep = s.nodes.find((n) => n.sync && n.role === 'replica')
    if (s.syncMode && !syncRep) { s.failed++; if (s.t % 5 === 0) ev('⏳ synchronous_mode: sinxron replika yo\'q — commit lar OSILIB turibdi (ma\'lumot xavfsizligi > mavjudlik)') }
    else { prim.lsn += 3; s.writes++; if (syncRep) { syncRep.lsn = prim.lsn; s.lastAck = prim.lsn } else s.lastAck = prim.lsn }
  } else s.failed++
  // Replikatsiya (async replikalar biroz orqada)
  for (const r of s.nodes) if (r.role === 'replica' && prim && !r.sync) r.lsn = Math.min(prim.lsn, r.lsn + (r.name === 'pg-3' ? 2 : 3))
  // Leader key: primary har LOOP soniyada TTL ni yangilaydi
  if (!quorum) { if (prim && s.t % LOOP === 0) { prim.role = 'replica'; s.leader = null; ev('🛑 etcd quorum yo\'q: primary leader key ni yangilay olmadi → o\'zini DEMOTE qildi (split-brain dan himoya). Klaster faqat o\'qish rejimida.') } return s }
  if (prim && s.leader === prim.name) { if (s.t % LOOP === 0) s.ttl = TTL } else if (s.leader) { s.ttl--; if (s.ttl === TTL - 1) ev(`💔 ${s.leader} javob bermayapti. Leader key TTL sanalmoqda (${TTL}s)…`) }
  if (s.switching && prim) { const target = s.nodes.find((n) => n.name === s.switching)!; if (target.lsn >= prim.lsn) { prim.role = 'replica'; target.role = 'primary'; target.timeline++; s.nodes.forEach((n) => { if (n.role !== 'down') n.timeline = target.timeline; n.sync = false }); s.leader = target.name; s.ttl = TTL; ev(`🔄 Switchover: ${prim.name} toza to'xtatildi (checkpoint), ${target.name} promote → timeline ${target.timeline}. Yo'qotish: 0.`); if (s.syncMode) { const o = s.nodes.find((n) => n.role === 'replica'); if (o) o.sync = true } s.switching = null } }
  if (s.leader && s.ttl <= 0) { ev(`⌛ Leader key muddati tugadi — etcd uni o'chirdi. Replikalar poygasi boshlandi.`); s.leader = null }
  if (!s.leader && !s.nodes.some((n) => n.role === 'primary')) {
    const cands = s.nodes.filter((n) => n.role === 'replica' && (!s.syncMode || n.sync || !s.nodes.some((x) => x.sync && x.role === 'replica')))
    if (cands.length && s.t % 2 === 0) {
      const best = cands.sort((a, b) => b.lsn - a.lsn)[0]
      const lost = Math.max(0, s.lastAck - best.lsn)
      best.role = 'primary'; best.timeline++; best.sync = false; s.leader = best.name; s.ttl = TTL
      s.nodes.forEach((n) => { if (n.role === 'replica') { n.timeline = best.timeline; n.lsn = Math.min(n.lsn, best.lsn) } })
      if (lost) s.lost += lost
      ev(`👑 ${best.name} leader key ni oldi (eng katta LSN: ${best.lsn}) → pg_ctl promote, timeline ${best.timeline}.${lost ? ` ⚠ ${lost} bayt WAL yo'qoldi (async replikatsiya: RPO > 0)` : ' Ma\'lumot yo\'qotilmadi.'}`)
      ev('🔀 HAProxy: GET /primary endi faqat ' + best.name + ' da 200 qaytaradi → trafik qayta yo\'naltirildi.')
      if (s.syncMode) { const o = s.nodes.find((n) => n.role === 'replica'); if (o) { o.sync = true; ev(`${o.name} yangi sinxron replika etib tayinlandi`) } }
    }
  }
  return s
}

export default function Patroni() {
  const [s, setS] = useState<St>(() => init())
  const [run, setRun] = useState(true)
  useEffect(() => { if (!run) return; const t = setInterval(() => setS(tick), 350); return () => clearInterval(t) }, [run])
  const act = (f: (x: St) => St) => setS((x) => f({ ...x, nodes: x.nodes.map((n) => ({ ...n })), events: [...x.events] }))
  const kill = (name: string) => act((x) => { const n = x.nodes.find((k) => k.name === name)!; if (n.role === 'down') { n.role = 'replica'; n.sync = false; const p = x.nodes.find((k) => k.role === 'primary'); const diverged = p && n.lsn > p.lsn; x.events.push(`[${String(x.t).padStart(3)}s] 🔌 ${name} qaytdi. ${diverged ? `Uning WAL i yangi primary dan oldinda (${n.lsn} > ${p!.lsn}) → pg_rewind bilan ortga qaytarildi va ` : ''}replika sifatida qo'shildi (timeline ${p?.timeline ?? n.timeline}).`); if (p) { n.lsn = Math.min(n.lsn, p.lsn); n.timeline = p.timeline } } else { x.events.push(`[${String(x.t).padStart(3)}s] 💥 ${name} (${n.role}) o'chirildi`); n.role = 'down'; n.sync = false } return x })
  const prim = s.nodes.find((n) => n.role === 'primary')
  const hap = prim && s.leader === prim.name ? prim.name : null
  const pos = [{ x: 150, y: 290 }, { x: 400, y: 290 }, { x: 650, y: 290 }]
  return (
    <div className="grid gap-5 @5xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="space-y-3">
        <div className="card flex flex-wrap items-center gap-2 p-3">
          <Button variant="primary" size="sm" onClick={() => setRun((r) => !r)}>{run ? <><Pause size={14} /> Pauza</> : <><Play size={14} /> Davom</>}</Button>
          {s.nodes.map((n) => <Button key={n.name} size="sm" variant={n.role === 'down' ? 'ok' : 'danger'} onClick={() => kill(n.name)}><Power size={13} /> {n.role === 'down' ? `${n.name} ni yoqish` : `${n.name} ni o'chirish`}</Button>)}
          <Button size="sm" disabled={!prim || !!s.switching} onClick={() => act((x) => { const t = x.nodes.filter((n) => n.role === 'replica').sort((a, b) => b.lsn - a.lsn)[0]; if (t) { x.switching = t.name; x.events.push(`[${String(x.t).padStart(3)}s] patronictl switchover --candidate ${t.name}: replika yetib olishi kutilmoqda…`) } return x })}><RefreshCw size={13} /> Switchover</Button>
          <Button size="sm" variant={s.etcdUp < 2 ? 'ok' : 'secondary'} onClick={() => act((x) => { x.etcdUp = x.etcdUp < 2 ? 3 : 1; x.events.push(`[${String(x.t).padStart(3)}s] ${x.etcdUp === 1 ? '💥 2 ta etcd node o\'chdi — quorum yo\'q' : '🔌 etcd tiklandi'}`); return x })}>{s.etcdUp < 2 ? 'etcd ni tiklash' : 'etcd quorum ni buzish'}</Button>
          <label className="ml-auto flex items-center gap-2 text-xs text-muted">synchronous_mode <Switch label="Sinxron rejim" checked={s.syncMode} onCheckedChange={(v) => act((x) => { x.syncMode = v; x.nodes.forEach((n) => (n.sync = false)); if (v) { const r = x.nodes.find((n) => n.role === 'replica'); if (r) r.sync = true } x.events.push(`[${String(x.t).padStart(3)}s] synchronous_mode: ${v ? 'ON — commit sinxron replika tasdig\'ini kutadi' : 'OFF — asinxron'}`); return x })} /></label>
          <Button variant="ghost" size="sm" onClick={() => setS(init(s.syncMode))}><RotateCcw size={13} /></Button>
        </div>
        <div className="card p-2">
          <svg viewBox="0 0 800 400" className="w-full" role="img" aria-label="Patroni klasteri sxemasi">
            <rect x="330" y="14" width="140" height="42" rx="10" fill="hsl(var(--elev))" stroke="hsl(var(--border))" /><text x="400" y="40" textAnchor="middle" fontSize="13" fontWeight="650" fill="hsl(var(--fg))">📱 Ilova</text>
            <line x1="400" y1="56" x2="400" y2="86" stroke={hap ? 'hsl(var(--ok))' : 'hsl(var(--bad))'} strokeWidth="2.5" />
            <rect x="290" y="86" width="220" height="52" rx="12" fill="hsl(var(--info) / .12)" stroke="hsl(var(--info))" strokeWidth="1.5" /><text x="400" y="108" textAnchor="middle" fontSize="13.5" fontWeight="650" fill="hsl(var(--fg))">HAProxy :5000 (RW)</text><text x="400" y="126" textAnchor="middle" fontSize="10.5" fontFamily="JetBrains Mono" fill="hsl(var(--muted))">httpchk GET /primary → :8008</text>
            {s.nodes.map((n, i) => <g key={n.name}><line x1="400" y1="138" x2={pos[i].x} y2={pos[i].y - 52} stroke={hap === n.name ? 'hsl(var(--ok))' : 'hsl(var(--border))'} strokeWidth={hap === n.name ? 3 : 1.5} strokeDasharray={hap === n.name ? '' : '4 5'} />{hap === n.name && s.failed < s.t && <motion.circle r="5" fill="hsl(var(--ok))" animate={{ cx: [400, pos[i].x], cy: [138, pos[i].y - 52] }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }} />}<text x={(400 + pos[i].x) / 2 + (i === 1 ? 26 : 0)} y={(138 + pos[i].y - 52) / 2} textAnchor="middle" fontSize="10.5" fontFamily="JetBrains Mono" fill={hap === n.name ? 'hsl(var(--ok))' : 'hsl(var(--faint))'}>{n.role === 'down' ? '✗' : hap === n.name ? '200' : '503'}</text></g>)}
            {prim && s.nodes.map((n, i) => n.role === 'replica' && <path key={n.name} d={`M${pos[s.nodes.indexOf(prim)].x} ${pos[0].y + 52} Q ${(pos[s.nodes.indexOf(prim)].x + pos[i].x) / 2} ${pos[0].y + 100}, ${pos[i].x} ${pos[0].y + 52}`} fill="none" stroke={n.sync ? 'hsl(var(--warn))' : 'hsl(var(--accent))'} strokeWidth="2" strokeDasharray={n.sync ? '' : '6 4'} />)}
            {s.nodes.map((n, i) => { const c = n.role === 'primary' ? 'hsl(var(--ok))' : n.role === 'replica' ? 'hsl(var(--accent))' : 'hsl(var(--faint))'; return (
              <motion.g key={n.name} animate={{ opacity: n.role === 'down' ? 0.45 : 1 }}>
                <rect x={pos[i].x - 92} y={pos[i].y - 52} width="184" height="104" rx="14" fill="hsl(var(--panel))" stroke={c} strokeWidth={n.role === 'primary' ? 3 : 1.5} strokeDasharray={n.role === 'down' ? '5 5' : ''} />
                <text x={pos[i].x} y={pos[i].y - 28} textAnchor="middle" fontSize="15" fontWeight="700" fill="hsl(var(--fg))">🐘 {n.name}</text>
                <text x={pos[i].x} y={pos[i].y - 9} textAnchor="middle" fontSize="12" fontWeight="650" fill={c}>{n.role === 'primary' ? '👑 PRIMARY' : n.role === 'replica' ? (n.sync ? 'SYNC REPLIKA' : 'REPLIKA (async)') : 'O\'CHIQ'}</text>
                <text x={pos[i].x} y={pos[i].y + 12} textAnchor="middle" fontSize="11" fontFamily="JetBrains Mono" fill="hsl(var(--muted))">LSN 0/{n.lsn.toString(16).toUpperCase().padStart(4, '0')} · TL {n.timeline}</text>
                <text x={pos[i].x} y={pos[i].y + 30} textAnchor="middle" fontSize="10.5" fill="hsl(var(--faint))">{n.role === 'replica' && prim ? `lag: ${prim.lsn - n.lsn} bayt` : n.role === 'primary' ? 'Patroni: leader' : n.role === 'down' ? '' : 'primary kutilmoqda'}</text>
              </motion.g>
            ) })}
            <rect x="590" y="20" width="190" height="80" rx="12" fill="hsl(var(--warn) / .1)" stroke={s.etcdUp >= 2 ? 'hsl(var(--warn))' : 'hsl(var(--bad))'} strokeWidth="1.5" /><text x="685" y="42" textAnchor="middle" fontSize="13" fontWeight="650" fill="hsl(var(--fg))">etcd (DCS) {s.etcdUp}/3</text>
            <text x="685" y="62" textAnchor="middle" fontSize="11" fontFamily="JetBrains Mono" fill="hsl(var(--muted))">/service/pg/leader</text><text x="685" y="80" textAnchor="middle" fontSize="12" fontWeight="700" fontFamily="JetBrains Mono" fill={s.leader ? 'hsl(var(--ok))' : 'hsl(var(--bad))'}>{s.etcdUp < 2 ? 'QUORUM YO\'Q' : s.leader ? `= ${s.leader}  TTL ${Math.max(0, s.ttl)}s` : '(bo\'sh)'}</text>
            <rect x="605" y="88" width={160 * Math.max(0, s.ttl) / TTL} height="5" rx="2" fill={s.ttl < 12 ? 'hsl(var(--bad))' : 'hsl(var(--ok))'} />
          </svg>
        </div>
        <div className="grid grid-cols-4 gap-3">{[['Muvaffaqiyatli yozuvlar', s.writes, ''], ['Yozib bo\'lmagan soniyalar (RTO)', `${s.failed} s`, s.failed ? 'text-warn' : ''], ['Yo\'qotilgan WAL (RPO)', `${s.lost} bayt`, s.lost ? 'text-bad' : 'text-ok'], ['HAProxy → ', hap ?? 'backend yo\'q', hap ? 'text-ok' : 'text-bad']].map(([k, v, c]) => <div key={k as string} className="card p-3"><div className={cn('text-lg font-semibold tabular-nums', c as string)}>{v}</div><div className="text-[11.5px] text-muted">{k}</div></div>)}</div>
      </div>
      <div className="space-y-3">
        <ol className="card h-[420px] space-y-1.5 overflow-y-auto p-3 font-mono text-[11.5px] leading-relaxed" aria-live="polite">{[...s.events].reverse().map((e, i) => <li key={s.events.length - i} className={i === 0 ? 'text-fg' : 'text-muted'}>{e}</li>)}</ol>
        <div className="card space-y-1.5 p-4 text-[12.5px] leading-relaxed text-muted"><b className="text-fg">Sinab ko'ring:</b>
          <p>1. Primary ni o'chiring: ~{TTL}s (TTL) davomida yozuv yo'q, keyin eng katta LSN li replika promote bo'ladi. Async rejimda pg-3 orqada bo'lsa — WAL yo'qoladi.</p>
          <p>2. <b>synchronous_mode</b> ni yoqib takrorlang: RPO = 0, lekin sinxron replikani o'chirsangiz yozuvlar osiladi.</p>
          <p>3. <b>Switchover</b> — rejali: yo'qotishsiz, bir necha soniya.</p>
          <p>4. etcd quorum ni buzing: primary o'zini demote qiladi — DCS siz "kim leader" ni hech kim bilmaydi.</p>
        </div>
      </div>
    </div>
  )
}
