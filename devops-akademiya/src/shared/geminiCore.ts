/**
 * Gemini streaming yadrosi — Electron ga bog'liq emas (birlik testlari uchun).
 * Kalit hech qachon xato xabari yoki logga qo'shilmaydi.
 */
export interface GeminiBody {
  systemInstruction?: { parts: { text: string }[] }
  contents: { role: 'user' | 'model'; parts: { text: string }[] }[]
  generationConfig?: Record<string, unknown>
}
export type ErrCode = 'key' | 'rate' | 'offline' | 'model' | 'blocked' | 'region' | 'quota' | 'disabled' | 'unknown'
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

/** Standart model (2026-11 holatiga: barcha yangi kalitlarda ishlaydi, 3–5 s) */
export const DEFAULT_MODEL = 'gemini-3.5-flash'
export const DEFAULT_PRO_MODEL = 'gemini-pro-latest'
/** Asosiy model ishlamasa (yopilgan / limit 0 / band) navbat bilan sinaladigan modellar */
export const FALLBACK_MODELS = ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.8-flash', 'gemini-flash-latest'] as const
/** Google yangi foydalanuvchilar uchun yopgan modellar — saqlangan sozlamalarda avtomatik almashtiriladi */
export const isRetiredModel = (m: string) => /^gemini-(1\.|2\.0|2\.5)/.test(m)
export const modelChain = (primary: string): string[] => [...new Set([primary, ...FALLBACK_MODELS])]
/** Shu xatolarda keyingi modelga o'tish mantiqli: model yo'q, limit 0, haddan tashqari band */
export const isFallbackError = (e: unknown) => e instanceof GeminiError && (e.code === 'model' || e.code === 'quota' || e.code === 'rate')
export const backoffMs = (attempt: number, retryAfter?: number) =>
  retryAfter && retryAfter > 0 ? Math.min(retryAfter * 1000, 60_000) : Math.min(2000 * 2 ** attempt, 32_000)

export const ERR_TEXT: Record<ErrCode | 'nokey', string> = {
  key: 'API kalit noto\'g\'ri yoki bekor qilingan. Sozlamalarda kalitni tekshiring.',
  rate: 'So\'rovlar limiti tugadi (429). Birozdan keyin qayta urinib ko\'ring yoki boshqa model tanlang.',
  offline: 'Internet aloqasi yo\'q — oflayn rejim. Tayyor darslar va keshlangan javoblar ishlayveradi.',
  model: 'Model topilmadi yoki Google uni yopgan. Sozlamalarda model nomini tekshiring (masalan: gemini-3.5-flash).',
  blocked: 'Javob xavfsizlik filtri tomonidan to\'xtatildi. Savolni boshqacha ifodalab ko\'ring.',
  region: 'Gemini API sizning hududingizda (yoki tarmog\'ingiz IP manzilida) ishlamaydi. Boshqa tarmoqdan urinib ko\'ring.',
  quota: 'Bu kalit uchun tanlangan modelda bepul limit yo\'q (limit: 0). Sozlamalarda gemini-3.5-flash yoki gemini-3.5-flash-lite ni tanlang yoki Google AI Studio\'da billing yoqing.',
  disabled: 'Kalit tegishli Google Cloud loyihasida "Generative Language API" yoqilmagan. Kalitni aistudio.google.com da qayta yarating.',
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
      // limit: 0 — kutish yordam bermaydi (bepul tarif bu model/hudud uchun yo'q): darhol to'xtaymiz
      const detail = res.status === 429 ? await errorDetail(res) : ''
      if (/limit:\s*0\b/.test(detail)) throw new GeminiError('quota', withDetail(ERR_TEXT.quota, detail), 429)
      if (attempt >= max) throw new GeminiError('rate', withDetail(ERR_TEXT.rate, detail), res.status)
      const ms = backoffMs(attempt, Number(res.headers.get('retry-after')) || undefined)
      o.onWait?.(Math.ceil(ms / 1000), attempt + 1)
      await sleep(ms)
      continue
    }
    if (!res.ok) {
      const detail = await errorDetail(res)
      throw classifyHttpError(res.status, detail)
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

async function errorDetail(res: Response): Promise<string> {
  try {
    const raw = await res.text()
    try {
      const e = JSON.parse(raw)?.error
      return [e?.status, e?.message].filter(Boolean).join(': ') || raw.slice(0, 300)
    } catch { return raw.slice(0, 300) }
  } catch { return '' }
}
const withDetail = (msg: string, detail: string) => (detail ? `${msg}\n\nGoogle javobi: ${redact(detail).slice(0, 400)}` : msg)

/** HTTP xatosini foydalanuvchiga tushunarli sababga aylantiradi (Google ning asl xabari ham qo'shiladi) */
export function classifyHttpError(status: number, detail: string): GeminiError {
  const d = detail.toLowerCase()
  const code: ErrCode =
    /location is not supported|not available in your (country|region)|unsupported_location/.test(d) ? 'region'
      : /service_disabled|has not been used in project|api has not been used|is disabled/.test(d) ? 'disabled'
        : status === 401 || status === 403 || /api key not valid|api_key_invalid|api key expired|invalid api key/.test(d) ? 'key'
          : status === 404 ? 'model'
            : 'unknown'
  const base = code === 'unknown' ? `${ERR_TEXT.unknown} (HTTP ${status})` : ERR_TEXT[code]
  return new GeminiError(code, withDetail(base, detail), status)
}

/** Kesh kaliti: lesson_id + section + model + prompt_version (+ qo'shimcha) */
export function cacheKeyParts(p: { lessonId?: number; section?: string; model: string; promptVersion: string; kind: string; extra?: string }): string {
  return [p.kind, p.lessonId ?? 0, p.section ?? '-', p.model, p.promptVersion, p.extra ?? ''].join('|')
}

/** Matndan maxfiy kalitga o'xshash bo'laklarni olib tashlaydi (loglar va eksport uchun) */
export const redact = (s: string) => s.replace(/AIza[0-9A-Za-z_\-]{20,}/g, '[KALIT YASHIRILDI]').replace(/\bAQ\.[0-9A-Za-z_\-]{20,}/g, '[KALIT YASHIRILDI]').replace(/(key=)[^&\s"']+/gi, '$1[YASHIRILDI]')

/** Model ```json ... ``` bilan o'rab yuborsa ham JSON ni ajratib oladi */
export function extractJson<T = unknown>(s: string): T {
  const t = s.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  const a = t.indexOf('['), b = t.lastIndexOf(']')
  const c = t.indexOf('{'), d = t.lastIndexOf('}')
  const useArr = a >= 0 && (c < 0 || a < c)
  return JSON.parse(useArr ? t.slice(a, b + 1) : t.slice(c, d + 1))
}

/**
 * Model zanjiri bilan so'rov: birinchisi ishlamasa (404 / limit 0 / 429-503) keyingisiga o'tadi.
 * Matn oqimi boshlanib bo'lgach o'tilmaydi (yarim javob aralashmasligi uchun).
 * Oxirgi modeldan boshqalarida 503/429 uchun uzoq kutilmaydi — darhol keyingi model sinaladi.
 */
export async function streamWithFallback(o: Omit<StreamOpts, 'model'> & { models: string[]; onModelFail?: (model: string, e: GeminiError) => void }): Promise<StreamResult & { model: string }> {
  let last: unknown
  for (let i = 0; i < o.models.length; i++) {
    const model = o.models[i]
    const isLast = i === o.models.length - 1
    let started = false
    try {
      const r = await streamGemini({ ...o, model, maxRetries: isLast ? o.maxRetries : Math.min(o.maxRetries ?? 5, 1), onChunk: (t) => { started = true; o.onChunk(t) } })
      return { ...r, model }
    } catch (e) {
      if (started || !isFallbackError(e)) throw e
      o.onModelFail?.(model, e as GeminiError)
      last = e
    }
  }
  throw last
}
