/** Mini PromQL dvigateli — namunaviy metrikalar ustida (o'quv maqsadida, to'liq PromQL emas). */
export interface Series { metric: string; labels: Record<string, string>; values: number[] } // values[i] — STEP*i soniyadagi qiymat
export const STEP = 15, POINTS = 241 // 1 soat

const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
export function sampleData(): Series[] {
  const out: Series[] = []
  const counter = (metric: string, labels: Record<string, string>, rate: (i: number) => number, seed: number, resetAt?: number) => { const r = rng(seed); let v = 0; const values: number[] = []; for (let i = 0; i < POINTS; i++) { if (i === resetAt) v = 0; v += Math.max(0, rate(i) * STEP * (0.85 + r() * 0.3)); values.push(Math.round(v * 100) / 100) } out.push({ metric, labels, values }) }
  const gauge = (metric: string, labels: Record<string, string>, f: (i: number) => number, seed: number) => { const r = rng(seed); out.push({ metric, labels, values: Array.from({ length: POINTS }, (_, i) => Math.round(f(i) * (0.97 + r() * 0.06) * 100) / 100) }) }
  const inst = ['web-1:8000', 'web-2:8000']
  inst.forEach((instance, k) => {
    counter('http_requests_total', { job: 'api', instance, method: 'GET', status: '200' }, (i) => 40 + 25 * Math.sin(i / 30) + k * 8, 11 + k, k === 1 ? 150 : undefined)
    counter('http_requests_total', { job: 'api', instance, method: 'POST', status: '200' }, () => 9 + k * 2, 21 + k)
    counter('http_requests_total', { job: 'api', instance, method: 'GET', status: '500' }, (i) => (i > 120 && i < 170 ? 6 : 0.3), 31 + k)
    counter('http_requests_total', { job: 'api', instance, method: 'GET', status: '404' }, () => 1.2, 41 + k)
    const buckets = [0.05, 0.1, 0.25, 0.5, 1, 2.5]; const share = (i: number) => (i > 120 && i < 170 ? [0.2, 0.4, 0.6, 0.78, 0.92, 0.99] : [0.55, 0.8, 0.93, 0.98, 0.995, 1])
    buckets.forEach((le, b) => counter('http_request_duration_seconds_bucket', { job: 'api', instance, le: String(le) }, (i) => (50 + 25 * Math.sin(i / 30)) * share(i)[b], 51 + k))
    counter('http_request_duration_seconds_bucket', { job: 'api', instance, le: '+Inf' }, (i) => 50 + 25 * Math.sin(i / 30), 51 + k)
    counter('http_request_duration_seconds_count', { job: 'api', instance }, (i) => 50 + 25 * Math.sin(i / 30), 51 + k)
    counter('http_request_duration_seconds_sum', { job: 'api', instance }, (i) => (50 + 25 * Math.sin(i / 30)) * (i > 120 && i < 170 ? 0.42 : 0.09), 61 + k)
  })
  ;['node-1:9100', 'node-2:9100'].forEach((instance, k) => {
    for (const cpu of ['0', '1']) { counter('node_cpu_seconds_total', { job: 'node', instance, cpu, mode: 'idle' }, (i) => 0.75 - 0.25 * Math.sin(i / 40) - k * 0.2, 71 + k); counter('node_cpu_seconds_total', { job: 'node', instance, cpu, mode: 'user' }, (i) => 0.18 + 0.2 * Math.sin(i / 40) + k * 0.15, 81 + k); counter('node_cpu_seconds_total', { job: 'node', instance, cpu, mode: 'system' }, () => 0.05 + k * 0.03, 91 + k); counter('node_cpu_seconds_total', { job: 'node', instance, cpu, mode: 'iowait' }, () => 0.02 + k * 0.02, 95 + k) }
    gauge('node_memory_MemTotal_bytes', { job: 'node', instance }, () => 8 * 2 ** 30, 1)
    gauge('node_memory_MemAvailable_bytes', { job: 'node', instance }, (i) => (4.5 - k * 1.5 - 1.2 * Math.sin(i / 60)) * 2 ** 30, 101 + k)
    gauge('node_filesystem_size_bytes', { job: 'node', instance, mountpoint: '/' }, () => 100 * 2 ** 30, 1)
    gauge('node_filesystem_avail_bytes', { job: 'node', instance, mountpoint: '/' }, (i) => (38 - k * 20 - i * (0.02 + k * 0.05)) * 2 ** 30, 111 + k)
    gauge('node_load1', { job: 'node', instance }, (i) => 0.8 + k * 1.6 + 0.6 * Math.sin(i / 25), 121 + k)
    gauge('up', { job: 'node', instance }, (i) => (k === 1 && i > 200 && i < 220 ? 0 : 1), 1)
  })
  inst.forEach((instance) => gauge('up', { job: 'api', instance }, () => 1, 1))
  // gauge lardagi shovqinni up/size uchun olib tashlaymiz
  for (const s of out) if (['up', 'node_memory_MemTotal_bytes', 'node_filesystem_size_bytes'].includes(s.metric)) s.values = s.values.map((v) => (s.metric === 'up' ? Math.round(v) : s.metric === 'node_memory_MemTotal_bytes' ? 8 * 2 ** 30 : 100 * 2 ** 30))
  return out
}

// ---------- parser ----------
type Tok = { t: 'num' | 'id' | 'str' | 'op' | 'dur'; v: string }
function lex(s: string): Tok[] {
  const out: Tok[] = []; let i = 0
  while (i < s.length) {
    const c = s[i]
    if (/\s/.test(c)) { i++; continue }
    let m: RegExpExecArray | null
    if ((m = /^\[(\d+)([smhd])\]/.exec(s.slice(i)))) { out.push({ t: 'dur', v: String(+m[1] * { s: 1, m: 60, h: 3600, d: 86400 }[m[2] as 's']) }); i += m[0].length }
    else if ((m = /^(\d+\.?\d*(?:e[+-]?\d+)?)/.exec(s.slice(i)))) { out.push({ t: 'num', v: m[1] }); i += m[0].length }
    else if ((m = /^[a-zA-Z_:][a-zA-Z0-9_:]*/.exec(s.slice(i)))) { out.push({ t: 'id', v: m[0] }); i += m[0].length }
    else if (c === '"' || c === "'") { const j = s.indexOf(c, i + 1); if (j < 0) throw new Error('Yopilmagan qo\'shtirnoq'); out.push({ t: 'str', v: s.slice(i + 1, j) }); i = j + 1 }
    else if ((m = /^(=~|!~|!=|==|>=|<=|[-+*\/(){},=<>])/.exec(s.slice(i)))) { out.push({ t: 'op', v: m[1] }); i += m[1].length }
    else throw new Error(`Kutilmagan belgi: "${c}" (${i + 1}-pozitsiya)`)
  }
  return out
}
export type Node =
  | { k: 'num'; v: number } | { k: 'sel'; metric: string; m: { l: string; op: string; v: string }[]; range?: number }
  | { k: 'call'; fn: string; args: Node[] } | { k: 'agg'; op: string; by?: string[]; without?: string[]; arg: Node; param?: Node }
  | { k: 'bin'; op: string; l: Node; r: Node }
const AGGS = ['sum', 'avg', 'min', 'max', 'count', 'topk', 'bottomk']
const FUNCS = ['rate', 'irate', 'increase', 'histogram_quantile', 'avg_over_time', 'max_over_time', 'min_over_time', 'sum_over_time', 'delta', 'abs', 'round', 'predict_linear', 'clamp_min', 'clamp_max']

export function parse(src: string): Node {
  const tk = lex(src); let p = 0
  const peek = () => tk[p], eat = (v?: string) => { const t = tk[p++]; if (!t || (v && t.v !== v)) throw new Error(v ? `"${v}" kutilgan edi${t ? `, "${t.v}" keldi` : ''}` : 'Ifoda kutilmaganda tugadi'); return t }
  const labels = (): string[] => { eat('('); const l: string[] = []; while (peek()?.v !== ')') { l.push(eat().v); if (peek()?.v === ',') eat() } eat(')'); return l }
  const primary = (): Node => {
    const t = eat()
    if (t.t === 'num') return { k: 'num', v: +t.v }
    if (t.v === '(') { const e = expr(0); eat(')'); return e }
    if (t.v === '-' ) { const e = primary(); return { k: 'bin', op: '*', l: { k: 'num', v: -1 }, r: e } }
    if (t.t !== 'id') throw new Error(`Kutilmagan: "${t.v}"`)
    if (AGGS.includes(t.v) && (peek()?.v === '(' || peek()?.v === 'by' || peek()?.v === 'without')) {
      let by: string[] | undefined, without: string[] | undefined
      const mod = () => { if (peek()?.v === 'by') { eat(); by = labels() } else if (peek()?.v === 'without') { eat(); without = labels() } }
      mod(); eat('('); let param: Node | undefined; let arg = expr(0)
      if (peek()?.v === ',') { eat(); param = arg; arg = expr(0) } eat(')'); mod()
      return { k: 'agg', op: t.v, by, without, arg, param }
    }
    if (FUNCS.includes(t.v) && peek()?.v === '(') { eat('('); const args: Node[] = []; while (peek()?.v !== ')') { args.push(expr(0)); if (peek()?.v === ',') eat() } eat(')'); return { k: 'call', fn: t.v, args } }
    if (peek()?.v === '(') throw new Error(`"${t.v}" funksiyasi bu playgroundda yo'q. Mavjud: ${[...FUNCS, ...AGGS].join(', ')}`)
    const sel: Node = { k: 'sel', metric: t.v, m: [] }
    if (peek()?.v === '{') { eat(); while (peek()?.v !== '}') { const l = eat().v, op = eat().v, v = eat(); if (!['=', '!=', '=~', '!~'].includes(op) || v.t !== 'str') throw new Error('Label matcher: label="qiymat"'); sel.m.push({ l, op, v: v.v }); if (peek()?.v === ',') eat() } eat('}') }
    if (peek()?.t === 'dur') sel.range = +eat().v
    return sel
  }
  const PREC: Record<string, number> = { '>': 1, '<': 1, '>=': 1, '<=': 1, '==': 1, '!=': 1, '+': 2, '-': 2, '*': 3, '/': 3 }
  const expr = (min: number): Node => { let l = primary(); for (;;) { const t = peek(); if (!t || t.t !== 'op' || PREC[t.v] === undefined || PREC[t.v] < min) break; eat(); const r = expr(PREC[t.v] + 1); l = { k: 'bin', op: t.v, l, r } } return l }
  const e = expr(0)
  if (p < tk.length) throw new Error(`Ortiqcha: "${tk[p].v}"`)
  return e
}

// ---------- baholash ----------
export type Vec = { labels: Record<string, string>; values: (number | null)[] }[]
const key = (l: Record<string, string>) => Object.keys(l).sort().map((k) => `${k}="${l[k]}"`).join(',')
const match = (s: Series, m: { l: string; op: string; v: string }[]) => m.every(({ l, op, v }) => { const x = l === '__name__' ? s.metric : s.labels[l] ?? ''; return op === '=' ? x === v : op === '!=' ? x !== v : op === '=~' ? new RegExp(`^(?:${v})$`).test(x) : !new RegExp(`^(?:${v})$`).test(x) })

export function evaluate(node: Node, data: Series[]): Vec | number {
  const idx = Array.from({ length: POINTS }, (_, i) => i)
  const ev = (n: Node): Vec | number => {
    switch (n.k) {
      case 'num': return n.v
      case 'sel': { if (n.range) throw new Error(`Range vector (${n.metric}[…]) ni to'g'ridan-to'g'ri chizib bo'lmaydi — uni rate(), increase() yoki *_over_time() ichiga oling`); const s = data.filter((x) => x.metric === n.metric && match(x, n.m)); if (!data.some((x) => x.metric === n.metric)) throw new Error(`"${n.metric}" metrikasi topilmadi`); return s.map((x) => ({ labels: { ...x.labels }, values: [...x.values] })) }
      case 'call': {
        const rangeFn = ['rate', 'irate', 'increase', 'avg_over_time', 'max_over_time', 'min_over_time', 'sum_over_time', 'delta', 'predict_linear'].includes(n.fn)
        if (rangeFn) {
          const a = n.args[0]; if (!a || a.k !== 'sel' || !a.range) throw new Error(`${n.fn}() range vector kutadi: ${n.fn}(metrika[5m])`)
          const w = Math.max(1, Math.round(a.range / STEP)); if (['rate', 'increase', 'irate'].includes(n.fn) && a.range < 2 * STEP) throw new Error(`Oyna juda kichik: scrape interval ${STEP}s, kamida ${2 * STEP}s kerak (tavsiya: 4× = 1m)`)
          const horizon = n.fn === 'predict_linear' ? (ev(n.args[1]) as number) : 0
          return data.filter((x) => x.metric === a.metric && match(x, a.m)).map((s) => ({ labels: { ...s.labels }, values: idx.map((i) => {
            if (i < w) return null; const win = s.values.slice(i - w, i + 1)
            if (n.fn === 'rate' || n.fn === 'increase') { let inc = 0; for (let j = 1; j < win.length; j++) inc += win[j] >= win[j - 1] ? win[j] - win[j - 1] : win[j]; return n.fn === 'rate' ? inc / a.range! : inc } // counter reset hisobga olinadi
            if (n.fn === 'irate') { const d = win[win.length - 1] - win[win.length - 2]; return (d >= 0 ? d : win[win.length - 1]) / STEP }
            if (n.fn === 'delta') return win[win.length - 1] - win[0]
            if (n.fn === 'predict_linear') { const N = win.length, mx = (N - 1) / 2, my = win.reduce((p, c) => p + c, 0) / N; let num = 0, den = 0; win.forEach((y, j) => { num += (j - mx) * (y - my); den += (j - mx) ** 2 }); const slope = num / den / STEP; return win[N - 1] + slope * horizon }
            return n.fn === 'avg_over_time' ? win.reduce((p, c) => p + c, 0) / win.length : n.fn === 'max_over_time' ? Math.max(...win) : n.fn === 'min_over_time' ? Math.min(...win) : win.reduce((p, c) => p + c, 0)
          }) }))
        }
        if (n.fn === 'histogram_quantile') {
          const q = ev(n.args[0]); const v = ev(n.args[1]); if (typeof q !== 'number' || typeof v === 'number') throw new Error('histogram_quantile(0.95, sum by (le) (rate(..._bucket[5m])))')
          if (!v.length || !v.every((s) => 'le' in s.labels)) throw new Error('histogram_quantile uchun "le" label li qatorlar kerak — sum by (le) ni unutdingizmi?')
          const groups = new Map<string, Vec>(); for (const s of v) { const { le, ...rest } = s.labels; void le; const k = key(rest); groups.set(k, [...(groups.get(k) ?? []), s]) }
          return [...groups.values()].map((g) => { const b = g.map((s) => ({ le: s.labels.le === '+Inf' ? Infinity : +s.labels.le, s })).sort((x, y) => x.le - y.le); const { le, ...rest } = g[0].labels; void le; return { labels: rest, values: idx.map((i) => { const tot = b[b.length - 1].s.values[i]; if (tot === null || !tot) return null; const rank = q * tot; let prevLe = 0, prevC = 0; for (const x of b) { const c = x.s.values[i] ?? 0; if (c >= rank) { if (x.le === Infinity) return prevLe; return prevLe + (x.le - prevLe) * ((rank - prevC) / Math.max(c - prevC, 1e-9)) } prevLe = x.le; prevC = c } return null }) } })
        }
        const v = ev(n.args[0]); const arg2 = n.args[1] ? (ev(n.args[1]) as number) : undefined
        const f = (x: number) => (n.fn === 'abs' ? Math.abs(x) : n.fn === 'round' ? Math.round(x) : n.fn === 'clamp_min' ? Math.max(x, arg2!) : Math.min(x, arg2!))
        return typeof v === 'number' ? f(v) : v.map((s) => ({ labels: s.labels, values: s.values.map((x) => (x === null ? null : f(x))) }))
      }
      case 'agg': {
        const v = ev(n.arg); if (typeof v === 'number') throw new Error(`${n.op}() vektor kutadi`)
        if (n.op === 'topk' || n.op === 'bottomk') { const k = ev(n.param!) as number; const last = (s: Vec[0]) => [...s.values].reverse().find((x) => x !== null) ?? 0; return [...v].sort((a, b) => (n.op === 'topk' ? last(b) - last(a) : last(a) - last(b))).slice(0, k) }
        const groups = new Map<string, { labels: Record<string, string>; items: Vec }>()
        for (const s of v) { const l: Record<string, string> = {}; if (n.by) for (const b of n.by) { if (b in s.labels) l[b] = s.labels[b] } else if (n.without) for (const [a, b] of Object.entries(s.labels)) { if (!n.without.includes(a)) l[a] = b } const k = key(l); if (!groups.has(k)) groups.set(k, { labels: l, items: [] }); groups.get(k)!.items.push(s) }
        return [...groups.values()].map((g) => ({ labels: g.labels, values: idx.map((i) => { const xs = g.items.map((s) => s.values[i]).filter((x): x is number => x !== null); if (!xs.length) return null; return n.op === 'sum' ? xs.reduce((a, b) => a + b, 0) : n.op === 'avg' ? xs.reduce((a, b) => a + b, 0) / xs.length : n.op === 'min' ? Math.min(...xs) : n.op === 'max' ? Math.max(...xs) : xs.length }) }))
      }
      case 'bin': {
        const l = ev(n.l), r = ev(n.r); const cmp = ['>', '<', '>=', '<=', '==', '!='].includes(n.op)
        const f = (a: number, b: number): number | null => { switch (n.op) { case '+': return a + b; case '-': return a - b; case '*': return a * b; case '/': return b === 0 ? null : a / b; case '>': return a > b ? a : null; case '<': return a < b ? a : null; case '>=': return a >= b ? a : null; case '<=': return a <= b ? a : null; case '==': return a === b ? a : null; default: return a !== b ? a : null } }
        if (typeof l === 'number' && typeof r === 'number') { if (cmp) throw new Error('Ikki skalyarni solishtirish uchun bool kerak'); return f(l, r) ?? NaN }
        if (typeof r === 'number') return (l as Vec).map((s) => ({ labels: s.labels, values: s.values.map((x) => (x === null ? null : f(x, r))) }))
        if (typeof l === 'number') return r.map((s) => ({ labels: s.labels, values: s.values.map((x) => (x === null ? null : f(l, x))) }))
        // vector matching: label to'plamlari AYNAN teng bo'lgan juftliklar (one-to-one)
        const rm = new Map(r.map((s) => [key(s.labels), s])); const out: Vec = []
        for (const s of l) { const o = rm.get(key(s.labels)); if (o) out.push({ labels: s.labels, values: s.values.map((x, i) => (x === null || o.values[i] === null ? null : f(x, o.values[i]!))) }) }
        if (!out.length && l.length && r.length) throw new Error(`Vector matching: chap va o'ng tomon label lari mos kelmadi.\n  chap:  {${key(l[0].labels)}}\n  o'ng:  {${key(r[0].labels)}}\nIkkala tomonni bir xil label lar bo'yicha agregatsiya qiling (sum by (...)).`)
        return out
      }
    }
  }
  return ev(node)
}
export const fmtLabels = (l: Record<string, string>) => `{${key(l)}}`
