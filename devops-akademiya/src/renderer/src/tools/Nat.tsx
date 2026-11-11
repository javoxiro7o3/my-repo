import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, Switch } from '@/components/ui'

interface Pkt { src: string; sport: number; dst: string; dport: number; smac: string; dmac: string; ttl: number }
interface Stage { at: number; hook: string; title: string; text: string; pkt: Pkt; changed?: (keyof Pkt)[]; drop?: boolean; conntrack?: string; table?: string }
interface Cfg { scenario: 'snat' | 'dnat' | 'local'; forward: boolean; masq: boolean; fwdAccept: boolean; dnatRule: boolean }
// Topologiya: [0] ichki xost — [1] router LAN — [2] router WAN — [3] internet server
const IP = { pc: '192.168.1.10', lan: '192.168.1.1', wan: '203.0.113.5', srv: '198.51.100.7', web: '192.168.1.20' }
const MAC = { pc: 'aa:aa', lan: 'bb:01', wan: 'bb:02', isp: 'cc:cc', srv: 'dd:dd', web: 'ee:ee' }

/** Paketning netfilter hook laridan o'tishini qadamma-qadam hisoblaydi */
export function trace(c: Cfg): Stage[] {
  const st: Stage[] = []
  if (c.scenario === 'local') {
    const p: Pkt = { src: IP.pc, sport: 51234, dst: IP.web, dport: 80, smac: MAC.pc, dmac: MAC.web, ttl: 64 }
    st.push({ at: 0, hook: 'routing (mijozda)', title: 'Manzil o\'z tarmog\'imdami?', text: `${IP.web} AND 255.255.255.0 = 192.168.1.0 — mening tarmog'im bilan bir xil. Demak gateway kerak EMAS: ARP bilan to'g'ridan-to'g'ri ${IP.web} ning MAC ini so'rayman.`, pkt: p, table: '192.168.1.0/24 dev eth0 scope link   ← mos (longest prefix)\ndefault via 192.168.1.1 dev eth0' })
    st.push({ at: 0.5, hook: 'L2 switch', title: 'Switch frame ni MAC bo\'yicha uzatadi', text: 'Router umuman ishtirok etmaydi: iptables FORWARD ham, NAT ham ishlamaydi. Bir segment ichidagi trafikni router firewall i bilan filtrlab bo\'lmaydi — buning uchun VLAN/segmentatsiya kerak.', pkt: p })
    return st
  }
  if (c.scenario === 'snat') {
    let p: Pkt = { src: IP.pc, sport: 51234, dst: IP.srv, dport: 443, smac: MAC.pc, dmac: MAC.lan, ttl: 64 }
    st.push({ at: 0, hook: 'routing (mijozda)', title: 'Mijoz: default gateway ga yuboraman', text: `${IP.srv} mening tarmog'imda emas → default route. DIQQAT: IP manzil o'zgarmaydi (dst = server), faqat frame ning dst MAC i — gateway niki. L3 manzil oxirigacha, L2 manzil har hop da almashadi.`, pkt: p, table: 'default via 192.168.1.1 dev eth0   ← mos\n192.168.1.0/24 dev eth0 scope link' })
    st.push({ at: 1, hook: 'PREROUTING', title: 'Router: paket LAN interfeysiga keldi', text: 'raw → conntrack (yangi ulanish: NEW) → mangle → nat PREROUTING (DNAT qoidalari shu yerda; bu paketga mos qoida yo\'q).', pkt: p, conntrack: `tcp NEW src=${IP.pc} dst=${IP.srv} sport=51234 dport=443 [UNREPLIED]` })
    st.push({ at: 1.5, hook: 'routing qarori', title: 'Bu paket menga emasmi?', text: `dst ${IP.srv} routerning o'z manzili emas → INPUT emas, FORWARD yo'li. Lekin buning uchun net.ipv4.ip_forward=1 bo'lishi shart.`, pkt: p, drop: !c.forward, table: 'default via 203.0.113.1 dev eth1   ← mos\n192.168.1.0/24 dev eth0\n203.0.113.0/24 dev eth1' })
    if (!c.forward) { st[st.length - 1].text += ' ❌ ip_forward=0: yadro "men router emasman" deb paketni JIMGINA tashlaydi. Hech qanday log yo\'q — eng ko\'p uchraydigan xato.'; return st }
    st.push({ at: 1.5, hook: 'FORWARD', title: 'filter FORWARD zanjiri', text: c.fwdAccept ? 'Qoida: -A FORWARD -i eth0 -o eth1 -j ACCEPT → o\'tdi. Qaytish yo\'li uchun: -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT.' : '❌ FORWARD policy DROP va ruxsat beruvchi qoida yo\'q → paket tashlandi. (Docker o\'rnatilgan xostlarda policy aynan DROP!)', pkt: p, drop: !c.fwdAccept })
    if (!c.fwdAccept) return st
    p = { ...p, ttl: 63, smac: MAC.wan, dmac: MAC.isp }
    const after = c.masq ? { ...p, src: IP.wan } : p
    st.push({ at: 2, hook: 'POSTROUTING', title: c.masq ? 'nat POSTROUTING: MASQUERADE' : 'nat POSTROUTING: qoida yo\'q', text: c.masq ? `-t nat -A POSTROUTING -o eth1 -j MASQUERADE: manba ${IP.pc} → ${IP.wan} (chiquvchi interfeys IP si). Bu almashtirish conntrack ga yoziladi — javobni teskari o'girish uchun. TTL 64→63.` : `Manba manzil ${IP.pc} (private) o'zgarishsiz chiqib ketdi. TTL 64→63.`, pkt: after, changed: c.masq ? ['src', 'smac', 'dmac', 'ttl'] : ['smac', 'dmac', 'ttl'], conntrack: c.masq ? `tcp src=${IP.pc} dst=${IP.srv} sport=51234 dport=443\n    src=${IP.srv} dst=${IP.wan} sport=443 dport=51234   ← kutilayotgan javob` : undefined })
    if (!c.masq) { st.push({ at: 3, hook: 'internet', title: 'Server javob bera olmaydi', text: `❌ Server paketni oladi, lekin javobni ${IP.pc} ga yuborishi kerak — bu RFC 1918 manzil, internetda marshrutlanmaydi. Javob hech qachon qaytmaydi: mijozda "connection timed out". tcpdump -i eth1 da private manba ko'rinadi.`, pkt: after, drop: true }); return st }
    st.push({ at: 3, hook: 'server', title: 'Server so\'rovni oladi', text: `Server nuqtai nazaridan mijoz — ${IP.wan}. Ichki tarmoqdagi yuzlab xostlar bitta IP ortida (portlar bilan ajratiladi — aslida bu PAT).`, pkt: { ...after, smac: MAC.isp, dmac: MAC.srv, ttl: 55 } })
    const back: Pkt = { src: IP.srv, sport: 443, dst: IP.wan, dport: 51234, smac: MAC.isp, dmac: MAC.wan, ttl: 55 }
    st.push({ at: 2, hook: 'PREROUTING (javob)', title: 'Javob: conntrack teskari o\'giradi', text: `Javob routerning WAN iga keladi. conntrack yozuvni topadi (ESTABLISHED) va dst ${IP.wan} → ${IP.pc} ga AVTOMATIK qaytaradi. nat jadvali qoidalari faqat birinchi (NEW) paket uchun ishlaydi — qolgani conntrack ishi.`, pkt: { ...back, dst: IP.pc }, changed: ['dst'], conntrack: `tcp ESTABLISHED src=${IP.pc} dst=${IP.srv} sport=51234 dport=443 [ASSURED]` })
    st.push({ at: 0, hook: 'mijoz', title: 'Mijoz javobni oladi ✓', text: 'Mijoz uchun hammasi shaffof: u to\'g\'ridan-to\'g\'ri server bilan gaplashyapman deb o\'ylaydi.', pkt: { ...back, dst: IP.pc, smac: MAC.lan, dmac: MAC.pc, ttl: 54 } })
    return st
  }
  // DNAT / port forwarding
  let p: Pkt = { src: IP.srv, sport: 40111, dst: IP.wan, dport: 8080, smac: MAC.isp, dmac: MAC.wan, ttl: 55 }
  st.push({ at: 3, hook: 'internet', title: 'Tashqi mijoz routerning public IP siga murojaat qiladi', text: `Maqsad: ${IP.wan}:8080 → ichki veb-server ${IP.web}:80.`, pkt: { ...p, smac: MAC.srv, dmac: MAC.isp, ttl: 64 } })
  const dn = c.dnatRule ? { ...p, dst: IP.web, dport: 80 } : p
  st.push({ at: 2, hook: 'PREROUTING', title: c.dnatRule ? 'nat PREROUTING: DNAT' : 'nat PREROUTING: qoida yo\'q', text: c.dnatRule ? `-t nat -A PREROUTING -i eth1 -p tcp --dport 8080 -j DNAT --to-destination ${IP.web}:80. DNAT aynan PREROUTING da — routing qaroridan OLDIN — bo'lishi shart: aks holda yadro paketni "o'zimga" deb INPUT ga yuborardi.` : 'DNAT qoidasi yo\'q — manzil o\'zgarmadi.', pkt: dn, changed: c.dnatRule ? ['dst', 'dport'] : [], conntrack: c.dnatRule ? `tcp NEW src=${IP.srv} dst=${IP.wan} dport=8080\n    → dst=${IP.web} dport=80` : undefined })
  if (!c.dnatRule) { st.push({ at: 2, hook: 'INPUT', title: 'Paket routerning o\'ziga', text: `❌ dst = routerning o'z IP si → INPUT zanjiri. 8080 da hech narsa tinglamayapti → RST ("connection refused") yoki firewall DROP (timeout).`, pkt: p, drop: true }); return st }
  st.push({ at: 1.5, hook: 'routing qarori', title: 'Yangi manzil bo\'yicha marshrut', text: `dst endi ${IP.web} → LAN interfeysi orqali FORWARD.`, pkt: dn, drop: !c.forward, table: '192.168.1.0/24 dev eth0   ← mos' })
  if (!c.forward) { st[st.length - 1].text += ' ❌ ip_forward=0 → tashlandi.'; return st }
  st.push({ at: 1.5, hook: 'FORWARD', title: 'filter FORWARD', text: c.fwdAccept ? `Qoida DNAT dan KEYINGI manzilga yoziladi: -A FORWARD -d ${IP.web} -p tcp --dport 80 -j ACCEPT (8080 emas!).` : `❌ DNAT bor, lekin FORWARD da ruxsat yo'q → DROP. "DNAT qoidasi bor, lekin ishlamayapti" ning klassik sababi. Tekshirish: iptables -L FORWARD -v -n (hisoblagichlar).`, pkt: dn, drop: !c.fwdAccept })
  if (!c.fwdAccept) return st
  st.push({ at: 0, hook: 'ichki server', title: 'Veb-server so\'rovni oladi', text: `Manba — haqiqiy mijoz IP si (${IP.srv}): loglarda to'g'ri ko'rinadi. Server javobni default gateway (router) orqali yuboradi — conntrack src ni ${IP.web}:80 → ${IP.wan}:8080 ga qaytaradi. Agar serverning gateway i boshqa bo'lsa — javob boshqa yo'ldan ketib, ulanish buziladi (asimmetrik marshrut).`, pkt: { ...dn, smac: MAC.lan, dmac: MAC.web, ttl: 54 }, changed: ['smac', 'dmac', 'ttl'] })
  return st
}

const XS = [90, 330, 470, 710]
export default function Nat() {
  const [cfg, setCfg] = useState<Cfg>({ scenario: 'snat', forward: true, masq: true, fwdAccept: true, dnatRule: true })
  const [i, setI] = useState(0)
  const stages = useMemo(() => trace(cfg), [cfg])
  const s = stages[Math.min(i, stages.length - 1)]
  const set = (p: Partial<Cfg>) => { setCfg({ ...cfg, ...p }); setI(0) }
  const x = s.at <= 1 ? XS[0] + (XS[1] - XS[0]) * s.at : s.at <= 2 ? XS[1] + (XS[2] - XS[1]) * (s.at - 1) : XS[2] + (XS[3] - XS[2]) * (s.at - 2)
  const F = ({ k, label }: { k: keyof Pkt; label: string }) => <div className={cn('rounded-lg border px-2.5 py-1.5', s.changed?.includes(k) ? 'border-warn bg-warn/15' : 'bg-elev/50')}><div className="text-[10px] text-faint">{label}</div><div className="font-mono text-[12.5px] font-semibold">{s.pkt[k]}{s.changed?.includes(k) && <span className="ml-1 text-warn">✎</span>}</div></div>
  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-x-5 gap-y-2 p-3">
        <div className="flex gap-1">{([['snat', 'Ichkaridan internetga (SNAT)'], ['dnat', 'Tashqaridan ichkariga (DNAT)'], ['local', 'Bir tarmoq ichida']] as const).map(([v, l]) => <button key={v} onClick={() => set({ scenario: v })} className={cn('rounded-lg px-3 py-1.5 text-[13px] font-medium transition', cfg.scenario === v ? 'bg-accent/15 text-fg' : 'text-muted hover:bg-elev')}>{l}</button>)}</div>
        {cfg.scenario !== 'local' && <>
          <label className="flex items-center gap-2 text-[12.5px]"><Switch label="ip_forward" checked={cfg.forward} onCheckedChange={(v) => set({ forward: v })} /> <code className="font-mono">ip_forward=1</code></label>
          <label className="flex items-center gap-2 text-[12.5px]"><Switch label="FORWARD ACCEPT" checked={cfg.fwdAccept} onCheckedChange={(v) => set({ fwdAccept: v })} /> FORWARD ACCEPT</label>
          {cfg.scenario === 'snat' ? <label className="flex items-center gap-2 text-[12.5px]"><Switch label="MASQUERADE" checked={cfg.masq} onCheckedChange={(v) => set({ masq: v })} /> MASQUERADE</label> : <label className="flex items-center gap-2 text-[12.5px]"><Switch label="DNAT qoidasi" checked={cfg.dnatRule} onCheckedChange={(v) => set({ dnatRule: v })} /> DNAT qoidasi</label>}
        </>}
      </div>
      <div className="card p-2">
        <svg viewBox="0 0 800 210" className="w-full" role="img" aria-label="Tarmoq topologiyasi">
          <line x1={XS[0]} y1="100" x2={XS[3]} y2="100" stroke="hsl(var(--border))" strokeWidth="3" />
          <rect x="250" y="42" width="300" height="116" rx="16" fill="hsl(var(--accent) / .07)" stroke="hsl(var(--accent) / .5)" strokeDasharray="6 5" /><text x="400" y="62" textAnchor="middle" fontSize="12" fontWeight="700" fill="hsl(var(--accent))">LINUX ROUTER (netfilter)</text>
          {[['PREROUTING', 290], ['FORWARD', 400], ['POSTROUTING', 510]].map(([h, hx]) => <g key={h}><rect x={(hx as number) - 46} y="118" width="92" height="24" rx="6" fill={s.hook.startsWith(h as string) ? 'hsl(var(--accent))' : 'hsl(var(--elev))'} /><text x={hx} y="134" textAnchor="middle" fontSize="10" fontWeight="700" fontFamily="JetBrains Mono" fill={s.hook.startsWith(h as string) ? 'hsl(var(--accent-fg))' : 'hsl(var(--muted))'}>{h}</text></g>)}
          {[[XS[0], '💻', cfg.scenario === 'dnat' ? 'Veb-server' : 'Mijoz', cfg.scenario === 'dnat' ? IP.web : IP.pc], [XS[1], '', 'eth0 (LAN)', IP.lan], [XS[2], '', 'eth1 (WAN)', IP.wan], [XS[3], '🌐', cfg.scenario === 'dnat' ? 'Tashqi mijoz' : 'Server', IP.srv]].map(([cx, ic, n, ip], k) => <g key={k}><circle cx={cx as number} cy="100" r={ic ? 26 : 9} fill="hsl(var(--panel))" stroke="hsl(var(--border))" strokeWidth="2" />{ic && <text x={cx as number} y="108" textAnchor="middle" fontSize="22">{ic}</text>}<text x={cx as number} y={ic ? 150 : 84} textAnchor="middle" fontSize="11.5" fontWeight="600" fill="hsl(var(--fg))">{n}</text><text x={cx as number} y={ic ? 166 : 182} textAnchor="middle" fontSize="10.5" fontFamily="JetBrains Mono" fill="hsl(var(--muted))">{ip}</text></g>)}
          <text x="210" y="92" textAnchor="middle" fontSize="10" fill="hsl(var(--faint))">192.168.1.0/24</text><text x="590" y="92" textAnchor="middle" fontSize="10" fill="hsl(var(--faint))">internet</text>
          <motion.g animate={{ x, opacity: 1 }} initial={false} transition={{ type: 'spring', stiffness: 120, damping: 18 }}><rect x="-17" y="86" width="34" height="28" rx="6" fill={s.drop ? 'hsl(var(--bad))' : 'hsl(var(--warn))'} /><text x="0" y="105" textAnchor="middle" fontSize="15">{s.drop ? '✗' : '✉'}</text></motion.g>
        </svg>
      </div>
      <div className="grid gap-4 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <motion.div key={`${i}-${cfg.scenario}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn('card p-5', s.drop && 'border-bad/50')} aria-live="polite">
          <div className="mb-1 flex items-center justify-between"><span className="chip font-mono">{s.hook}</span><span className="text-xs tabular-nums text-faint">{i + 1} / {stages.length}</span></div>
          <h3 className="mt-2 text-[16px] font-semibold">{s.title}</h3><p className="mt-2 text-[13.5px] leading-relaxed text-muted">{s.text}</p>
          <div className="mt-4 flex gap-2"><Button size="icon" disabled={!i} onClick={() => setI(i - 1)} aria-label="Oldingi"><ChevronLeft size={16} /></Button><Button variant="primary" disabled={i >= stages.length - 1} onClick={() => setI(i + 1)}>Keyingi qadam <ChevronRight size={15} /></Button><Button variant="ghost" size="icon" onClick={() => setI(0)} aria-label="Boshidan"><RotateCcw size={14} /></Button></div>
        </motion.div>
        <div className="space-y-3">
          <div className="card p-4"><div className="label mb-2">Paket sarlavhalari</div><div className="grid grid-cols-2 gap-2"><F k="src" label="L3: manba IP" /><F k="dst" label="L3: manzil IP" /><F k="sport" label="L4: manba port" /><F k="dport" label="L4: manzil port" /><F k="smac" label="L2: manba MAC" /><F k="dmac" label="L2: manzil MAC" /></div><div className="mt-2 text-[11px] text-faint">TTL: {s.pkt.ttl} · <span className="text-warn">✎</span> — shu qadamda o'zgardi</div></div>
          {s.table && <div className="card p-4"><div className="label mb-2">Routing jadvali (ip route)</div><pre className="overflow-x-auto font-mono text-[11.5px] leading-relaxed">{s.table}</pre></div>}
          {s.conntrack && <div className="card p-4"><div className="label mb-2">conntrack -L</div><pre className="overflow-x-auto font-mono text-[11.5px] leading-relaxed">{s.conntrack}</pre></div>}
        </div>
      </div>
    </div>
  )
}
