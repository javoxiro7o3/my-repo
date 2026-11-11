import { describe, expect, it } from 'vitest'
import { sm2, nextDue, SM2_INITIAL, DAY_MS } from '@shared/sm2'
import { calcStreak, dayKey, levelFromXp } from '@shared/gamify'

describe('SM-2 algoritmi', () => {
  it('birinchi ikki muvaffaqiyatli takror: 1 va 6 kun', () => {
    const a = sm2(SM2_INITIAL, 4); expect(a.interval).toBe(1); expect(a.reps).toBe(1)
    const b = sm2(a, 4); expect(b.interval).toBe(6); expect(b.reps).toBe(2)
  })
  it('uchinchi takrordan boshlab interval EF ga ko\'paytiriladi', () => {
    let s = sm2(sm2(SM2_INITIAL, 5), 5)
    const ef = s.ef; s = sm2(s, 5)
    expect(s.interval).toBe(Math.round(6 * ef))
  })
  it('q < 3 — takrorlar nolga tushadi, interval 1 kun', () => {
    const s = sm2({ ef: 2.5, interval: 30, reps: 5 }, 1)
    expect(s.reps).toBe(0); expect(s.interval).toBe(1)
  })
  it('EF hech qachon 1.3 dan past tushmaydi', () => {
    let s = SM2_INITIAL; for (let i = 0; i < 30; i++) s = sm2(s, 0)
    expect(s.ef).toBe(1.3)
  })
  it('q=5 EF ni oshiradi, q=3 kamaytiradi, q=4 o\'zgartirmaydi', () => {
    expect(sm2(SM2_INITIAL, 5).ef).toBeCloseTo(2.6, 5)
    expect(sm2(SM2_INITIAL, 4).ef).toBeCloseTo(2.5, 5)
    expect(sm2(SM2_INITIAL, 3).ef).toBeCloseTo(2.36, 5)
  })
  it('q chegaradan tashqari bo\'lsa 0..5 ga qisqartiriladi; NaN — xato', () => {
    expect(sm2(SM2_INITIAL, 9).ef).toBe(sm2(SM2_INITIAL, 5).ef)
    expect(() => sm2(SM2_INITIAL, NaN)).toThrow()
  })
  it('nextDue kunlarni millisekundga aylantiradi', () => {
    expect(nextDue({ ef: 2.5, interval: 6, reps: 2 }, 1000)).toBe(1000 + 6 * DAY_MS)
  })
})

describe('gamifikatsiya', () => {
  it('daraja chegaralari', () => {
    expect(levelFromXp(0).level).toBe(1)
    expect(levelFromXp(99).level).toBe(1)
    expect(levelFromXp(100).level).toBe(2)
    expect(levelFromXp(250)).toMatchObject({ level: 3, cur: 0, need: 200 })
  })
  it('streak: bugun yoki kechadan boshlab ketma-ket kunlar', () => {
    const now = new Date(2026, 10, 10, 12).getTime(), d = (n: number) => dayKey(now - n * DAY_MS)
    expect(calcStreak({}, now)).toBe(0)
    expect(calcStreak({ [d(0)]: 1, [d(1)]: 2, [d(2)]: 1 }, now)).toBe(3)
    expect(calcStreak({ [d(1)]: 2, [d(2)]: 1 }, now)).toBe(2) // bugun hali o'qilmagan
    expect(calcStreak({ [d(2)]: 1 }, now)).toBe(0)           // uzilgan
  })
})
