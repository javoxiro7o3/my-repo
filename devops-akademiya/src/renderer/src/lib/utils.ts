import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
export const cn = (...a: ClassValue[]) => twMerge(clsx(a))
export const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
export const fmt = (n: number) => n.toLocaleString('ru-RU').replace(/,/g, ' ')
export const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n))
export const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); return true } catch { return false } }
export function shuffle<T>(a: T[], seed = Math.random()): T[] {
  const r = [...a]; let s = Math.floor(seed * 2 ** 31) || 1
  const rnd = () => ((s = (s * 48271) % 2147483647) / 2147483647)
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [r[i], r[j]] = [r[j], r[i]] }
  return r
}
