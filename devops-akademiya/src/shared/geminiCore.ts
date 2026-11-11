/**
 * Gemini streaming yadrosi — Electron ga bog'liq emas (birlik testlari uchun).
 * Kalit hech qachon xato xabari yoki logga qo'shilmaydi.
 */
export interface GeminiBody {
  systemInstruction?: { parts: { text: string }[] }
  contents: { role: 'user' | 'model'; parts: { text: string }[] }[]
  generationConfig?: Record<string, unknown>
}
export type ErrCode = 'key' | 'rate' | 'offline' | 'model' | 'blocked' | 'unknown'
export class GeminiError extends Error {
  constructor(public code: ErrCode, message: string, public status?: number) { super(message) }
}
export interface StreamOpts {
  key: string
  model: string
  body: GeminiBody
  baseUrl?: string
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  signal?: AbortSignal
  maxRetries?: number
  onChunk: (text: string) => void
  onWait?: (seconds: number, attempt: number) => void
}
export interface StreamResult { text: string; inTokens: number; outTokens: number }

export const DEFAULT_BASE = 'https://generativelanguage.googleapis.com/v1beta'
export const backoffMs = (attempt: number, retryAfter?: number) =>
  retryAfter && retryAfter > 0 ? Math.min(retryAfter * 1000, 60_000) : Math.min(2000 * 2 ** attempt, 32_000)

export const ERR_TEXT: Record<ErrCode | 'nokey', string> = {
  key: 'API kalit noto\'g\'ri yoki bekor qilingan. Sozlamalarda kalitni tekshiring.',
  rate: 'So\'rovlar limiti tugadi (429). Birozdan keyin qayta urinib ko\'ring yoki boshqa model tanlang.',
  offline: 'Internet aloqasi yo\'q — oflayn rejim. Tayyor darslar va keshlangan javoblar ishlayveradi.',
  model: 'Model topilmadi. Sozlamalarda model nomini tekshiring (masalan: gemini-2.5-flash).',
  blocked: 'Javob xavfsizlik filtri tomonidan to\'xtatildi. Savolni boshqacha ifodalab ko\'ring.',
  unknown: 'Kutilmagan xato yuz berdi. Qayta urinib ko\'ring.',
  nokey: 'Gemini API kaliti kiritilmagan. Sozlamalar → API kalit bo\'limida kiriting.'
}

/** SSE oqimini satrlarga ajratib, "data: {...}" JSON larini qaytaradi */
export async function* parseSse(stream: ReadableStream<Uint8Array>): AsyncGenerator<any> {
  const reader = stream.getReader()
  const dec = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let i: number
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).replace(/\r$/, '')
      buf = buf.slice(i + 1)
      if (line.startsWith('data:')) {
        const d = line.slice(5).trim()
        if (d && d !== '[DONE]') { try { yield JSON.parse(d) } catch { /* to'liq bo'lmagan bo'lak */ } }
      }
    }
  }
  const rest = buf.trim()
  if (rest.startsWith('data:')) { try { yield JSON.parse(rest.slice(5).trim()) } catch { /* e'tiborsiz */ } }
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export async function streamGemini(o: StreamOpts): Promise<StreamResult> {
  const f = o.fetchImpl ?? fetch
  const sleep = o.sleep ?? defaultSleep
  const max = o.maxRetries ?? 5
  const url = `${o.baseUrl ?? DEFAULT_BASE}/models/${encodeURIComponent(o.model)}:streamGenerateContent?alt=sse`
  for (let attempt = 0; ; attempt++) {
    let res: Response
    try {
      res = await f(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': o.key }, body: JSON.stringify(o.body), signal: o.signal })
    } catch (e: any) {
      if (e?.name === 'AbortError') throw e
      throw new GeminiError('offline', ERR_TEXT.offline)
    }
    if (res.status === 429 || res.status === 503 || res.status === 500) {
      if (attempt >= max) throw new GeminiError('rate', ERR_TEXT.rate, res.status)
      const ms = backoffMs(attempt, Number(res.headers.get('retry-after')) || undefined)
      o.onWait?.(Math.ceil(ms / 1000), attempt + 1)
      await sleep(ms)
      continue
    }
    if (!res.ok) {
      let detail = ''
      try { detail = String((await res.json())?.error?.message ?? '') } catch { /* tana yo'q */ }
      if (res.status === 401 || res.status === 403 || (res.status === 400 && /api key/i.test(detail))) throw new GeminiError('key', ERR_TEXT.key, res.status)
      if (res.status === 404) throw new GeminiError('model', ERR_TEXT.model, res.status)
      throw new GeminiError('unknown', `${ERR_TEXT.unknown} (HTTP ${res.status})`, res.status)
    }
    if (!res.body) throw new GeminiError('unknown', ERR_TEXT.unknown)
    let text = '', inTokens = 0, outTokens = 0, blocked = false
    for await (const ev of parseSse(res.body)) {
      const cand = ev?.candidates?.[0]
      const t = (cand?.content?.parts ?? []).filter((p: any) => !p.thought).map((p: any) => p.text ?? '').join('')
      if (t) { text += t; o.onChunk(t) }
      if (cand?.finishReason === 'SAFETY' || ev?.promptFeedback?.blockReason) blocked = true
      if (ev?.usageMetadata) { inTokens = ev.usageMetadata.promptTokenCount ?? inTokens; outTokens = (ev.usageMetadata.candidatesTokenCount ?? 0) + (ev.usageMetadata.thoughtsTokenCount ?? 0) || outTokens }
    }
    if (!text && blocked) throw new GeminiError('blocked', ERR_TEXT.blocked)
    if (!inTokens) inTokens = Math.ceil(JSON.stringify(o.body).length / 4)
    if (!outTokens) outTokens = Math.ceil(text.length / 4)
    return { text, inTokens, outTokens }
  }
}

/** Kesh kaliti: lesson_id + section + model + prompt_version (+ qo'shimcha) */
export function cacheKeyParts(p: { lessonId?: number; section?: string; model: string; promptVersion: string; kind: string; extra?: string }): string {
  return [p.kind, p.lessonId ?? 0, p.section ?? '-', p.model, p.promptVersion, p.extra ?? ''].join('|')
}

/** Matndan maxfiy kalitga o'xshash bo'laklarni olib tashlaydi (loglar va eksport uchun) */
export const redact = (s: string) => s.replace(/AIza[0-9A-Za-z_\-]{20,}/g, '[KALIT YASHIRILDI]').replace(/(key=)[^&\s"']+/gi, '$1[YASHIRILDI]')

/** Model ```json ... ``` bilan o'rab yuborsa ham JSON ni ajratib oladi */
export function extractJson<T = unknown>(s: string): T {
  const t = s.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  const a = t.indexOf('['), b = t.lastIndexOf(']')
  const c = t.indexOf('{'), d = t.lastIndexOf('}')
  const useArr = a >= 0 && (c < 0 || a < c)
  return JSON.parse(useArr ? t.slice(a, b + 1) : t.slice(c, d + 1))
}
