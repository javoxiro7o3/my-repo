export type SectionId =
  | 'goal' | 'why' | 'theory' | 'internals' | 'commands' | 'lab' | 'breakfix'
  | 'errors' | 'production' | 'quiz' | 'interview' | 'cheatsheet' | 'related'

export interface GlossaryItem { term: string; def: string }

export interface Lesson {
  id: number
  module: number
  title: string
  summary: string
  minutes: number
  versions: string[]
  objectives: string[]
  concepts: string[]
  /** Majburiy chuqurlik nuqtalari — AI generatsiyada hammasi qamrab olinadi */
  depth: string[]
  glossary: GlossaryItem[]
  labs: string[]
  breakfix: string[]
  quizTopics: string[]
  interview: string[]
  related: number[]
  tools: string[]
  premium: boolean
  note?: string
}

export interface ModuleProject { title: string; brief: string; tasks: string[] }

export interface CourseModule {
  id: number
  title: string
  short: string
  summary: string
  color: string
  badge?: { id: string; name: string; desc: string }
  lessons: number[]
  project: ModuleProject
}

export interface Curriculum { version: string; modules: CourseModule[]; lessons: Lesson[] }

export type QuizType = 'mcq' | 'fill' | 'bug' | 'order'
export interface QuizQuestion {
  id: string
  type: QuizType
  topic: string
  q: string
  code?: string
  options?: string[]      // mcq, bug
  answer?: number         // mcq, bug: to'g'ri variant indeksi
  accept?: string[]       // fill: qabul qilinadigan javoblar
  items?: string[]        // order: to'g'ri tartibdagi elementlar
  explain: string
}

export interface AiRequest {
  id: string
  kind: 'section' | 'chat' | 'explain' | 'review' | 'interview' | 'incident' | 'quizgen' | 'recap' | 'search' | 'hint' | 'grade'
  lessonId?: number
  section?: SectionId
  text?: string
  lang?: string
  selection?: string
  mode?: 'ustoz' | 'sokrat'
  history?: { role: 'user' | 'model'; text: string }[]
  weakTopics?: string[]
  force?: boolean
  pro?: boolean
}

export type AiEvent =
  | { id: string; type: 'chunk'; text: string }
  | { id: string; type: 'status'; state: 'waiting'; seconds: number; attempt: number }
  | { id: string; type: 'done'; text: string; cached: boolean }
  | { id: string; type: 'error'; code: 'key' | 'rate' | 'offline' | 'model' | 'nokey' | 'blocked' | 'region' | 'quota' | 'disabled' | 'unknown'; message: string }

export interface Note { id: number; lessonId: number; section: string; quote: string; note: string; color: string; createdAt: number }
export interface SrsCard { id: number; lessonId: number; front: string; back: string; ef: number; interval: number; reps: number; due: number }
export interface ChatMsg { id?: number; thread: string; role: 'user' | 'model'; content: string; createdAt?: number }

export interface Stats {
  xp: number
  streak: number
  bestStreak: number
  sectionsDone: Record<number, string[]>
  lessonsDone: number[]
  activity: Record<string, number>
  weakTopics: { topic: string; lessonId: number; wrong: number; total: number }[]
  dueCards: number
  badges: Record<string, number>
  last?: { lessonId: number; section: string }
  quiz: { correct: number; total: number }
  projects: Record<string, boolean>
  bookmarks: { lessonId: number; section: string }[]
}

export interface Settings {
  theme: 'dark' | 'light' | 'terminal' | 'system'
  fontSize: number
  model: string
  proModel: string
  hasKey: boolean
  onboarded: boolean
  reducedMotion: boolean
  aiPanel: boolean
  name: string
}

export interface Usage { requests: number; inTokens: number; outTokens: number; today: { requests: number; inTokens: number; outTokens: number }; cacheEntries: number }
export interface SearchHit { lessonId: number; section: string; title: string; snippet: string }
