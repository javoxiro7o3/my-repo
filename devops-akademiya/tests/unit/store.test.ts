import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import { Store } from '../../src/main/store'
import { curriculum } from '@shared/curriculum'
import { SECTION_IDS } from '@shared/sections'
import { DAY_MS } from '@shared/sm2'

let now = Date.UTC(2026, 10, 10, 12)
const mk = () => new Store(new Database(':memory:'), curriculum, () => now)
let s: Store
beforeEach(() => { now = Date.UTC(2026, 10, 10, 12); s = mk() })

const finishLesson = (id: number) => SECTION_IDS.forEach((sec) => s.markSection(id, sec))

describe('sozlamalar', () => {
  it('standart qiymatlar va saqlash', () => {
    expect(s.getSettings().model).toBe('gemini-3.5-flash')
    s.setSettings({ theme: 'terminal', fontSize: 19 })
    expect(s.getSettings()).toMatchObject({ theme: 'terminal', fontSize: 19 })
  })
  it('noma\'lum kalit va hasKey saqlanmaydi', () => {
    s.setSettings({ nimadir: 1, hasKey: true } as never)
    expect((s.getSettings() as unknown as Record<string, unknown>).nimadir).toBeUndefined()
    expect(s.getSettings().hasKey).toBe(false)
  })
})

describe('AI kesh', () => {
  it('yozish va o\'qish; kalit bo\'yicha ajratish', () => {
    s.cachePut('section|2|theory|m|v1', { lessonId: 2, section: 'theory', model: 'm', promptVersion: 'v1', content: 'matn' })
    expect(s.cacheGet('section|2|theory|m|v1')).toBe('matn')
    expect(s.cacheGet('section|2|theory|m|v2')).toBeUndefined()
  })
  it('cachedSections faqat shu dars bo\'limlarini qaytaradi', () => {
    for (const [k, l, sec] of [['section|2|theory|m|v1', 2, 'theory'], ['section|2|lab|m|v1', 2, 'lab'], ['section|3|theory|m|v1', 3, 'theory']] as const)
      s.cachePut(k, { lessonId: l, section: sec, model: 'm', promptVersion: 'v1', content: 'x' })
    expect(s.cachedSections(2).sort()).toEqual(['lab', 'theory'])
  })
  it('cacheClear hammasini o\'chiradi, usage ni emas', () => {
    s.cachePut('a', { model: 'm', promptVersion: 'v', content: 'x' }); s.addUsage(10, 20)
    s.cacheClear()
    expect(s.cacheGet('a')).toBeUndefined(); expect(s.usage().inTokens).toBe(10)
  })
})

describe('foydalanish hisoblagichi', () => {
  it('bugun va jami alohida sanaladi', () => {
    s.addUsage(100, 50); s.addUsage(10, 5)
    now += DAY_MS
    s.addUsage(1, 2)
    const u = s.usage()
    expect(u).toMatchObject({ requests: 3, inTokens: 111, outTokens: 57 })
    expect(u.today).toMatchObject({ requests: 1, inTokens: 1, outTokens: 2 })
  })
})

describe('progress va XP', () => {
  it('bo\'limni tugatish XP beradi, takrori bermaydi', () => {
    expect(s.markSection(2, 'theory').xp).toBe(10)
    expect(s.markSection(2, 'theory').xp).toBe(0)
    expect(s.stats().xp).toBe(10)
  })
  it('noto\'g\'ri bo\'lim yoki dars e\'tiborsiz qoldiriladi', () => {
    expect(s.markSection(2, 'yoq-bolim').xp).toBe(0)
    expect(s.markSection(999, 'theory').xp).toBe(0)
  })
  it('13 bo\'lim tugasa — dars tugaydi, bonus XP va kartalar', () => {
    let total = 0
    SECTION_IDS.forEach((sec) => { total += s.markSection(2, sec).xp })
    expect(total).toBe(13 * 10 + 50)
    const st = s.stats()
    expect(st.lessonsDone).toContain(2)
    expect(s.dueCards().length).toBeGreaterThan(0)   // atamalar kartaga aylandi
  })
  it('modul tugasa nishon beriladi', () => {
    const mod = curriculum.modules[0]
    let badges: string[] = []
    mod.lessons.forEach((id) => SECTION_IDS.forEach((sec) => { badges = badges.concat(s.markSection(id, sec).badges) }))
    expect(badges).toContain('linux-ninja')
    expect(Object.keys(s.stats().badges)).toContain('first-step')
  })
  it('streak ketma-ket kunlarda o\'sadi', () => {
    s.markSection(2, 'goal'); now += DAY_MS; s.markSection(2, 'why'); now += DAY_MS; s.markSection(2, 'theory')
    const st = s.stats()
    expect(st.streak).toBe(3); expect(st.bestStreak).toBe(3)
  })
  it('lab/breakfix hodisalari bir marta sanaladi', () => {
    expect(s.event('lab', 'terminal:t1').xp).toBe(30)
    expect(s.event('lab', 'terminal:t1').xp).toBe(0)
    expect(s.event('breakfix', '11:x').xp).toBe(20)
  })
})

describe('test natijalari', () => {
  it('to\'g\'ri javob XP beradi, xato — karta yaratadi', () => {
    const r = s.recordQuiz(2, [
      { questionId: 'q1', topic: 'pipe', correct: true },
      { questionId: 'q2', topic: 'grep', correct: false, front: 'grep -c nima?', back: 'sanaydi' }
    ])
    expect(r.xp).toBe(5)
    expect(s.stats().quiz).toEqual({ correct: 1, total: 2 })
    expect(s.dueCards().some((c) => c.front === 'grep -c nima?')).toBe(true)
  })
  it('zaif mavzular xato ulushi bo\'yicha tartiblanadi', () => {
    s.recordQuiz(2, [{ questionId: 'a', topic: 'awk', correct: false }, { questionId: 'b', topic: 'awk', correct: false }])
    s.recordQuiz(2, [{ questionId: 'c', topic: 'sed', correct: false }, { questionId: 'd', topic: 'sed', correct: true }])
    const w = s.weakTopics()
    expect(w[0].topic).toBe('awk'); expect(w[0]).toMatchObject({ wrong: 2, total: 2 })
    expect(s.weakTopics(3)).toHaveLength(0)
  })
})

describe('SM-2 kartalar', () => {
  it('yangi kartalar darhol takrorlashga tayyor; dublikat qo\'shilmaydi', () => {
    s.addCards(2, [{ front: 'A', back: '1' }, { front: 'A', back: '1' }])
    expect(s.dueCards()).toHaveLength(1)
  })
  it('yaxshi javob kartani kelajakka suradi', () => {
    s.addCards(2, [{ front: 'A', back: '1' }])
    const id = s.dueCards()[0].id
    expect(s.reviewCard(id, 5).xp).toBe(3)
    expect(s.dueCards()).toHaveLength(0)
    now += DAY_MS + 1000
    expect(s.dueCards()).toHaveLength(1)   // 1 kundan keyin qaytdi
  })
  it('"bilmadim" kartani shu sessiyada qaytaradi', () => {
    s.addCards(2, [{ front: 'A', back: '1' }])
    s.reviewCard(s.dueCards()[0].id, 1)
    expect(s.dueCards()).toHaveLength(0)
    now += 11 * 60_000
    expect(s.dueCards()).toHaveLength(1)
  })
})

describe('eslatmalar va xatcho\'plar', () => {
  it('qo\'shish, yangilash, o\'chirish', () => {
    s.addNote({ lessonId: 2, section: 'theory', quote: 'matn', note: 'izoh' })
    const n = s.notes(2)
    expect(n).toHaveLength(1); expect(n[0].note).toBe('izoh')
    s.updateNote(n[0].id, 'yangi')
    expect(s.notes(2)[0].note).toBe('yangi')
    s.deleteNote(n[0].id)
    expect(s.notes()).toHaveLength(0)
  })
  it('xatcho\'p almashtiriladi', () => {
    expect(s.toggleBookmark(2, 'lab')).toBe(true)
    expect(s.stats().bookmarks).toEqual([{ lessonId: 2, section: 'lab' }])
    expect(s.toggleBookmark(2, 'lab')).toBe(false)
    expect(s.stats().bookmarks).toHaveLength(0)
  })
})

describe('chat', () => {
  it('thread bo\'yicha ajratiladi va tozalanadi', () => {
    s.chatAdd({ thread: 'lesson:2', role: 'user', content: 'salom' })
    s.chatAdd({ thread: 'lesson:2', role: 'model', content: 'javob' })
    s.chatAdd({ thread: 'global', role: 'user', content: 'boshqa' })
    expect(s.chatList('lesson:2').map((m) => m.role)).toEqual(['user', 'model'])
    s.chatClear('lesson:2')
    expect(s.chatList('lesson:2')).toHaveLength(0); expect(s.chatList('global')).toHaveLength(1)
  })
})

describe('to\'liq matnli qidiruv (FTS5)', () => {
  beforeEach(() => {
    s.indexDocs([
      { lessonId: 11, section: 'theory', title: 'Docker: containers', body: 'namespaces va cgroups yadro mexanizmlari' },
      { lessonId: 38, section: 'theory', title: 'Kubernetes', body: 'Pod Pending holatida: scheduler node topa olmadi' }
    ], true)
  })
  it('so\'z bo\'yicha topadi va snippet qaytaradi', () => {
    const r = s.search('cgroups')
    expect(r).toHaveLength(1); expect(r[0].lessonId).toBe(11); expect(r[0].snippet).toContain('⟦')
  })
  it('bir necha so\'z: avval AND, topilmasa OR', () => {
    expect(s.search('Pod Pending')[0].lessonId).toBe(38)
    expect(s.search('cgroups Pending').length).toBe(2)   // AND bo'sh → OR
  })
  it('prefiks bo\'yicha qidiradi va maxsus belgilardan qulamaydi', () => {
    expect(s.search('namesp').length).toBe(1)
    expect(() => s.search('"((*')).not.toThrow()
    expect(s.search('')).toEqual([])
  })
  it('qayta indekslashda dublikat bo\'lmaydi', () => {
    s.indexDocs([{ lessonId: 11, section: 'theory', title: 'Docker', body: 'namespaces yangilandi' }])
    const r = s.search('namespaces')
    expect(r).toHaveLength(1); expect(r[0].snippet).toContain('yangilandi')
  })
})

describe('zaxira va tiklash', () => {
  it('progress eksport va importdan keyin saqlanadi', () => {
    finishLesson(2); s.addNote({ lessonId: 2, section: 'theory', quote: 'q', note: 'n' }); s.setSettings({ fontSize: 20 })
    const dump = s.exportBackup()
    expect(dump).not.toContain('gemini.key')
    const s2 = mk()
    s2.importBackup(dump)
    expect(s2.stats().lessonsDone).toContain(2)
    expect(s2.notes(2)).toHaveLength(1)
    expect(s2.getSettings().fontSize).toBe(20)
  })
  it('begona fayl rad etiladi', () => {
    expect(() => s.importBackup('{"app":"boshqa"}')).toThrow(/zaxira nusxasi emas/)
  })
  it('resetProgress progressni o\'chiradi, sozlama va keshni qoldiradi', () => {
    finishLesson(2); s.setSettings({ fontSize: 21 }); s.cachePut('k', { model: 'm', promptVersion: 'v', content: 'c' })
    s.resetProgress()
    const st = s.stats()
    expect(st.xp).toBe(0); expect(st.lessonsDone).toHaveLength(0); expect(st.last).toBeUndefined()
    expect(s.getSettings().fontSize).toBe(21); expect(s.cacheGet('k')).toBe('c')
  })
})

describe('loyiha vazifalari', () => {
  it('hamma vazifa bajarilsa bir marta XP beriladi', () => {
    const m = curriculum.modules[0]
    let xp = 0
    m.project.tasks.forEach((_, i) => { xp += s.toggleTask(m.id, i, true).xp })
    expect(xp).toBe(200)
    expect(s.toggleTask(m.id, 0, true).xp).toBe(0)
    expect(s.stats().projects[`${m.id}:0`]).toBe(true)
  })
})

describe('Model sozlamalari migratsiyasi', () => {
  it('saqlangan gemini-2.5-* modellar yangisiga almashtiriladi, boshqalari saqlanadi', () => {
    const s = mk()
    s.setSettings({ model: 'gemini-2.5-flash', proModel: 'gemini-2.5-pro' })
    expect(s.getSettings().model).toBe('gemini-3.5-flash')
    expect(s.getSettings().proModel).toBe('gemini-pro-latest')
    s.setSettings({ model: 'gemini-3.5-flash-lite' })
    expect(s.getSettings().model).toBe('gemini-3.5-flash-lite')
  })
})
