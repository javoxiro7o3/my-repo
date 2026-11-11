import data from '@content/curriculum.json'
import type { Curriculum, Lesson, CourseModule } from './types'
export const curriculum = data as unknown as Curriculum
export const LESSONS: Lesson[] = curriculum.lessons
export const MODULES: CourseModule[] = curriculum.modules
export const lessonById = (id: number) => LESSONS.find((l) => l.id === id)
export const moduleById = (id: number) => MODULES.find((m) => m.id === id)
