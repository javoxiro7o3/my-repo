import type { QuizQuestion, SectionId } from './types'

// Qo'lda yozilgan premium darslar: src/content/premium/NN.md (+ NN.quiz.json)
const md = import.meta.glob('../content/premium/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const quiz = import.meta.glob('../content/premium/*.quiz.json', { import: 'default', eager: true }) as Record<string, QuizQuestion[]>

export function splitSections(src: string): Partial<Record<SectionId, string>> {
  const out: Partial<Record<SectionId, string>> = {}
  const re = /<!--\s*@section:\s*(\w+)\s*-->/g
  let m: RegExpExecArray | null, last: { id: string; start: number } | null = null
  while ((m = re.exec(src))) {
    if (last) out[last.id as SectionId] = src.slice(last.start, m.index).trim()
    last = { id: m[1], start: m.index + m[0].length }
  }
  if (last) out[last.id as SectionId] = src.slice(last.start).trim()
  return out
}

const idOf = (p: string) => parseInt(p.split('/').pop()!, 10)
const SECTIONS_BY_LESSON = new Map<number, Partial<Record<SectionId, string>>>()
for (const [p, s] of Object.entries(md)) SECTIONS_BY_LESSON.set(idOf(p), splitSections(s))
const QUIZ_BY_LESSON = new Map<number, QuizQuestion[]>()
for (const [p, q] of Object.entries(quiz)) QUIZ_BY_LESSON.set(idOf(p), q)

export const premiumSection = (lessonId: number, section: SectionId): string | undefined => SECTIONS_BY_LESSON.get(lessonId)?.[section]
export const premiumQuiz = (lessonId: number): QuizQuestion[] | undefined => QUIZ_BY_LESSON.get(lessonId)
export const premiumLessonIds = () => [...SECTIONS_BY_LESSON.keys()].sort((a, b) => a - b)
export const allPremium = () => SECTIONS_BY_LESSON
