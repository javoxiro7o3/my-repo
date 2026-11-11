import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Segmented, Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import SequencePlayer, { type SeqDef } from './SequencePlayer'

const LAYERS = [
  { n: 7, name: 'Application', tcp: 'Application', pdu: 'Ma\'lumot (data)', proto: 'HTTP, DNS, SSH, SMTP', color: '#a855f7', hdr: '', what: 'Ilova o\'z protokolida xabar tuzadi. Masalan brauzer: "GET /index.html HTTP/1.1".', dev: 'Ilova, L7 load balancer (nginx, HAProxy http rejimi)' },
  { n: 6, name: 'Presentation', tcp: 'Application', pdu: 'Ma\'lumot', proto: 'TLS, JSON, gzip', color: '#8b5cf6', hdr: 'TLS', what: 'Kodlash, siqish va shifrlash. TLS yozuvi (record) ilova ma\'lumotini shifrlab o\'raydi.', dev: '—' },
  { n: 5, name: 'Session', tcp: 'Application', pdu: 'Ma\'lumot', proto: 'TLS sessiya, RPC', color: '#6366f1', hdr: '', what: 'Aloqa seansini ochish, ushlab turish, yopish. TCP/IP modelida alohida qatlam emas.', dev: '—' },
  { n: 4, name: 'Transport', tcp: 'Transport', pdu: 'Segment (TCP) / Datagram (UDP)', proto: 'TCP, UDP, QUIC', color: '#0ea5e9', hdr: 'TCP', what: 'Portlar (qaysi ilova), ketma-ketlik raqamlari, ishonchlilik. TCP header: src port, dst port, seq, ack, flags, window. MSS odatda 1460 bayt.', dev: 'L4 load balancer, firewall (port bo\'yicha)' },
  { n: 3, name: 'Network', tcp: 'Internet', pdu: 'Paket (packet)', proto: 'IPv4, IPv6, ICMP', color: '#10b981', hdr: 'IP', what: 'Mantiqiy manzillash va marshrutlash. IP header: src IP, dst IP, TTL, protocol. Har router TTL ni 1 ga kamaytiradi.', dev: 'Router, L3 switch' },
  { n: 2, name: 'Data Link', tcp: 'Link', pdu: 'Kadr (frame)', proto: 'Ethernet, 802.1Q (VLAN), ARP', color: '#f59e0b', hdr: 'ETH', what: 'Bitta segment ichida yetkazish. Ethernet header: dst MAC, src MAC, EtherType; oxirida FCS (xatolik tekshiruvi). MTU 1500 bayt.', dev: 'Switch, bridge' },
  { n: 1, name: 'Physical', tcp: 'Link', pdu: 'Bitlar', proto: 'Mis kabel, optika, Wi-Fi', color: '#ef4444', hdr: '', what: 'Bitlarni elektr/yorug\'lik/radio signaliga aylantirish.', dev: 'Kabel, hub, transiver' }
]

const TCP: SeqDef = {
  actors: [{ name: 'Mijoz', sub: '192.168.1.10:51234', icon: '💻' }, { name: 'Server', sub: '93.184.216.34:443', icon: '🖥️' }],
  steps: [
    { from: 0, to: 1, label: 'SYN', detail: 'Mijoz ulanish so\'raydi va o\'zining boshlang\'ich ketma-ketlik raqamini (ISN) e\'lon qiladi. Holati: CLOSED → SYN_SENT. Server tomonda ulanish "SYN queue" (yarim ochiq) ga tushadi.', data: 'Flags: [S]\nseq = 1000 (mijoz ISN)\nwin = 64240, MSS = 1460\ntcpdump: Flags [S], seq 1000, win 64240' },
    { from: 1, to: 0, label: 'SYN + ACK', detail: 'Server rozi: mijozning SYN ini tasdiqlaydi (ack = 1001) va o\'z ISN ini yuboradi. Holati: LISTEN → SYN_RCVD. Javob kelmasa — port yopiq (RST) yoki firewall DROP qilgan (timeout).', data: 'Flags: [S.]\nseq = 5000 (server ISN)\nack = 1001 (mijoz seq + 1)' },
    { from: 0, to: 1, label: 'ACK', detail: 'Mijoz server ISN ini tasdiqlaydi. Ikkala tomon ESTABLISHED. Server ulanishni "accept queue" ga o\'tkazadi — ilova accept() bilan oladi. Uch qadam nega kerak: ikki tomon ham bir-birining ISN ini tasdiqlashi shart.', data: 'Flags: [.]\nseq = 1001, ack = 5001' },
    { from: 0, to: 1, label: 'Ma\'lumot (PSH, ACK)', detail: 'Mijoz 120 bayt yuboradi. seq — yuborilayotgan birinchi baytning raqami.', data: 'Flags: [P.]\nseq = 1001, len = 120' },
    { from: 1, to: 0, label: 'ACK (ack = 1121)', detail: 'Server "1121-baytgacha oldim, keyingisini kutaman" deydi. ACK kelmasa mijoz RTO (retransmission timeout) dan keyin qayta yuboradi; 3 ta takroriy ACK — fast retransmit.', data: 'Flags: [.]\nack = 1121, win = 65000 (qabul oynasi)' },
    { from: 0, to: 1, label: 'FIN', detail: 'Mijoz "men yuborib bo\'ldim" deydi. Yopilish 4 qadamli, chunki har yo\'nalish alohida yopiladi (half-close).', data: 'Flags: [F.]\nHolat: FIN_WAIT_1' },
    { from: 1, to: 0, label: 'ACK', detail: 'Server FIN ni tasdiqlaydi; hali o\'zi ma\'lumot yuborishi mumkin (CLOSE_WAIT).', data: 'Flags: [.]' },
    { from: 1, to: 0, label: 'FIN', detail: 'Server ham yopadi (LAST_ACK).', data: 'Flags: [F.]' },
    { from: 0, to: 1, label: 'ACK → TIME_WAIT', detail: 'Mijoz oxirgi ACK ni yuborib, 2×MSL (Linux da 60 s) TIME_WAIT holatida turadi: kechikkan paketlar yangi ulanishga aralashmasligi va oxirgi ACK yo\'qolsa qayta yuborish uchun.', data: 'Flags: [.]\nss -tan | grep TIME-WAIT' }
  ]
}
const TLS: SeqDef = {
  actors: [{ name: 'Mijoz', sub: 'brauzer / curl', icon: '💻' }, { name: 'Server', sub: 'nginx :443', icon: '🔒' }],
  steps: [
    { from: 0, to: 1, label: 'ClientHello', detail: 'TCP ulanish o\'rnatilgach, mijoz qo\'llaydigan shifrlar ro\'yxati, tasodifiy son, SNI (qaysi domen) va TLS 1.3 da darhol o\'zining vaqtinchalik ochiq kalitini (key_share) yuboradi. SNI ochiq ketadi — shuning uchun nginx bitta IP da ko\'p sertifikat bera oladi.', data: 'supported_versions: TLS 1.3\ncipher_suites: TLS_AES_256_GCM_SHA384, ...\nserver_name (SNI): example.uz\nkey_share: X25519 ochiq kalit' },
    { from: 1, to: 0, label: 'ServerHello', detail: 'Server shifrni tanlaydi va o\'z key_share ini yuboradi. Shu ondan ikkala tomon ECDHE orqali bir xil umumiy sirni hisoblay oladi — sir tarmoq orqali hech qachon uzatilmaydi.', data: 'cipher: TLS_AES_256_GCM_SHA384\nkey_share: X25519 ochiq kalit', color: 'hsl(var(--info))' },
    { from: 1, to: 1, label: 'Kalitlar hosil qilinadi', detail: 'Ikkala tomon: umumiy sir = X25519(o\'z maxfiy kaliti, qarshi tomon ochiq kaliti) → HKDF → handshake kalitlari. Bundan keyingi barcha xabarlar SHIFRLANGAN. Kalitlar vaqtinchalik — bu forward secrecy beradi: server maxfiy kaliti keyin o\'g\'irlansa ham eski trafik ochilmaydi.' },
    { from: 1, to: 0, label: 'Certificate 🔐', detail: 'Server sertifikat zanjirini yuboradi (leaf + intermediate). Mijoz tekshiradi: (1) imzo zanjiri ishonchli root CA gacha boradimi, (2) domen SAN ro\'yxatida bormi, (3) muddati o\'tmaganmi.', data: 'subject: CN=example.uz\nSAN: example.uz, www.example.uz\nissuer: Let\'s Encrypt R11\nnotAfter: 90 kun', color: 'hsl(var(--ok))' },
    { from: 1, to: 0, label: 'CertificateVerify 🔐', detail: 'Server butun handshake transkriptini o\'z maxfiy kaliti bilan imzolaydi. Bu "sertifikat haqiqatan menga tegishli" isboti — faqat sertifikatni ko\'rsatish yetarli emas, uning maxfiy kalitiga egalikni isbotlash kerak.', color: 'hsl(var(--ok))' },
    { from: 1, to: 0, label: 'Finished 🔐', detail: 'Transkript ustidan MAC: handshake yo\'lda o\'zgartirilmaganini tasdiqlaydi.', color: 'hsl(var(--ok))' },
    { from: 0, to: 1, label: 'Finished 🔐', detail: 'Mijoz ham tasdiqlaydi. TLS 1.3 da handshake atigi 1 RTT (TLS 1.2 da 2 RTT edi).', color: 'hsl(var(--ok))' },
    { from: 0, to: 1, label: 'HTTP so\'rov 🔐', detail: 'Endi ilova ma\'lumotlari application kalitlari bilan AEAD shifrlanadi. Tekshirish: openssl s_client -connect example.uz:443 -servername example.uz', data: 'GET / HTTP/2\nhost: example.uz', color: 'hsl(var(--warn))' }
  ]
}
const DHCP: SeqDef = {
  actors: [{ name: 'Mijoz', sub: 'IP yo\'q: 0.0.0.0', icon: '💻' }, { name: 'DHCP server', sub: '192.168.1.1', icon: '🗄️' }],
  steps: [
    { from: 0, to: 1, label: 'DISCOVER (broadcast)', detail: 'Mijozda hali IP yo\'q, server manzilini ham bilmaydi — shuning uchun broadcast yuboradi. Broadcast routerdan o\'tmaydi: DHCP bitta broadcast domen bilan cheklangan (boshqa segment uchun DHCP relay kerak).', data: 'src: 0.0.0.0:68  dst: 255.255.255.255:67\nsrc MAC: aa:bb:cc:11:22:33  dst MAC: ff:ff:ff:ff:ff:ff' },
    { from: 1, to: 0, label: 'OFFER', detail: 'Server hovuzdan bo\'sh manzil taklif qiladi. Tarmoqda bir necha server bo\'lsa, bir necha OFFER keladi (rogue DHCP xavfi shu yerda).', data: 'yiaddr: 192.168.1.57\nlease: 86400 s\noption 1 mask, 3 router, 6 DNS' },
    { from: 0, to: 1, label: 'REQUEST (broadcast)', detail: 'Mijoz bitta taklifni tanlaydi va buni hammaga e\'lon qiladi — boshqa serverlar o\'z takliflarini qaytarib olishi uchun yana broadcast.', data: 'option 50 requested IP: 192.168.1.57\noption 54 server id: 192.168.1.1' },
    { from: 1, to: 0, label: 'ACK', detail: 'Server ijarani tasdiqlaydi. Mijoz manzilni sozlaydi. Ijara muddatining 50% ida (T1) mijoz unicast REQUEST bilan uzaytiradi.', data: 'IP: 192.168.1.57/24\ngateway: 192.168.1.1\nDNS: 192.168.1.1', color: 'hsl(var(--ok))' }
  ]
}

function Encapsulation() {
  const [step, setStep] = useState(0) // 0..4 pastga (o'rash), 5..8 yuqoriga (ochish)
  const down = Math.min(step, 4), up = Math.max(0, step - 4)
  const parts = [
    { k: 'ETH', label: 'Ethernet', sub: 'dst MAC · src MAC · type', c: '#f59e0b', at: 4, bytes: 14 },
    { k: 'IP', label: 'IP', sub: 'src IP · dst IP · TTL', c: '#10b981', at: 3, bytes: 20 },
    { k: 'TCP', label: 'TCP', sub: 'src port · dst port · seq', c: '#0ea5e9', at: 2, bytes: 20 },
    { k: 'DATA', label: 'HTTP ma\'lumot', sub: 'GET / HTTP/1.1', c: '#a855f7', at: 1, bytes: 1460 },
    { k: 'FCS', label: 'FCS', sub: 'CRC32', c: '#f59e0b', at: 4, bytes: 4 }
  ]
  const visible = (at: number) => down >= at && 5 - up > at - 1 + (at === 1 ? -9 : 0)
  const TEXT = ['Boshlash: ilova ma\'lumot yuborishga tayyor.', 'L7: ilova HTTP so\'rovini tuzadi — bu hali shunchaki baytlar.', 'L4: yadro TCP header qo\'shadi (portlar, seq) → SEGMENT. Katta ma\'lumot MSS (1460) bo\'laklarga bo\'linadi.', 'L3: IP header qo\'shiladi (manba va manzil IP, TTL=64) → PAKET. Routing jadvalidan keyingi hop aniqlanadi.', 'L2: ARP orqali keyingi hop MAC i topiladi; Ethernet header va FCS qo\'shiladi → KADR (frame). 1460+20+20 = 1500 = MTU.', 'Qabul qiluvchi L2: MAC menikimi? FCS to\'g\'rimi? Ethernet header olib tashlanadi.', 'L3: dst IP menikimi? (Router bo\'lsa: TTL−1 va keyingi hopga.) IP header olib tashlanadi.', 'L4: dst port bo\'yicha socket topiladi, seq tekshiriladi, ACK yuboriladi. TCP header olib tashlanadi.', 'L7: ilova (nginx) toza HTTP so\'rovini o\'qiydi. Dekapsulyatsiya tugadi.']
  return (
    <div className="grid gap-5 @5xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="card p-5">
        <div className="mb-4 flex h-[92px] items-stretch justify-center gap-1">
          <AnimatePresence>
            {parts.filter((p) => visible(p.at)).map((p) => (
              <motion.div layout key={p.k} initial={{ opacity: 0, scale: 0.6, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.6, y: 20 }} transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                className={cn('flex flex-col items-center justify-center rounded-lg border-2 px-3 text-center', p.k === 'DATA' ? 'min-w-[200px] flex-1' : 'min-w-[92px]')} style={{ borderColor: p.c, background: p.c + '22' }}>
                <div className="text-[13px] font-semibold">{p.label}</div><div className="font-mono text-[10px] text-muted">{p.sub}</div><div className="text-[10px] text-faint">{p.bytes} bayt</div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <div className="mb-4 rounded-lg border bg-elev/60 px-4 py-3 text-[13.5px] leading-relaxed" aria-live="polite"><b className="text-accent">{step === 0 ? '▸' : step <= 4 ? '⬇ Inkapsulyatsiya' : '⬆ Dekapsulyatsiya'}</b> {TEXT[step]}</div>
        <div className="flex items-center gap-2"><Button onClick={() => setStep(Math.max(0, step - 1))} disabled={!step}>← Orqaga</Button><Button variant="primary" onClick={() => setStep(step >= 8 ? 0 : step + 1)}>{step >= 8 ? 'Boshidan' : 'Keyingi qadam →'}</Button><span className="text-xs text-faint">{step} / 8</span></div>
        <div className="mt-5 grid gap-1.5">
          {LAYERS.map((l) => { const act = (step >= 1 && step <= 4 && [7, 4, 3, 2][step - 1] === l.n) || (step >= 5 && [2, 3, 4, 7][step - 5] === l.n); return (
            <motion.div key={l.n} animate={{ scale: act ? 1.015 : 1 }} className={cn('grid grid-cols-[34px_130px_110px_1fr] items-center gap-3 rounded-lg border px-3 py-2 text-[12.5px] transition', act ? 'shadow-soft' : 'opacity-70')} style={{ borderColor: act ? l.color : undefined, background: act ? l.color + '1c' : undefined }}>
              <span className="flex h-7 w-7 items-center justify-center rounded-md font-mono font-bold text-white" style={{ background: l.color }}>{l.n}</span>
              <span className="font-semibold">{l.name}</span><span className="text-faint">TCP/IP: {l.tcp}</span><span className="truncate font-mono text-[11.5px] text-muted">{l.proto}</span>
            </motion.div>
          ) })}
        </div>
      </div>
      <div className="card max-h-[640px] space-y-3 overflow-y-auto p-4">{LAYERS.map((l) => <div key={l.n} className="rounded-lg border-l-[3px] bg-elev/50 px-3 py-2" style={{ borderColor: l.color }}><div className="text-[13px] font-semibold">L{l.n} {l.name} <span className="font-normal text-faint">· PDU: {l.pdu}</span></div><p className="mt-1 text-[12.5px] leading-relaxed text-muted">{l.what}</p><p className="mt-1 text-[11.5px] text-faint">Qurilma: {l.dev}</p></div>)}</div>
    </div>
  )
}

export default function Osi() {
  const [tab, setTab] = useState<'enc' | 'tcp' | 'tls' | 'dhcp'>('enc')
  return (
    <div className="space-y-5">
      <Segmented label="Animatsiya" value={tab} onChange={setTab} options={[{ value: 'enc', label: 'Inkapsulyatsiya (OSI)' }, { value: 'tcp', label: 'TCP handshake' }, { value: 'tls', label: 'TLS 1.3 handshake' }, { value: 'dhcp', label: 'DHCP DORA' }]} />
      {tab === 'enc' ? <Encapsulation /> : <SequencePlayer def={tab === 'tcp' ? TCP : tab === 'tls' ? TLS : DHCP} />}
    </div>
  )
}
