import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Plus, Shuffle, Trash2, X } from 'lucide-react'
import { intToIp, split, v4info, v6info, vlsm, maskFromPrefix, toBits } from '@shared/subnet'
import { cn, fmt } from '@/lib/utils'
import { Button, Segmented } from '@/components/ui'

const safe = <T,>(f: () => T): { v?: T; e?: string } => { try { return { v: f() } } catch (e: any) { return { e: e.message } } }
const Field = ({ k, v, mono = true, accent }: { k: string; v: React.ReactNode; mono?: boolean; accent?: boolean }) => <div className="flex items-baseline justify-between gap-4 py-1.5 text-[13.5px]"><span className="text-muted">{k}</span><span className={cn(mono && 'font-mono', accent && 'font-semibold text-accent')}>{v}</span></div>

function Bits({ bits, prefix, label }: { bits: string; prefix: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-xs text-muted">{label}</span>
      <div className="flex gap-2">{[0, 1, 2, 3].map((o) => (
        <div key={o} className="flex gap-[2px]">{bits.slice(o * 8, o * 8 + 8).split('').map((b, i) => { const idx = o * 8 + i; return <motion.span layout key={i} className={cn('flex h-7 w-[22px] items-center justify-center rounded font-mono text-[12.5px] font-semibold', idx < prefix ? 'bg-accent/25 text-fg' : 'bg-ok/15 text-ok')}>{b}</motion.span> })}</div>
      ))}</div>
      <span className="font-mono text-xs text-faint">{[0, 1, 2, 3].map((o) => parseInt(bits.slice(o * 8, o * 8 + 8), 2)).join('.')}</span>
    </div>
  )
}

function V4() {
  const [cidr, setCidr] = useState('192.168.10.77/26')
  const [np, setNp] = useState(28)
  const r = useMemo(() => safe(() => v4info(cidr)), [cidr])
  const i = r.v
  const parts = useMemo(() => (i && np >= i.prefix ? safe(() => split(`${i.network}/${i.prefix}`, np)) : { e: 'Yangi prefiks kattaroq bo\'lishi kerak' }), [i, np])
  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <input value={cidr} onChange={(e) => setCidr(e.target.value)} className="input w-64 font-mono text-[15px]" aria-label="IPv4 CIDR" spellCheck={false} />
          {i && <input type="range" min={0} max={32} value={i.prefix} onChange={(e) => setCidr(`${i.ip}/${e.target.value}`)} className="w-56 accent-[hsl(var(--accent))]" aria-label="Prefiks uzunligi" />}
          {i && <span className="font-mono text-sm text-muted">/{i.prefix}</span>}
          {['10.0.0.0/8', '172.16.5.4/20', '192.168.1.130/26', '100.64.0.1/10', '203.0.113.9/30'].map((x) => <button key={x} onClick={() => setCidr(x)} className="chip font-mono hover:border-accent hover:text-fg">{x}</button>)}
        </div>
        {r.e && <p className="mt-3 text-sm text-bad" role="alert">{r.e}</p>}
      </div>
      {i && <>
        <div className="grid gap-5 @4xl:grid-cols-2">
          <div className="card divide-y px-5 py-3">
            <Field k="Tarmoq manzili (network)" v={`${i.network}/${i.prefix}`} accent /><Field k="Niqob (subnet mask)" v={i.mask} /><Field k="Wildcard" v={i.wildcard} /><Field k="Broadcast" v={i.broadcast} />
            <Field k="Birinchi host" v={i.first} /><Field k="Oxirgi host" v={i.last} /><Field k="Hostlar soni" v={`${fmt(i.hosts)}  (2^${32 - i.prefix}${i.prefix < 31 ? ' − 2' : ''})`} /><Field k="Sinf (tarixiy)" v={i.cls} mono={false} /><Field k="Turi" v={i.scope} mono={false} />
          </div>
          <div className="card space-y-3 overflow-x-auto p-5">
            <div className="label">Bit-xarita</div>
            <Bits bits={i.ipBits} prefix={i.prefix} label="IP manzil" /><Bits bits={i.maskBits} prefix={i.prefix} label="Niqob" /><Bits bits={toBits(i.netInt)} prefix={i.prefix} label="AND → tarmoq" /><Bits bits={toBits(i.bcInt)} prefix={i.prefix} label="Broadcast" />
            <div className="flex gap-4 pt-1 text-xs"><span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-accent/40" /> tarmoq qismi ({i.prefix} bit)</span><span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-ok/30" /> host qismi ({32 - i.prefix} bit)</span></div>
            <p className="text-[12.5px] leading-relaxed text-muted">Tarmoq manzili = IP <b>AND</b> niqob (host bitlari 0). Broadcast = host bitlarining hammasi 1. {i.prefix < 31 ? 'Shu ikki manzil hostga berilmaydi — shuning uchun "−2".' : i.prefix === 31 ? '/31 — nuqtadan-nuqtaga ulanish (RFC 3021): ikkala manzil ham ishlatiladi.' : '/32 — bitta host (masalan loopback yoki marshrut).'}</p>
          </div>
        </div>
        <div className="card p-5">
          <div className="mb-3 flex flex-wrap items-center gap-3"><span className="text-sm font-medium">Teng bo'lish:</span><span className="font-mono text-sm">{i.network}/{i.prefix} →</span><select value={np} onChange={(e) => setNp(+e.target.value)} className="input w-auto font-mono" aria-label="Yangi prefiks">{Array.from({ length: 32 - i.prefix }, (_, k) => i.prefix + k + 1).filter((p) => p - i.prefix <= 8).map((p) => <option key={p} value={p}>/{p} — {2 ** (p - i.prefix)} ta subnet × {fmt(Math.max(2 ** (32 - p) - 2, p === 31 ? 2 : 1))} host</option>)}</select></div>
          {'v' in parts && parts.v ? <div className="flex flex-wrap gap-1.5">{parts.v.slice(0, 64).map((p, k) => <button key={p} onClick={() => setCidr(p)} className="rounded-md border px-2 py-1 font-mono text-[11.5px] transition hover:border-accent" style={{ background: `hsl(${(k * 47) % 360} 70% 55% / .12)` }}>{p}</button>)}{parts.v.length > 64 && <span className="chip">… yana {parts.v.length - 64} ta</span>}</div> : <p className="text-sm text-muted">Bo'lish uchun kattaroq prefiks tanlang.</p>}
        </div>
      </>}
    </div>
  )
}

function Vlsm() {
  const [base, setBase] = useState('10.20.0.0/22')
  const [needs, setNeeds] = useState([{ name: 'Ishlab chiqarish', hosts: 200 }, { name: 'Ofis', hosts: 100 }, { name: 'DMZ', hosts: 50 }, { name: 'Router ↔ Router', hosts: 2 }])
  const r = useMemo(() => safe(() => vlsm(base, needs.filter((n) => n.hosts > 0))), [base, needs])
  const b = useMemo(() => safe(() => v4info(base)), [base])
  return (
    <div className="space-y-5">
      <div className="card space-y-3 p-5">
        <div className="flex items-center gap-3"><span className="text-sm font-medium">Asosiy blok:</span><input value={base} onChange={(e) => setBase(e.target.value)} className="input w-56 font-mono" aria-label="Asosiy blok" /></div>
        {needs.map((n, k) => <div key={k} className="flex items-center gap-2"><input value={n.name} onChange={(e) => setNeeds(needs.map((x, j) => (j === k ? { ...x, name: e.target.value } : x)))} className="input w-64" aria-label="Segment nomi" /><input type="number" min={1} value={n.hosts} onChange={(e) => setNeeds(needs.map((x, j) => (j === k ? { ...x, hosts: +e.target.value } : x)))} className="input w-28 font-mono" aria-label="Hostlar soni" /><span className="text-xs text-faint">host</span><Button variant="ghost" size="iconSm" onClick={() => setNeeds(needs.filter((_, j) => j !== k))} aria-label="O'chirish"><Trash2 size={13} /></Button></div>)}
        <Button size="sm" onClick={() => setNeeds([...needs, { name: `Segment ${needs.length + 1}`, hosts: 10 }])}><Plus size={13} /> Segment qo'shish</Button>
      </div>
      {r.e ? <p className="rounded-lg border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad" role="alert">{r.e}</p> : r.v && b.v && <>
        <div className="card p-5"><div className="label mb-2">Manzil maydoni ({fmt(b.v.total)} ta manzil)</div><div className="flex h-10 overflow-hidden rounded-lg border bg-elev">{r.v.map((x, k) => <motion.div key={x.cidr} initial={{ width: 0 }} animate={{ width: `${(2 ** (32 - x.prefix) / b.v!.total) * 100}%` }} className="flex items-center justify-center overflow-hidden border-r text-[10.5px] font-medium" style={{ background: `hsl(${(k * 67 + 240) % 360} 70% 55% / .35)` }} title={`${x.name}: ${x.cidr}`}>{x.name}</motion.div>)}<div className="flex flex-1 items-center justify-center text-[10.5px] text-faint">bo'sh</div></div></div>
        <div className="card overflow-x-auto"><table className="w-full text-[13px]"><thead><tr className="border-b bg-elev/60 text-left">{['Segment', 'Kerak', 'Subnet', 'Niqob', 'Hostlar oralig\'i', 'Broadcast', 'Sig\'im', 'Isrof'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y font-mono">{r.v.map((x) => <tr key={x.cidr}><td className="px-3 py-2 font-sans">{x.name}</td><td className="px-3 py-2">{x.need}</td><td className="px-3 py-2 font-semibold text-accent">{x.cidr}</td><td className="px-3 py-2">{intToIp(maskFromPrefix(x.prefix))}</td><td className="px-3 py-2">{x.first} – {x.last}</td><td className="px-3 py-2">{x.broadcast}</td><td className="px-3 py-2">{x.hosts}</td><td className="px-3 py-2 text-faint">{x.hosts - x.need}</td></tr>)}</tbody></table></div>
        <p className="text-[13px] leading-relaxed text-muted">VLSM qoidasi: <b>eng katta ehtiyojdan boshlang</b>. Har segment uchun 2^h − 2 ≥ kerakli hostlar bo'ladigan eng kichik h tanlanadi; subnet o'z o'lchamiga karrali chegarada boshlanishi shart.</p>
      </>}
    </div>
  )
}

function Practice() {
  const gen = () => { const p = 20 + Math.floor(Math.random() * 11); const ip = [10 + Math.floor(Math.random() * 180), Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), 1 + Math.floor(Math.random() * 254)].join('.'); return `${ip}/${p}` }
  const [q, setQ] = useState(gen)
  const [a, setA] = useState({ network: '', broadcast: '', hosts: '' })
  const [checked, setChecked] = useState(false)
  const [score, setScore] = useState({ ok: 0, all: 0 })
  const i = v4info(q)
  const ok = { network: a.network.trim() === i.network, broadcast: a.broadcast.trim() === i.broadcast, hosts: a.hosts.trim() === String(i.hosts) }
  const check = () => { setChecked(true); setScore((s) => ({ ok: s.ok + (ok.network && ok.broadcast && ok.hosts ? 1 : 0), all: s.all + 1 })) }
  return (
    <div className="card mx-auto max-w-2xl p-6">
      <div className="mb-4 flex items-center justify-between"><div><div className="label">Mashq — qog'ozda hisoblang</div><div className="mt-1 font-mono text-2xl font-semibold">{q}</div></div><span className="chip tabular-nums">{score.ok} / {score.all} to'g'ri</span></div>
      {(['network', 'broadcast', 'hosts'] as const).map((k) => (
        <label key={k} className="mb-3 block"><span className="mb-1 block text-sm text-muted">{{ network: 'Tarmoq manzili', broadcast: 'Broadcast manzili', hosts: 'Foydalanish mumkin bo\'lgan hostlar soni' }[k]}</span>
          <div className="flex items-center gap-2"><input value={a[k]} disabled={checked} onChange={(e) => setA({ ...a, [k]: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && !checked && check()} className={cn('input font-mono', checked && (ok[k] ? 'border-ok' : 'border-bad'))} />{checked && (ok[k] ? <Check size={18} className="text-ok" /> : <span className="flex items-center gap-1 whitespace-nowrap font-mono text-sm text-bad"><X size={16} /> {String(i[k])}</span>)}</div>
        </label>
      ))}
      {checked && <div className="mb-3 rounded-lg border bg-elev/60 p-3 text-[13px] leading-relaxed text-muted">Yechim: /{i.prefix} → niqob {i.mask}. "Qiziq" oktet — {Math.floor((i.prefix - 1) / 8) + 1}-chi; blok o'lchami = {2 ** ((8 - (i.prefix % 8)) % 8)}. Tarmoq manzili shu oktetda blok o'lchamiga karrali eng yaqin kichik son. Hostlar: 2^{32 - i.prefix} − 2 = {i.hosts}.</div>}
      <div className="flex gap-2">{!checked ? <Button variant="primary" onClick={check}>Tekshirish</Button> : <Button variant="primary" onClick={() => { setQ(gen()); setA({ network: '', broadcast: '', hosts: '' }); setChecked(false) }}><Shuffle size={14} /> Keyingi mashq</Button>}</div>
    </div>
  )
}

function V6() {
  const [cidr, setCidr] = useState('2001:db8:85a3::8a2e:370:7334/64')
  const r = useMemo(() => safe(() => v6info(cidr)), [cidr])
  return (
    <div className="space-y-5">
      <div className="card flex flex-wrap items-center gap-3 p-5"><input value={cidr} onChange={(e) => setCidr(e.target.value)} className="input w-[420px] font-mono" aria-label="IPv6 CIDR" spellCheck={false} />{['fe80::1/64', 'fd12:3456:789a::1/48', '::1/128', 'ff02::1/8', '2a01:4f8::2/56'].map((x) => <button key={x} onClick={() => setCidr(x)} className="chip font-mono hover:border-accent hover:text-fg">{x}</button>)}</div>
      {r.e ? <p className="text-sm text-bad" role="alert">{r.e}</p> : r.v && <>
        <div className="card divide-y px-5 py-3"><Field k="To'liq yozuv" v={r.v.full} /><Field k="Qisqa yozuv" v={r.v.short} accent /><Field k="Tarmoq (prefiks)" v={r.v.network} /><Field k="Oxirgi manzil" v={r.v.lastAddr} /><Field k="Manzillar soni" v={r.v.count} /><Field k="Turi" v={r.v.type} mono={false} /></div>
        <div className="card overflow-x-auto p-5"><div className="label mb-3">128 bit — 8 ta guruh × 16 bit</div><div className="flex flex-wrap gap-2">{r.v.full.split(':').map((g, k) => <div key={k} className="text-center"><div className="mb-1 font-mono text-[13px] font-semibold">{g}</div><div className="flex gap-px">{r.v!.bits.slice(k * 16, k * 16 + 16).split('').map((b, j) => <span key={j} className={cn('flex h-5 w-[9px] items-center justify-center font-mono text-[9px]', k * 16 + j < r.v!.prefix ? 'bg-accent/30' : 'bg-ok/15 text-ok')}>{b}</span>)}</div></div>)}</div>
          <p className="mt-4 text-[12.5px] leading-relaxed text-muted">Qisqartirish qoidalari: (1) har guruhdagi boshlang'ich nollar tashlanadi; (2) ketma-ket nol guruhlarning eng uzuni <b>bir marta</b> "::" bilan almashtiriladi. Odatiy LAN prefiksi /64: 64 bit tarmoq + 64 bit interfeys ID (SLAAC).</p></div>
      </>}
    </div>
  )
}

export default function Subnet() {
  const [tab, setTab] = useState<'v4' | 'vlsm' | 'practice' | 'v6'>('v4')
  return <div className="space-y-5"><Segmented label="Rejim" value={tab} onChange={setTab} options={[{ value: 'v4', label: 'IPv4 kalkulyator' }, { value: 'vlsm', label: 'VLSM rejalashtirish' }, { value: 'practice', label: 'Mashq' }, { value: 'v6', label: 'IPv6' }]} />{tab === 'v4' ? <V4 /> : tab === 'vlsm' ? <Vlsm /> : tab === 'practice' ? <Practice /> : <V6 />}</div>
}
