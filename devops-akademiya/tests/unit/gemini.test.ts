import { describe, expect, it, vi } from 'vitest'
import { backoffMs, cacheKeyParts, extractJson, GeminiError, parseSse, redact, streamGemini } from '@shared/geminiCore'
import { PROMPT_VERSION, SYSTEM_PROMPT, buildRequest, sectionPrompt } from '@shared/prompts'
import { lessonById } from '@shared/curriculum'

const sse = (chunks: string[]) => new ReadableStream<Uint8Array>({ start(c) { for (const x of chunks) c.enqueue(new TextEncoder().encode(x)); c.close() } })
const ev = (text: string, extra: object = {}) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }], ...extra })}\n\n`
const ok = (chunks: string[]) => new Response(sse(chunks), { status: 200 })
const body = { contents: [{ role: 'user' as const, parts: [{ text: 'salom' }] }] }

describe('SSE tahlili', () => {
  it('bo\'laklar orasida uzilgan satrlarni to\'g\'ri yig\'adi', async () => {
    const full = ev('Sal') + ev('om'); const out: string[] = []
    for await (const e of parseSse(sse([full.slice(0, 17), full.slice(17, 60), full.slice(60)]))) out.push(e.candidates[0].content.parts[0].text)
    expect(out).toEqual(['Sal', 'om'])
  })
  it('[DONE] va bo\'sh satrlarni o\'tkazib yuboradi', async () => {
    const out = []; for await (const e of parseSse(sse(['data: [DONE]\n\n', ': izoh\n', ev('x')]))) out.push(e)
    expect(out).toHaveLength(1)
  })
})

describe('streamGemini', () => {
  it('matnni harf-harf uzatadi va tokenlarni qaytaradi', async () => {
    const chunks: string[] = []
    const fetchImpl = vi.fn(async () => ok([ev('Do'), ev('cker', { usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 5 } })]))
    const r = await streamGemini({ key: 'K', model: 'gemini-2.5-flash', body, fetchImpl: fetchImpl as any, onChunk: (t) => chunks.push(t) })
    expect(chunks).toEqual(['Do', 'cker']); expect(r).toEqual({ text: 'Docker', inTokens: 12, outTokens: 5 })
    const [url, init] = fetchImpl.mock.calls[0] as any
    expect(url).toContain('/models/gemini-2.5-flash:streamGenerateContent?alt=sse')
    expect(url).not.toContain('K'); expect(init.headers['x-goog-api-key']).toBe('K') // kalit URL da emas, sarlavhada
  })
  it('429 da exponential backoff bilan qayta urinadi', async () => {
    const waits: number[] = []; const sleeps: number[] = []; let n = 0
    const fetchImpl = async () => (++n < 3 ? new Response('', { status: 429 }) : ok([ev('ok')]))
    const r = await streamGemini({ key: 'K', model: 'm', body, fetchImpl: fetchImpl as any, onChunk: () => {}, onWait: (s) => waits.push(s), sleep: async (ms) => { sleeps.push(ms) } })
    expect(r.text).toBe('ok'); expect(sleeps).toEqual([2000, 4000]); expect(waits).toEqual([2, 4])
  })
  it('Retry-After sarlavhasini hurmat qiladi', async () => {
    const sleeps: number[] = []; let n = 0
    const fetchImpl = async () => (++n < 2 ? new Response('', { status: 429, headers: { 'retry-after': '7' } }) : ok([ev('ok')]))
    await streamGemini({ key: 'K', model: 'm', body, fetchImpl: fetchImpl as any, onChunk: () => {}, sleep: async (ms) => { sleeps.push(ms) } })
    expect(sleeps).toEqual([7000])
  })
  it('urinishlar tugasa "rate" xatosi', async () => {
    const p = streamGemini({ key: 'K', model: 'm', body, maxRetries: 2, fetchImpl: (async () => new Response('', { status: 429 })) as any, onChunk: () => {}, sleep: async () => {} })
    await expect(p).rejects.toMatchObject({ code: 'rate' })
  })
  it('401/403 va "API key not valid" → "key"; 404 → "model"', async () => {
    const run = (res: Response) => streamGemini({ key: 'K', model: 'm', body, fetchImpl: (async () => res) as any, onChunk: () => {} })
    await expect(run(new Response('{}', { status: 403 }))).rejects.toMatchObject({ code: 'key' })
    await expect(run(new Response(JSON.stringify({ error: { message: 'API key not valid. Please pass a valid API key.' } }), { status: 400 }))).rejects.toMatchObject({ code: 'key' })
    await expect(run(new Response('{}', { status: 404 }))).rejects.toMatchObject({ code: 'model' })
  })
  it('tarmoq xatosi → "offline"; xato xabarida kalit yo\'q', async () => {
    const p = streamGemini({ key: 'AIzaSyD-MAXFIY-KALIT-1234567890abcdef', model: 'm', body, fetchImpl: (async () => { throw new TypeError('fetch failed: AIzaSyD-MAXFIY-KALIT-1234567890abcdef') }) as any, onChunk: () => {} })
    const e = await p.catch((x) => x)
    expect(e).toBeInstanceOf(GeminiError); expect(e.code).toBe('offline'); expect(e.message).not.toContain('AIza')
  })
  it('xavfsizlik filtri → "blocked"', async () => {
    const p = streamGemini({ key: 'K', model: 'm', body, fetchImpl: (async () => ok([`data: ${JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } })}\n\n`])) as any, onChunk: () => {} })
    await expect(p).rejects.toMatchObject({ code: 'blocked' })
  })
  it('backoffMs chegaralangan', () => { expect(backoffMs(0)).toBe(2000); expect(backoffMs(3)).toBe(16000); expect(backoffMs(10)).toBe(32000); expect(backoffMs(0, 500)).toBe(60000) })
})

describe('yordamchilar', () => {
  it('redact kalitlarni yashiradi', () => {
    expect(redact('xato: AIzaSyA1234567890abcdefghijklmnopqrstuv da')).toBe('xato: [KALIT YASHIRILDI] da')
    expect(redact('https://x/y?key=abc123&z=1')).toBe('https://x/y?key=[YASHIRILDI]&z=1')
  })
  it('kesh kaliti: dars + bo\'lim + model + prompt versiyasi', () => {
    const a = cacheKeyParts({ kind: 'section', lessonId: 15, section: 'theory', model: 'gemini-2.5-flash', promptVersion: 'v1' })
    expect(a).toBe('section|15|theory|gemini-2.5-flash|v1|')
    expect(cacheKeyParts({ kind: 'section', lessonId: 15, section: 'theory', model: 'gemini-2.5-pro', promptVersion: 'v1' })).not.toBe(a)
    expect(cacheKeyParts({ kind: 'section', lessonId: 15, section: 'theory', model: 'gemini-2.5-flash', promptVersion: 'v2' })).not.toBe(a)
  })
  it('extractJson: ```json bilan o\'ralgan va matn orasidagi JSON', () => {
    expect(extractJson('```json\n[{"a":1}]\n```')).toEqual([{ a: 1 }])
    expect(extractJson('Mana natija: {"x": [1,2]} tamom')).toEqual({ x: [1, 2] })
    expect(() => extractJson('json emas')).toThrow()
  })
})

describe('promptlar', () => {
  const l = lessonById(15)!
  it('system prompt o\'zbekcha va 10 qoidadan iborat', () => { expect(SYSTEM_PROMPT).toContain('DevOps Ustoz'); expect(SYSTEM_PROMPT).toContain('10. Mashhur xatolar'); expect(PROMPT_VERSION).toMatch(/\S+/) })
  it('bo\'lim prompti barcha chuqurlik nuqtalarini o\'z ichiga oladi', () => { const p = sectionPrompt(l, 'theory'); for (const d of l.depth) expect(p).toContain(d); expect(p).toContain('Nazariya') })
  it('quiz JSON rejimida so\'raladi', () => { expect(buildRequest({ id: '1', kind: 'section', lessonId: 15, section: 'quiz' }, l).json).toBe(true); expect(buildRequest({ id: '1', kind: 'section', lessonId: 15, section: 'why' }, l).json).toBe(false) })
  it('sokratik rejim to\'g\'ridan-to\'g\'ri javob bermaslikni buyuradi; kontekst qo\'shiladi', () => {
    const r = buildRequest({ id: '1', kind: 'chat', mode: 'sokrat', text: 'Pipeline nima?', lessonId: 15, section: 'theory', selection: 'tanlangan kod' }, l)
    expect(r.system).toContain('SOKRATIK REJIM'); expect(r.system).toContain(l.title); expect(r.user).toContain('tanlangan kod')
  })
  it('71-dars: Nexus eslatmasi promptga kiradi', () => { expect(sectionPrompt(lessonById(71)!, 'commands')).toMatch(/Nexus/) })
})

describe('Google xato sabablarini aniqlash', () => {
  const run = (status: number, payload: unknown) => streamGemini({ key: 'K', model: 'm', body, maxRetries: 3, fetchImpl: (async () => new Response(JSON.stringify(payload), { status })) as any, onChunk: () => {}, sleep: async () => {} })
  const err = (status: string, message: string) => ({ error: { status, message } })

  it('hudud qo\'llab-quvvatlanmasa "region" va Google xabari ko\'rsatiladi', async () => {
    const p = run(400, err('FAILED_PRECONDITION', 'User location is not supported for the API use.'))
    await expect(p).rejects.toMatchObject({ code: 'region' })
    await expect(run(400, err('FAILED_PRECONDITION', 'User location is not supported for the API use.'))).rejects.toThrow(/Google javobi: FAILED_PRECONDITION: User location/)
  })
  it('API yoqilmagan bo\'lsa "disabled"', async () => {
    await expect(run(403, err('PERMISSION_DENIED', 'Generative Language API has not been used in project 123 before or it is disabled.'))).rejects.toMatchObject({ code: 'disabled' })
  })
  it('noto\'g\'ri kalit 400 bilan kelsa ham "key"', async () => {
    await expect(run(400, err('INVALID_ARGUMENT', 'API key not valid. Please pass a valid API key.'))).rejects.toMatchObject({ code: 'key' })
  })
  it('429 limit: 0 — qayta urinmasdan darhol "quota"', async () => {
    let n = 0
    const fetchImpl = (async () => { n++; return new Response(JSON.stringify(err('RESOURCE_EXHAUSTED', 'Quota exceeded for metric: generate_content_free_tier_requests, limit: 0, model: gemini-2.5-pro')), { status: 429 }) }) as any
    await expect(streamGemini({ key: 'K', model: 'm', body, maxRetries: 5, fetchImpl, onChunk: () => {}, sleep: async () => {} })).rejects.toMatchObject({ code: 'quota' })
    expect(n).toBe(1)
  })
  it('noma\'lum xatoda HTTP kodi va Google xabari, kalit esa yashiriladi', async () => {
    const p = run(400, err('INVALID_ARGUMENT', 'Bad thing with AIzaSyA1234567890abcdefghijklmnop'))
    await expect(p).rejects.toThrow(/HTTP 400[\s\S]*\[KALIT YASHIRILDI\]/)
  })
})
