import { app, safeStorage, type WebContents } from 'electron'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AiEvent, AiRequest } from '@shared/types'
import { GeminiError, ERR_TEXT, cacheKeyParts, streamGemini, redact, type GeminiBody } from '@shared/geminiCore'
import { PROMPT_VERSION, buildRequest } from '@shared/prompts'
import { lessonById } from '@shared/curriculum'
import { sectionMeta } from '@shared/sections'
import type { Store } from './store'

const keyFile = () => join(app.getPath('userData'), 'gemini.key.enc')
let memKey: string | null = null // shifrlash mavjud bo'lmagan tizimlarda faqat xotirada

export function hasKey(): boolean { return !!memKey || existsSync(keyFile()) }
function loadKey(): string | null {
  if (memKey) return memKey
  try {
    if (!existsSync(keyFile()) || !safeStorage.isEncryptionAvailable()) return null
    return safeStorage.decryptString(readFileSync(keyFile()))
  } catch { return null }
}
export function saveKey(key: string): { persisted: boolean } {
  if (safeStorage.isEncryptionAvailable()) {
    writeFileSync(keyFile(), safeStorage.encryptString(key), { mode: 0o600 })
    memKey = null
    return { persisted: true }
  }
  memKey = key
  return { persisted: false }
}
export function clearKey() { memKey = null; try { rmSync(keyFile()) } catch { /* yo'q */ } }

const baseUrl = () => process.env.DA_GEMINI_BASE || undefined
const CACHEABLE = new Set(['section', 'recap', 'explain', 'review'])
const active = new Map<string, AbortController>()

export async function testKey(key: string, model: string): Promise<{ ok: boolean; message: string }> {
  try {
    await streamGemini({ key, model, baseUrl: baseUrl(), maxRetries: 1, onChunk: () => {}, body: { contents: [{ role: 'user', parts: [{ text: 'Faqat "OK" deb javob ber.' }] }], generationConfig: { maxOutputTokens: 16, temperature: 0 } } })
    return { ok: true, message: 'Kalit ishlayapti ✓' }
  } catch (e) {
    if (e instanceof GeminiError) return { ok: e.code === 'rate', message: e.code === 'rate' ? 'Kalit to\'g\'ri, lekin hozir limit tugagan (429). Saqlash mumkin.' : e.message }
    return { ok: false, message: ERR_TEXT.unknown }
  }
}

function keyFor(req: AiRequest, model: string): string | null {
  if (!CACHEABLE.has(req.kind)) return null
  const extra = req.kind === 'explain' || req.kind === 'review' ? createHash('sha256').update(`${req.lang}\n${req.text}`).digest('hex').slice(0, 24) : ''
  return cacheKeyParts({ kind: req.kind, lessonId: req.lessonId, section: req.kind === 'section' ? req.section : '-', model, promptVersion: PROMPT_VERSION, extra })
}

export function cachedFor(store: Store, req: AiRequest): string | undefined {
  const s = store.getSettings()
  const k = keyFor(req, req.pro ? s.proModel : s.model)
  return k ? store.cacheGet(k) : undefined
}

export async function startAi(store: Store, req: AiRequest, sender: WebContents): Promise<void> {
  const send = (ev: AiEvent) => { if (!sender.isDestroyed()) sender.send('ai:event', ev) }
  const settings = store.getSettings()
  const model = req.pro ? settings.proModel : settings.model
  const lesson = req.lessonId ? lessonById(req.lessonId) : undefined
  const ck = keyFor(req, model)
  if (ck && !req.force) {
    const hit = store.cacheGet(ck)
    if (hit) return send({ id: req.id, type: 'done', text: hit, cached: true })
  }
  const key = loadKey()
  if (!key) return send({ id: req.id, type: 'error', code: 'nokey', message: ERR_TEXT.nokey })
  if (req.kind === 'section' && !lesson) return send({ id: req.id, type: 'error', code: 'unknown', message: 'Dars topilmadi' })

  const built = buildRequest(req, lesson)
  const body: GeminiBody = {
    systemInstruction: { parts: [{ text: built.system }] },
    contents: [...(req.history ?? []).slice(-24).map((h) => ({ role: h.role, parts: [{ text: h.text }] })), { role: 'user' as const, parts: [{ text: built.user }] }],
    generationConfig: { temperature: built.temperature, maxOutputTokens: 16384, ...(built.json ? { responseMimeType: 'application/json' } : {}) }
  }
  const ac = new AbortController()
  active.set(req.id, ac)
  try {
    const r = await streamGemini({
      key, model, body, baseUrl: baseUrl(), signal: ac.signal,
      onChunk: (text) => send({ id: req.id, type: 'chunk', text }),
      onWait: (seconds, attempt) => send({ id: req.id, type: 'status', state: 'waiting', seconds, attempt })
    })
    store.addUsage(r.inTokens, r.outTokens)
    if (!r.text.trim()) return send({ id: req.id, type: 'error', code: 'unknown', message: 'Model bo\'sh javob qaytardi. Qayta urinib ko\'ring.' })
    if (ck) store.cachePut(ck, { lessonId: req.lessonId, section: req.section, model, promptVersion: PROMPT_VERSION, content: r.text, tokens: r.outTokens })
    if (req.kind === 'section' && lesson && req.section && req.section !== 'quiz')
      store.indexDocs([{ lessonId: lesson.id, section: req.section, title: `${lesson.title} — ${sectionMeta(req.section).title}`, body: r.text }])
    send({ id: req.id, type: 'done', text: r.text, cached: false })
  } catch (e: any) {
    if (e?.name === 'AbortError') return send({ id: req.id, type: 'error', code: 'unknown', message: 'To\'xtatildi' })
    if (e instanceof GeminiError) return send({ id: req.id, type: 'error', code: e.code, message: e.message })
    console.error('[ai]', redact(String(e?.message ?? e)))
    send({ id: req.id, type: 'error', code: 'unknown', message: ERR_TEXT.unknown })
  } finally { active.delete(req.id) }
}

export function cancelAi(id: string) { active.get(id)?.abort(); active.delete(id) }
