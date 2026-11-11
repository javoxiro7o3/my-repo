import type { SectionId } from './types'

export interface SectionMeta { id: SectionId; icon: string; title: string; hint: string; source: 'static' | 'ai' }

/** Har bir dars uchun majburiy 13 bo'limli shablon */
export const SECTIONS: SectionMeta[] = [
  { id: 'goal', icon: '🎯', title: 'Maqsad va natija', hint: 'Dars oxirida nimani bilasiz va qila olasiz', source: 'static' },
  { id: 'why', icon: '🧠', title: 'Nega bu kerak?', hint: 'Muammo → yechim, tarixiy va amaliy kontekst', source: 'ai' },
  { id: 'theory', icon: '📚', title: 'Nazariya — chuqur', hint: 'Asosiy tushunchalar va atamalar lug\'ati', source: 'ai' },
  { id: 'internals', icon: '⚙️', title: 'Ichida qanday ishlaydi', hint: 'Kernel, protokol, algoritm darajasidagi mexanizm', source: 'ai' },
  { id: 'commands', icon: '💻', title: 'Buyruqlar va konfiguratsiya', hint: 'Qator-qator, flag-flag tahlil', source: 'ai' },
  { id: 'lab', icon: '🧪', title: 'Amaliy laboratoriya', hint: 'Qadamma-qadam topshiriq va tekshirish', source: 'ai' },
  { id: 'breakfix', icon: '🔥', title: 'Buzib o\'rgan', hint: 'Ataylab buzilgan konfiguratsiyani toping va tuzating', source: 'ai' },
  { id: 'errors', icon: '⚠️', title: 'Xatolar va debug', hint: 'Xato xabari → sabab → yechim', source: 'ai' },
  { id: 'production', icon: '🏭', title: 'Production maslahatlari', hint: 'Security, performance, best practices', source: 'ai' },
  { id: 'quiz', icon: '🧩', title: 'Mini-test', hint: '8–15 savol, har biriga tushuntirish', source: 'ai' },
  { id: 'interview', icon: '🎤', title: 'Intervyu savollari', hint: 'Real savollar va namunaviy javoblar', source: 'ai' },
  { id: 'cheatsheet', icon: '📝', title: 'Cheat-sheet', hint: 'Bir sahifalik xulosa (PDF eksport)', source: 'ai' },
  { id: 'related', icon: '🔗', title: 'Bog\'liq darslar', hint: 'Oldingi va keyingi mavzular xaritasi', source: 'static' }
]
export const SECTION_IDS = SECTIONS.map((s) => s.id)
export const sectionMeta = (id: string) => SECTIONS.find((s) => s.id === id) ?? SECTIONS[0]
