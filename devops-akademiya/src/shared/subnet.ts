/** IPv4/IPv6 subnet hisob-kitoblari (sof funksiyalar — birlik testlari bilan). */
export function ipToInt(ip: string): number {
  const p = ip.trim().split('.')
  if (p.length !== 4) throw new Error('IPv4 manzil 4 oktetdan iborat bo\'lishi kerak')
  let n = 0
  for (const o of p) {
    if (!/^\d{1,3}$/.test(o) || +o > 255) throw new Error(`Noto'g'ri oktet: "${o}"`)
    n = n * 256 + +o
  }
  return n >>> 0
}
export const intToIp = (n: number) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.')
export const maskFromPrefix = (p: number) => (p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0)
export const toBits = (n: number) => (n >>> 0).toString(2).padStart(32, '0')

export interface V4Info {
  ip: string; prefix: number; mask: string; wildcard: string; network: string; broadcast: string
  first: string; last: string; hosts: number; total: number; cls: string; scope: string
  ipBits: string; maskBits: string; netInt: number; bcInt: number
}

export function parseCidr(s: string): { ip: number; prefix: number } {
  const m = s.trim().match(/^([\d.]+)\s*\/\s*(\d{1,2})$/)
  if (!m) throw new Error('Format: 192.168.1.10/24')
  const prefix = +m[2]
  if (prefix > 32) throw new Error('Prefiks 0–32 oralig\'ida bo\'lishi kerak')
  return { ip: ipToInt(m[1]), prefix }
}

export function scopeOf(ip: number): string {
  const a = ip >>> 24, b = (ip >>> 16) & 255
  if (a === 10) return 'Private (RFC 1918, 10.0.0.0/8)'
  if (a === 172 && b >= 16 && b <= 31) return 'Private (RFC 1918, 172.16.0.0/12)'
  if (a === 192 && b === 168) return 'Private (RFC 1918, 192.168.0.0/16)'
  if (a === 127) return 'Loopback (127.0.0.0/8)'
  if (a === 169 && b === 254) return 'Link-local (169.254.0.0/16, APIPA)'
  if (a === 100 && b >= 64 && b <= 127) return 'CGNAT (100.64.0.0/10)'
  if (a >= 224 && a <= 239) return 'Multicast (224.0.0.0/4)'
  if (a >= 240) return 'Zaxiralangan (240.0.0.0/4)'
  if (a === 0) return '"Bu tarmoq" (0.0.0.0/8)'
  return 'Public (internetda marshrutlanadi)'
}

export function v4info(cidr: string): V4Info {
  const { ip, prefix } = parseCidr(cidr)
  const mask = maskFromPrefix(prefix)
  const net = (ip & mask) >>> 0
  const bc = (net | (~mask >>> 0)) >>> 0
  const total = 2 ** (32 - prefix)
  const hosts = prefix >= 31 ? (prefix === 31 ? 2 : 1) : total - 2
  const first = prefix >= 31 ? net : net + 1
  const last = prefix >= 31 ? bc : bc - 1
  const a = ip >>> 24
  const cls = a < 128 ? 'A' : a < 192 ? 'B' : a < 224 ? 'C' : a < 240 ? 'D (multicast)' : 'E'
  return {
    ip: intToIp(ip), prefix, mask: intToIp(mask), wildcard: intToIp(~mask >>> 0), network: intToIp(net), broadcast: intToIp(bc),
    first: intToIp(first), last: intToIp(last), hosts, total, cls, scope: scopeOf(ip),
    ipBits: toBits(ip), maskBits: toBits(mask), netInt: net, bcInt: bc
  }
}

export const contains = (cidr: string, ip: string) => { const { ip: n, prefix } = parseCidr(cidr); const m = maskFromPrefix(prefix); return ((ipToInt(ip) & m) >>> 0) === ((n & m) >>> 0) }

/** Hostlar soniga yetadigan eng kichik prefiks */
export function prefixForHosts(hosts: number): number {
  if (hosts < 1) throw new Error('Hostlar soni musbat bo\'lishi kerak')
  for (let p = 30; p >= 0; p--) if (2 ** (32 - p) - 2 >= hosts) return p
  throw new Error('Juda ko\'p host')
}

export interface VlsmRow { name: string; need: number; cidr: string; network: string; first: string; last: string; broadcast: string; hosts: number; prefix: number }
/** VLSM: eng katta ehtiyojdan boshlab ketma-ket ajratish */
export function vlsm(base: string, needs: { name: string; hosts: number }[]): VlsmRow[] {
  const { ip, prefix } = parseCidr(base)
  const start = (ip & maskFromPrefix(prefix)) >>> 0
  const end = start + 2 ** (32 - prefix)
  let cur = start
  const out: VlsmRow[] = []
  for (const n of [...needs].sort((a, b) => b.hosts - a.hosts)) {
    const p = prefixForHosts(n.hosts)
    const size = 2 ** (32 - p)
    cur = Math.ceil(cur / size) * size
    if (cur + size > end) throw new Error(`"${n.name}" uchun joy yetmadi — asosiy blok kichik`)
    const i = v4info(`${intToIp(cur)}/${p}`)
    out.push({ name: n.name, need: n.hosts, cidr: `${i.network}/${p}`, network: i.network, first: i.first, last: i.last, broadcast: i.broadcast, hosts: i.hosts, prefix: p })
    cur += size
  }
  return out
}

/** Blokni teng qismlarga bo'lish */
export function split(base: string, newPrefix: number): string[] {
  const { ip, prefix } = parseCidr(base)
  if (newPrefix < prefix || newPrefix > 32) throw new Error('Yangi prefiks asosiy prefiksdan katta bo\'lishi kerak')
  const count = 2 ** (newPrefix - prefix)
  if (count > 1024) throw new Error('Juda ko\'p subnet (1024 dan ortiq)')
  const net = (ip & maskFromPrefix(prefix)) >>> 0, size = 2 ** (32 - newPrefix)
  return Array.from({ length: count }, (_, i) => `${intToIp(net + i * size)}/${newPrefix}`)
}

// ---------- IPv6 ----------
export function expandV6(addr: string): string {
  let a = addr.trim().toLowerCase()
  if (!/^[0-9a-f:]+$/.test(a)) throw new Error('IPv6 faqat 0-9, a-f va ":" dan iborat')
  if ((a.match(/::/g) || []).length > 1) throw new Error('"::" faqat bir marta ishlatiladi')
  let head = a, tail = ''
  if (a.includes('::')) [head, tail] = a.split('::')
  const h = head ? head.split(':') : [], t = tail ? tail.split(':') : []
  const miss = 8 - h.length - t.length
  if (a.includes('::') ? miss < 1 : miss !== 0) throw new Error('IPv6 8 ta guruhdan iborat bo\'lishi kerak')
  const g = [...h, ...Array(a.includes('::') ? miss : 0).fill('0'), ...t]
  if (g.some((x) => x.length > 4 || x === '')) throw new Error('Har bir guruh 1–4 hex raqam')
  return g.map((x) => x.padStart(4, '0')).join(':')
}
export function compressV6(full: string): string {
  const g = expandV6(full).split(':').map((x) => x.replace(/^0+(?=.)/, ''))
  let best = -1, bestLen = 0
  for (let i = 0; i < 8;) {
    if (g[i] !== '0') { i++; continue }
    let j = i; while (j < 8 && g[j] === '0') j++
    if (j - i > bestLen && j - i > 1) { best = i; bestLen = j - i }
    i = j
  }
  if (best < 0) return g.join(':')
  return `${g.slice(0, best).join(':')}::${g.slice(best + bestLen).join(':')}`
}
export function v6type(addr: string): string {
  const f = expandV6(addr), first = parseInt(f.slice(0, 4), 16)
  if (f === '0000:0000:0000:0000:0000:0000:0000:0001') return 'Loopback (::1)'
  if (f === '0000:0000:0000:0000:0000:0000:0000:0000') return 'Aniqlanmagan (::)'
  if ((first & 0xffc0) === 0xfe80) return 'Link-local (fe80::/10) — faqat bitta segment ichida'
  if ((first & 0xfe00) === 0xfc00) return 'Unique Local (fc00::/7) — private analogi'
  if ((first & 0xff00) === 0xff00) return 'Multicast (ff00::/8)'
  if (f.startsWith('2001:0db8')) return 'Hujjatlar uchun (2001:db8::/32)'
  if ((first & 0xe000) === 0x2000) return 'Global Unicast (2000::/3) — public'
  return 'Boshqa / zaxiralangan'
}
export function v6info(cidr: string) {
  const m = cidr.trim().match(/^([0-9a-fA-F:]+)\s*\/\s*(\d{1,3})$/)
  if (!m) throw new Error('Format: 2001:db8::1/64')
  const prefix = +m[2]
  if (prefix > 128) throw new Error('Prefiks 0–128')
  const full = expandV6(m[1])
  const bits = full.split(':').map((g) => parseInt(g, 16).toString(2).padStart(16, '0')).join('')
  const netBits = bits.slice(0, prefix).padEnd(128, '0')
  const toAddr = (b: string) => (b.match(/.{16}/g) as string[]).map((x) => parseInt(x, 2).toString(16).padStart(4, '0')).join(':')
  return {
    full, short: compressV6(full), prefix, network: compressV6(toAddr(netBits)) + '/' + prefix,
    lastAddr: compressV6(toAddr(bits.slice(0, prefix).padEnd(128, '1'))), type: v6type(full), bits,
    count: prefix >= 128 ? '1' : `2^${128 - prefix}`
  }
}
