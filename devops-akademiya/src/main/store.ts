import type BetterSqlite3 from 'better-sqlite3'
import type { ChatMsg, Curriculum, Note, SearchHit, Settings, SrsCard, Stats, Usage } from '@shared/types'
import { SECTION_IDS } from '@shared/sections'
import { XP, MODULE_BADGES, calcStreak, dayKey } from '@shared/gamify'
import { sm2, nextDue, SM2_INITIAL } from '@shared/sm2'

type DB = BetterSqlite3.Database

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS progress (lesson_id INTEGER NOT NULL, section TEXT NOT NULL, completed_at INTEGER NOT NULL, PRIMARY KEY (lesson_id, section));
CREATE TABLE IF NOT EXISTS lesson_done (lesson_id INTEGER PRIMARY KEY, completed_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS ai_cache (key TEXT PRIMARY KEY, lesson_id INTEGER, section TEXT, model TEXT, prompt_version TEXT, content TEXT NOT NULL, tokens INTEGER DEFAULT 0, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS chat_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, thread TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_chat_thread ON chat_messages(thread, id);
CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, lesson_id INTEGER NOT NULL, section TEXT NOT NULL, quote TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', color TEXT NOT NULL DEFAULT 'yellow', created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS bookmarks (lesson_id INTEGER NOT NULL, section TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (lesson_id, section));
CREATE TABLE IF NOT EXISTS quiz_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, lesson_id INTEGER NOT NULL, question_id TEXT NOT NULL, topic TEXT NOT NULL, correct INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS srs_cards (id INTEGER PRIMARY KEY AUTOINCREMENT, lesson_id INTEGER NOT NULL, front TEXT NOT NULL, back TEXT NOT NULL, ef REAL NOT NULL, interval INTEGER NOT NULL, reps INTEGER NOT NULL, due INTEGER NOT NULL, last_review INTEGER, UNIQUE (lesson_id, front));
CREATE TABLE IF NOT EXISTS xp_events (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, amount INTEGER NOT NULL, ref TEXT, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS activity (day TEXT PRIMARY KEY, count INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS badges (id TEXT PRIMARY KEY, unlocked_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS usage (day TEXT PRIMARY KEY, requests INTEGER NOT NULL DEFAULT 0, in_tokens INTEGER NOT NULL DEFAULT 0, out_tokens INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS project_tasks (module_id INTEGER NOT NULL, idx INTEGER NOT NULL, done INTEGER NOT NULL, PRIMARY KEY (module_id, idx));
CREATE TABLE IF NOT EXISTS counters (key TEXT PRIMARY KEY, n INTEGER NOT NULL);
CREATE VIRTUAL TABLE IF NOT EXISTS search USING fts5(lesson_id UNINDEXED, section UNINDEXED, title, body, tokenize = "unicode61 remove_diacritics 2 tokenchars '-_/.'");
`

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark', fontSize: 16, model: 'gemini-2.5-flash', proModel: 'gemini-2.5-pro', hasKey: false,
  onboarded: false, reducedMotion: false, aiPanel: true, name: ''
}
const USER_TABLES = ['settings', 'progress', 'lesson_done', 'chat_messages', 'notes', 'bookmarks', 'quiz_attempts', 'srs_cards', 'xp_events', 'activity', 'badges', 'project_tasks', 'counters'] as const

export interface Reward { xp: number; badges: string[]; lessonCompleted: boolean; moduleCompleted?: number }

export class Store {
  constructor(public db: DB, private cur: Curriculum, private now: () => number = Date.now) {
    db.pragma('journal_mode = WAL')
    db.exec(SCHEMA)
  }

  // ---------- sozlamalar ----------
  getSettings(): Settings {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
    const s: any = { ...DEFAULT_SETTINGS }
    for (const r of rows) if (r.key in s) { try { s[r.key] = JSON.parse(r.value) } catch { /* buzilgan qiymat */ } }
    return s
  }
  setSettings(patch: Partial<Settings>): Settings {
    const st = this.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    for (const [k, v] of Object.entries(patch)) if (k in DEFAULT_SETTINGS && k !== 'hasKey') st.run(k, JSON.stringify(v))
    return this.getSettings()
  }
  kv(key: string, value?: unknown): any {
    if (value !== undefined) this.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('kv:' + key, JSON.stringify(value))
    const r = this.db.prepare('SELECT value FROM settings WHERE key = ?').get('kv:' + key) as { value: string } | undefined
    return r ? JSON.parse(r.value) : undefined
  }

  // ---------- AI kesh ----------
  cacheGet(key: string): string | undefined {
    return (this.db.prepare('SELECT content FROM ai_cache WHERE key = ?').get(key) as { content: string } | undefined)?.content
  }
  cachePut(key: string, m: { lessonId?: number; section?: string; model: string; promptVersion: string; content: string; tokens?: number }) {
    this.db.prepare('INSERT OR REPLACE INTO ai_cache (key, lesson_id, section, model, prompt_version, content, tokens, created_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(key, m.lessonId ?? null, m.section ?? null, m.model, m.promptVersion, m.content, m.tokens ?? 0, this.now())
  }
  cacheDelete(key: string) { this.db.prepare('DELETE FROM ai_cache WHERE key = ?').run(key) }
  cacheClear() { this.db.exec('DELETE FROM ai_cache') }
  cachedSections(lessonId: number): string[] {
    return (this.db.prepare("SELECT DISTINCT section FROM ai_cache WHERE lesson_id = ? AND key LIKE 'section|%'").all(lessonId) as { section: string }[]).map((r) => r.section)
  }

  // ---------- hisoblagich / foydalanish ----------
  addUsage(inT: number, outT: number) {
    this.db.prepare('INSERT INTO usage (day, requests, in_tokens, out_tokens) VALUES (?, 1, ?, ?) ON CONFLICT(day) DO UPDATE SET requests = requests + 1, in_tokens = in_tokens + excluded.in_tokens, out_tokens = out_tokens + excluded.out_tokens')
      .run(dayKey(this.now()), inT, outT)
  }
  usage(): Usage {
    const t = this.db.prepare('SELECT COALESCE(SUM(requests),0) r, COALESCE(SUM(in_tokens),0) i, COALESCE(SUM(out_tokens),0) o FROM usage').get() as any
    const d = (this.db.prepare('SELECT requests r, in_tokens i, out_tokens o FROM usage WHERE day = ?').get(dayKey(this.now())) as any) ?? { r: 0, i: 0, o: 0 }
    const c = (this.db.prepare('SELECT COUNT(*) n FROM ai_cache').get() as any).n
    return { requests: t.r, inTokens: t.i, outTokens: t.o, today: { requests: d.r, inTokens: d.i, outTokens: d.o }, cacheEntries: c }
  }

  // ---------- XP, faollik, badge ----------
  private bump(key: string, by = 1): number {
    this.db.prepare('INSERT INTO counters (key, n) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET n = n + excluded.n').run(key, by)
    return (this.db.prepare('SELECT n FROM counters WHERE key = ?').get(key) as { n: number }).n
  }
  private counter(key: string): number { return (this.db.prepare('SELECT n FROM counters WHERE key = ?').get(key) as { n: number } | undefined)?.n ?? 0 }
  private addXp(kind: string, amount: number, ref?: string) {
    this.db.prepare('INSERT INTO xp_events (kind, amount, ref, created_at) VALUES (?,?,?,?)').run(kind, amount, ref ?? null, this.now())
    this.db.prepare('INSERT INTO activity (day, count) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET count = count + 1').run(dayKey(this.now()))
  }
  private unlock(id: string, out: string[]) {
    const r = this.db.prepare('INSERT OR IGNORE INTO badges (id, unlocked_at) VALUES (?, ?)').run(id, this.now())
    if (r.changes) out.push(id)
  }
  private activityMap(): Record<string, number> {
    return Object.fromEntries((this.db.prepare('SELECT day, count FROM activity').all() as { day: string; count: number }[]).map((r) => [r.day, r.count]))
  }
  private checkGlobalBadges(out: string[]) {
    const streak = calcStreak(this.activityMap(), this.now())
    if (streak >= 3) this.unlock('streak-3', out)
    if (streak >= 7) this.unlock('streak-7', out)
    if (streak >= 30) this.unlock('streak-30', out)
    const h = new Date(this.now()).getHours()
    if (h >= 0 && h < 5) this.unlock('night-owl', out)
    const qc = this.counter('quiz_correct')
    if (qc >= 50) this.unlock('quiz-50', out)
    if (qc >= 250) this.unlock('quiz-250', out)
    if (this.counter('reviews') >= 100) this.unlock('reviewer', out)
    if (this.counter('breakfix') >= 10) this.unlock('breaker', out)
  }

  // ---------- progress ----------
  markSection(lessonId: number, section: string): Reward {
    const lesson = this.cur.lessons.find((l) => l.id === lessonId)
    const reward: Reward = { xp: 0, badges: [], lessonCompleted: false }
    if (!lesson || !SECTION_IDS.includes(section as any)) return reward
    this.db.transaction(() => {
      const r = this.db.prepare('INSERT OR IGNORE INTO progress (lesson_id, section, completed_at) VALUES (?,?,?)').run(lessonId, section, this.now())
      if (!r.changes) return
      this.addXp('section', XP.section, `${lessonId}:${section}`); reward.xp += XP.section
      this.unlock('first-step', reward.badges)
      const done = (this.db.prepare('SELECT COUNT(*) n FROM progress WHERE lesson_id = ?').get(lessonId) as { n: number }).n
      if (done >= SECTION_IDS.length) {
        const ld = this.db.prepare('INSERT OR IGNORE INTO lesson_done (lesson_id, completed_at) VALUES (?,?)').run(lessonId, this.now())
        if (ld.changes) {
          reward.lessonCompleted = true
          this.addXp('lesson', XP.lessonDone, String(lessonId)); reward.xp += XP.lessonDone
          this.addCards(lessonId, lesson.glossary.map((g) => ({ front: `«${g.term}» nima?`, back: g.def })))
          const mod = this.cur.modules.find((m) => m.id === lesson.module)!
          const doneInMod = (this.db.prepare(`SELECT COUNT(*) n FROM lesson_done WHERE lesson_id IN (${mod.lessons.join(',')})`).get() as { n: number }).n
          if (doneInMod === mod.lessons.length) { reward.moduleCompleted = mod.id; this.unlock(MODULE_BADGES[mod.id - 1], reward.badges) }
        }
      }
      this.checkGlobalBadges(reward.badges)
    })()
    this.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('kv:last', JSON.stringify({ lessonId, section }))
    return reward
  }
  setLast(lessonId: number, section: string) { this.kv('last', { lessonId, section }) }

  event(kind: 'lab' | 'breakfix', ref: string): Reward {
    const reward: Reward = { xp: 0, badges: [], lessonCompleted: false }
    const seen = this.db.prepare('SELECT 1 FROM xp_events WHERE kind = ? AND ref = ?').get(kind, ref)
    if (seen) return reward
    this.addXp(kind, XP[kind], ref); reward.xp = XP[kind]
    if (kind === 'breakfix') this.bump('breakfix')
    this.checkGlobalBadges(reward.badges)
    return reward
  }

  // ---------- test ----------
  recordQuiz(lessonId: number, answers: { questionId: string; topic: string; correct: boolean; front?: string; back?: string }[]): Reward {
    const reward: Reward = { xp: 0, badges: [], lessonCompleted: false }
    this.db.transaction(() => {
      const ins = this.db.prepare('INSERT INTO quiz_attempts (lesson_id, question_id, topic, correct, created_at) VALUES (?,?,?,?,?)')
      for (const a of answers) {
        ins.run(lessonId, a.questionId, a.topic, a.correct ? 1 : 0, this.now())
        if (a.correct) { this.addXp('quiz', XP.quizCorrect, `${lessonId}:${a.questionId}`); reward.xp += XP.quizCorrect; this.bump('quiz_correct') }
        else if (a.front && a.back) this.addCards(lessonId, [{ front: a.front, back: a.back }])
      }
      this.checkGlobalBadges(reward.badges)
    })()
    return reward
  }
  weakTopics(lessonId?: number): Stats['weakTopics'] {
    const rows = this.db.prepare(`SELECT topic, lesson_id lessonId, SUM(1 - correct) wrong, COUNT(*) total FROM quiz_attempts ${lessonId ? 'WHERE lesson_id = ?' : ''} GROUP BY lesson_id, topic HAVING wrong > 0 ORDER BY CAST(wrong AS REAL) / total DESC, wrong DESC LIMIT 12`).all(...(lessonId ? [lessonId] : [])) as any[]
    return rows
  }

  // ---------- SM-2 ----------
  addCards(lessonId: number, cards: { front: string; back: string }[]) {
    const st = this.db.prepare('INSERT OR IGNORE INTO srs_cards (lesson_id, front, back, ef, interval, reps, due) VALUES (?,?,?,?,?,?,?)')
    for (const c of cards) st.run(lessonId, c.front.slice(0, 500), c.back.slice(0, 2000), SM2_INITIAL.ef, 0, 0, this.now())
  }
  dueCards(limit = 30): SrsCard[] {
    return this.db.prepare('SELECT id, lesson_id lessonId, front, back, ef, interval, reps, due FROM srs_cards WHERE due <= ? ORDER BY due LIMIT ?').all(this.now(), limit) as SrsCard[]
  }
  reviewCard(id: number, q: number): Reward {
    const reward: Reward = { xp: 0, badges: [], lessonCompleted: false }
    const c = this.db.prepare('SELECT ef, interval, reps FROM srs_cards WHERE id = ?').get(id) as { ef: number; interval: number; reps: number } | undefined
    if (!c) return reward
    const n = sm2(c, q)
    // q < 3 bo'lsa karta shu sessiyada qayta ko'rsatiladi (10 daqiqadan keyin)
    const due = q < 3 ? this.now() + 10 * 60_000 : nextDue(n, this.now())
    this.db.prepare('UPDATE srs_cards SET ef = ?, interval = ?, reps = ?, due = ?, last_review = ? WHERE id = ?').run(n.ef, n.interval, n.reps, due, this.now(), id)
    this.addXp('review', XP.review, String(id)); reward.xp = XP.review
    this.bump('reviews'); this.checkGlobalBadges(reward.badges)
    return reward
  }

  // ---------- eslatma, bookmark ----------
  notes(lessonId?: number): Note[] {
    return this.db.prepare(`SELECT id, lesson_id lessonId, section, quote, note, color, created_at createdAt FROM notes ${lessonId ? 'WHERE lesson_id = ?' : ''} ORDER BY id DESC`).all(...(lessonId ? [lessonId] : [])) as Note[]
  }
  addNote(n: { lessonId: number; section: string; quote: string; note: string; color?: string }): Note[] {
    this.db.prepare('INSERT INTO notes (lesson_id, section, quote, note, color, created_at) VALUES (?,?,?,?,?,?)').run(n.lessonId, n.section, n.quote.slice(0, 2000), n.note.slice(0, 5000), n.color ?? 'yellow', this.now())
    return this.notes(n.lessonId)
  }
  updateNote(id: number, note: string) { this.db.prepare('UPDATE notes SET note = ? WHERE id = ?').run(note.slice(0, 5000), id) }
  deleteNote(id: number) { this.db.prepare('DELETE FROM notes WHERE id = ?').run(id) }
  toggleBookmark(lessonId: number, section: string): boolean {
    const d = this.db.prepare('DELETE FROM bookmarks WHERE lesson_id = ? AND section = ?').run(lessonId, section)
    if (d.changes) return false
    this.db.prepare('INSERT INTO bookmarks (lesson_id, section, created_at) VALUES (?,?,?)').run(lessonId, section, this.now())
    return true
  }

  // ---------- chat ----------
  chatList(thread: string): ChatMsg[] {
    return this.db.prepare('SELECT id, thread, role, content, created_at createdAt FROM chat_messages WHERE thread = ? ORDER BY id').all(thread) as ChatMsg[]
  }
  chatAdd(m: ChatMsg) { this.db.prepare('INSERT INTO chat_messages (thread, role, content, created_at) VALUES (?,?,?,?)').run(m.thread, m.role, m.content, this.now()) }
  chatClear(thread: string) { this.db.prepare('DELETE FROM chat_messages WHERE thread = ?').run(thread) }

  // ---------- loyihalar ----------
  toggleTask(moduleId: number, idx: number, done: boolean): Reward {
    const reward: Reward = { xp: 0, badges: [], lessonCompleted: false }
    this.db.prepare('INSERT INTO project_tasks (module_id, idx, done) VALUES (?,?,?) ON CONFLICT(module_id, idx) DO UPDATE SET done = excluded.done').run(moduleId, idx, done ? 1 : 0)
    const mod = this.cur.modules.find((m) => m.id === moduleId)
    const n = (this.db.prepare('SELECT COUNT(*) n FROM project_tasks WHERE module_id = ? AND done = 1').get(moduleId) as { n: number }).n
    if (mod && n === mod.project.tasks.length && !this.db.prepare("SELECT 1 FROM xp_events WHERE kind = 'project' AND ref = ?").get(String(moduleId))) {
      this.addXp('project', XP.project, String(moduleId)); reward.xp = XP.project
    }
    return reward
  }

  // ---------- statistika ----------
  stats(): Stats {
    const sectionsDone: Record<number, string[]> = {}
    for (const r of this.db.prepare('SELECT lesson_id, section FROM progress').all() as { lesson_id: number; section: string }[]) (sectionsDone[r.lesson_id] ??= []).push(r.section)
    const activity = this.activityMap()
    let best = 0, run = 0, prev = 0
    for (const d of Object.keys(activity).sort()) { const t = new Date(d + 'T00:00:00').getTime(); run = prev && Math.round((t - prev) / 86_400_000) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = t }
    const q = this.db.prepare('SELECT COALESCE(SUM(correct),0) c, COUNT(*) t FROM quiz_attempts').get() as { c: number; t: number }
    const projects: Record<string, boolean> = {}
    for (const r of this.db.prepare('SELECT module_id, idx, done FROM project_tasks').all() as any[]) projects[`${r.module_id}:${r.idx}`] = !!r.done
    return {
      xp: (this.db.prepare('SELECT COALESCE(SUM(amount),0) n FROM xp_events').get() as { n: number }).n,
      streak: calcStreak(activity, this.now()), bestStreak: best, sectionsDone,
      lessonsDone: (this.db.prepare('SELECT lesson_id FROM lesson_done').all() as { lesson_id: number }[]).map((r) => r.lesson_id),
      activity, weakTopics: this.weakTopics(),
      dueCards: (this.db.prepare('SELECT COUNT(*) n FROM srs_cards WHERE due <= ?').get(this.now()) as { n: number }).n,
      badges: Object.fromEntries((this.db.prepare('SELECT id, unlocked_at FROM badges').all() as any[]).map((r) => [r.id, r.unlocked_at])),
      last: this.kv('last'), quiz: { correct: q.c, total: q.t }, projects,
      bookmarks: this.db.prepare('SELECT lesson_id lessonId, section FROM bookmarks ORDER BY created_at DESC').all() as any[]
    }
  }

  // ---------- qidiruv (FTS5) ----------
  indexDocs(docs: { lessonId: number; section: string; title: string; body: string }[], replaceAll = false) {
    this.db.transaction(() => {
      if (replaceAll) this.db.exec('DELETE FROM search')
      const del = this.db.prepare('DELETE FROM search WHERE lesson_id = ? AND section = ?')
      const ins = this.db.prepare('INSERT INTO search (lesson_id, section, title, body) VALUES (?,?,?,?)')
      for (const d of docs) { if (!replaceAll) del.run(d.lessonId, d.section); ins.run(d.lessonId, d.section, d.title, d.body) }
    })()
  }
  search(q: string, limit = 25): SearchHit[] {
    const terms = q.replace(/["'*^:(){}\[\]]/g, ' ').split(/\s+/).filter((t) => t.length > 1).slice(0, 8)
    if (!terms.length) return []
    const run = (expr: string) => this.db.prepare("SELECT lesson_id lessonId, section, title, snippet(search, 3, '⟦', '⟧', ' … ', 18) snippet FROM search WHERE search MATCH ? ORDER BY bm25(search, 0, 0, 8.0, 1.0) LIMIT ?").all(expr, limit) as SearchHit[]
    try {
      const and = run(terms.map((t) => `"${t}"*`).join(' AND '))
      return and.length ? and : run(terms.map((t) => `"${t}"*`).join(' OR '))
    } catch { return [] }
  }

  // ---------- zaxira ----------
  exportBackup(): string {
    const data: Record<string, unknown[]> = {}
    for (const t of USER_TABLES) data[t] = this.db.prepare(`SELECT * FROM ${t}`).all()
    return JSON.stringify({ app: 'devops-akademiya', schema: 1, exportedAt: new Date(this.now()).toISOString(), data }, null, 1)
  }
  importBackup(json: string) {
    const b = JSON.parse(json)
    if (b?.app !== 'devops-akademiya' || !b.data) throw new Error('Bu fayl DevOps Akademiya zaxira nusxasi emas')
    this.db.transaction(() => {
      for (const t of USER_TABLES) {
        const rows = b.data[t]
        if (!Array.isArray(rows)) continue
        const cols = (this.db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name)
        this.db.exec(`DELETE FROM ${t}`)
        for (const r of rows) {
          const keys = Object.keys(r).filter((k) => cols.includes(k))
          if (keys.length) this.db.prepare(`INSERT OR REPLACE INTO ${t} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map((k) => r[k]))
        }
      }
    })()
  }
  resetProgress() {
    this.db.transaction(() => { for (const t of USER_TABLES) if (t !== 'settings') this.db.exec(`DELETE FROM ${t}`); this.db.exec("DELETE FROM settings WHERE key = 'kv:last'") })()
  }
}
