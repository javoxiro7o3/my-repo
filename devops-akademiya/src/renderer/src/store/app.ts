import { create } from 'zustand'
import type { Settings, Stats } from '@shared/types'
import { invoke } from '@/lib/api'
import { uid } from '@/lib/utils'

export interface Toast { id: string; kind: 'xp' | 'badge' | 'info' | 'error' | 'ok'; title: string; desc?: string; icon?: string }
export interface AiAsk { id: string; text: string; selection?: string; mode?: 'ustoz' | 'sokrat' }

interface AppState {
  settings: Settings | null
  stats: Stats | null
  online: boolean
  palette: boolean
  shortcuts: boolean
  toasts: Toast[]
  /** Dars sahifasi AI paneliga yuboradigan navbatdagi savol */
  ask: AiAsk | null
  ctx: { lessonId?: number; section?: string }
  load: () => Promise<void>
  refreshStats: () => Promise<void>
  setSettings: (p: Partial<Settings>) => Promise<void>
  set: (p: Partial<AppState>) => void
  toast: (t: Omit<Toast, 'id'>) => void
  dismiss: (id: string) => void
  askAi: (text: string, selection?: string, mode?: 'ustoz' | 'sokrat') => void
}

export const useApp = create<AppState>((set, get) => ({
  settings: null, stats: null, online: navigator.onLine, palette: false, shortcuts: false, toasts: [], ask: null, ctx: {},
  load: async () => { const [settings, stats] = await Promise.all([invoke<Settings>('settings:get'), invoke<Stats>('stats:get')]); set({ settings, stats }) },
  refreshStats: async () => set({ stats: await invoke<Stats>('stats:get') }),
  setSettings: async (p) => { set({ settings: { ...(get().settings as Settings), ...p } }); set({ settings: await invoke<Settings>('settings:set', p) }) },
  set: (p) => set(p),
  toast: (t) => { const id = uid(); set({ toasts: [...get().toasts.slice(-3), { ...t, id }] }); setTimeout(() => get().dismiss(id), t.kind === 'badge' ? 6000 : 3200) },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  askAi: (text, selection, mode) => { if (!get().settings?.aiPanel) void get().setSettings({ aiPanel: true }); set({ ask: { id: uid(), text, selection, mode } }) }
}))

export const resolveTheme = (t: Settings['theme']): 'dark' | 'light' | 'terminal' => t === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t
