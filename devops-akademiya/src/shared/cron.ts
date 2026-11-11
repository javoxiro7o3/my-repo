/** Cron ifodalarini tahlil qilish va keyingi ishga tushish vaqtlarini hisoblash (sof funksiyalar, React dan mustaqil). */
export const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']
export const DOW = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba']
export function expandField(f: string, min: number, max: number): number[] {
  const out = new Set<number>()
  for (const part of f.split(',')) {
    const m = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(part.trim())
    if (!m) throw new Error(`Noto'g'ri maydon: "${part}"`)
    let [a, b] = m[1] === '*' ? [min, max] : m[1].split('-').map(Number)
    if (b === undefined) b = m[2] ? max : a
    const step = m[2] ? +m[2] : 1
    if (a < min || b > max || a > b || step < 1) throw new Error(`"${part}" ${min}–${max} oralig'idan tashqarida`)
    for (let x = a; x <= b; x += step) out.add(x)
  }
  return [...out].sort((x, y) => x - y)
}
export function nextRuns(expr: string, from: Date, n = 5): Date[] {
  const f = expr.trim().split(/\s+/)
  if (f.length !== 5) throw new Error('Cron ifodasi 5 maydondan iborat: daqiqa soat kun oy hafta-kuni')
  const [mi, ho, dom, mo] = [expandField(f[0], 0, 59), expandField(f[1], 0, 23), expandField(f[2], 1, 31), expandField(f[3], 1, 12)]
  const dw = expandField(f[4].replace(/7/g, '0'), 0, 6)
  const domAny = f[2] === '*', dowAny = f[4] === '*'
  const out: Date[] = []; const d = new Date(from); d.setSeconds(0, 0); d.setMinutes(d.getMinutes() + 1)
  for (let i = 0; i < 600_000 && out.length < n; i++) {
    const dayOk = domAny && dowAny ? true : domAny ? dw.includes(d.getDay()) : dowAny ? dom.includes(d.getDate()) : dom.includes(d.getDate()) || dw.includes(d.getDay())
    if (mo.includes(d.getMonth() + 1) && dayOk && ho.includes(d.getHours()) && mi.includes(d.getMinutes())) out.push(new Date(d))
    d.setMinutes(d.getMinutes() + 1)
  }
  return out
}
export function describe(expr: string): string {
  const f = expr.trim().split(/\s+/)
  const one = (s: string, unit: string, names?: string[]) => s === '*' ? `har ${unit}` : /^\*\/\d+$/.test(s) ? `har ${s.slice(2)} ${unit}da` : s.split(',').map((x) => (names && /^\d+$/.test(x) ? names[+x % names.length] : x)).join(', ') + (names ? '' : `-${unit}`)
  const time = /^\d+$/.test(f[0]) && /^\d+$/.test(f[1]) ? `soat ${f[1].padStart(2, '0')}:${f[0].padStart(2, '0')} da` : `${one(f[0], 'daqiqa')}, ${one(f[1], 'soat')}`
  return [time, f[2] !== '*' ? `oyning ${f[2]}-kuni` : '', f[3] !== '*' ? one(f[3], 'oy', ['', ...MONTHS]) : '', f[4] !== '*' ? `hafta kuni: ${one(f[4].replace(/7/g, '0'), 'kun', DOW)}` : '', f[2] !== '*' && f[4] !== '*' ? '(⚠ kun VA hafta kuni berilsa — ikkalasidan BIRI mos kelsa ishlaydi)' : ''].filter(Boolean).join(', ')
}
