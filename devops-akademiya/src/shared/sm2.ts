/**
 * SM-2 (SuperMemo 2) oraliqli takrorlash algoritmi.
 * q — javob sifati 0..5 (0-2: unutilgan, 3: qiyin, 4: yaxshi, 5: oson).
 */
export interface Sm2State { ef: number; interval: number; reps: number }
export const SM2_INITIAL: Sm2State = { ef: 2.5, interval: 0, reps: 0 }
export const DAY_MS = 86_400_000

export function sm2(state: Sm2State, q: number): Sm2State {
  if (!Number.isFinite(q)) throw new Error('q son bo\'lishi kerak')
  q = Math.max(0, Math.min(5, Math.round(q)))
  let { ef, interval, reps } = state
  if (q < 3) {
    reps = 0
    interval = 1
  } else {
    if (reps === 0) interval = 1
    else if (reps === 1) interval = 6
    else interval = Math.round(interval * ef)
    reps += 1
  }
  ef = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  if (ef < 1.3) ef = 1.3
  return { ef: Math.round(ef * 1000) / 1000, interval, reps }
}

export function nextDue(state: Sm2State, now = Date.now()): number {
  return now + state.interval * DAY_MS
}
