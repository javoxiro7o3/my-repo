import type { InvokeChannel, EventChannel } from '@shared/ipc'
import type { AiEvent, AiRequest } from '@shared/types'
import { uid } from './utils'

declare global { interface Window { api: { invoke: (c: string, p?: unknown) => Promise<any>; on: (c: string, cb: (d: any) => void) => () => void; platform: string } } }

export const invoke = <T = any>(c: InvokeChannel, p?: unknown): Promise<T> => window.api.invoke(c, p)
export const on = (c: EventChannel, cb: (d: any) => void) => window.api.on(c, cb)

type Handler = (e: AiEvent) => void
const handlers = new Map<string, Handler>()
let wired = false
function wire() { if (wired) return; wired = true; on('ai:event', (e: AiEvent) => handlers.get(e.id)?.(e)) }

export interface AiRun { id: string; cancel: () => void; done: Promise<{ text: string; cached: boolean }> }
export class AiError extends Error { constructor(public code: string, m: string) { super(m) } }

/** AI so'rovini ishga tushiradi; javob bo'laklari onChunk ga harf-harf keladi */
export function runAi(req: Omit<AiRequest, 'id'>, cb: { onChunk?: (full: string, delta: string) => void; onWait?: (seconds: number, attempt: number) => void } = {}): AiRun {
  wire()
  const id = uid()
  let full = ''
  const done = new Promise<{ text: string; cached: boolean }>((resolve, reject) => {
    handlers.set(id, (e) => {
      if (e.type === 'chunk') { full += e.text; cb.onChunk?.(full, e.text) }
      else if (e.type === 'status') cb.onWait?.(e.seconds, e.attempt)
      else if (e.type === 'done') { handlers.delete(id); resolve({ text: e.text, cached: e.cached }) }
      else if (e.type === 'error') { handlers.delete(id); reject(new AiError(e.code, e.message)) }
    })
    invoke('ai:start', { ...req, id }).catch((err) => { handlers.delete(id); reject(new AiError('unknown', String(err?.message ?? err))) })
  })
  return { id, done, cancel: () => { void invoke('ai:cancel', id) } }
}
