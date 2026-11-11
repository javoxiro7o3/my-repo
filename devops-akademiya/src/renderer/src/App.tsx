import { lazy, Suspense, useEffect, useRef } from 'react'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { invoke, on } from '@/lib/api'
import { useApp, resolveTheme } from '@/store/app'
import { TooltipProvider, SkeletonText } from '@/components/ui'
import { Sidebar, TitleBar } from '@/components/Layout'
import { CommandPalette, Onboarding, ShortcutsDialog, Toasts, badgeToast } from '@/components/Overlays'
import AiPanel from '@/components/AiPanel'
import Dashboard from '@/pages/Dashboard'

const Lesson = lazy(() => import('@/pages/Lesson'))
const Roadmap = lazy(() => import('@/pages/Roadmap'))
const Review = lazy(() => import('@/pages/Review'))
const SearchPage = lazy(() => import('@/pages/Search'))
const Notes = lazy(() => import('@/pages/Notes'))
const Project = lazy(() => import('@/pages/Project'))
const Settings = lazy(() => import('@/pages/Settings'))
const About = lazy(() => import('@/pages/About'))
const AiLab = lazy(() => import('@/pages/AiLab'))
const Tools = lazy(() => import('@/pages/Tools'))

const THEME_COLORS = { dark: ['#11131f', '#c7cbe6'], light: ['#ffffff', '#30344d'], terminal: ['#0a110c', '#7fe89a'] } as const

export default function App() {
  const { settings, load, set, refreshStats, toast, setSettings } = useApp()
  const loc = useLocation()
  const nav = useNavigate()
  const gPending = useRef(0)

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const up = () => set({ online: navigator.onLine })
    addEventListener('online', up); addEventListener('offline', up)
    const off = on('app:reward', (r: { xp: number; badges: string[]; lessonCompleted: boolean }) => {
      if (r.lessonCompleted) toast({ kind: 'ok', title: 'Dars tugatildi! 🎉', desc: `+${r.xp} XP · atamalar takrorlash kartalariga qo'shildi` })
      else if (r.xp >= 10) toast({ kind: 'xp', title: `+${r.xp} XP` })
      r.badges.forEach((b, i) => setTimeout(() => badgeToast(b), 500 + i * 700))
      void refreshStats()
    })
    return () => { removeEventListener('online', up); removeEventListener('offline', up); off() }
  }, [set, toast, refreshStats])

  // Mavzu (tizim mavzusiga moslashuv bilan)
  useEffect(() => {
    if (!settings) return
    const apply = () => {
      const t = resolveTheme(settings.theme)
      const el = document.documentElement
      el.dataset.theme = t; el.classList.toggle('dark', t !== 'light'); el.classList.toggle('reduce-motion', settings.reducedMotion)
      el.style.setProperty('--reader-size', `${settings.fontSize}px`)
      void invoke('window:theme', { color: THEME_COLORS[t][0], symbol: THEME_COLORS[t][1] })
    }
    apply()
    const mq = matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [settings])

  // Global klaviatura yorliqlari
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const typing = el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || !!el.closest('.monaco-editor, .xterm')
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); set({ palette: !useApp.getState().palette }) }
      else if (mod && e.key === '/') {
        e.preventDefault()
        const open = useApp.getState().settings?.aiPanel
        if (open && document.activeElement?.hasAttribute('data-chat-input')) void setSettings({ aiPanel: false })
        else { if (!open) void setSettings({ aiPanel: true }); setTimeout(() => (document.querySelector('[data-chat-input]') as HTMLElement | null)?.focus(), 80) }
      }
      else if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); void setSettings({ fontSize: Math.min(22, (useApp.getState().settings?.fontSize ?? 16) + 1) }) }
      else if (mod && e.key === '-') { e.preventDefault(); void setSettings({ fontSize: Math.max(13, (useApp.getState().settings?.fontSize ?? 16) - 1) }) }
      else if (!typing && !mod && !e.altKey) {
        if (e.key === '?') set({ shortcuts: true })
        else if (e.key.toLowerCase() === 'g') gPending.current = Date.now()
        else if (Date.now() - gPending.current < 900) {
          const to = ({ h: '/', r: '/roadmap', t: '/tools', a: '/ai', n: '/notes', s: '/settings' } as Record<string, string>)[e.key.toLowerCase()]
          if (to) { nav(to); gPending.current = 0 }
        }
      }
    }
    addEventListener('keydown', h)
    return () => removeEventListener('keydown', h)
  }, [set, setSettings, nav])

  useEffect(() => { if (!/^\/lesson\//.test(loc.pathname)) set({ ctx: {} }) }, [loc.pathname, set])

  if (!settings) return <div className="flex h-full items-center justify-center"><div className="w-80"><SkeletonText lines={5} /></div></div>
  const pageKey = loc.pathname.replace(/^(\/lesson\/\d+).*/, '$1')
  return (
    <MotionConfig reducedMotion={settings.reducedMotion ? 'always' : 'user'}>
      <TooltipProvider delayDuration={250}>
        <div className="flex h-full flex-col">
          <TitleBar />
          <div className="flex min-h-0 flex-1">
            <Sidebar />
            <main className="relative min-w-0 flex-1 overflow-hidden @container" id="main">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={pageKey} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }} className="h-full">
                  <Suspense fallback={<div className="mx-auto max-w-3xl p-10"><SkeletonText lines={10} /></div>}>
                    <Routes location={loc}>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/lesson/:id/:section?" element={<Lesson />} />
                      <Route path="/roadmap" element={<Roadmap />} />
                      <Route path="/review" element={<Review />} />
                      <Route path="/search" element={<SearchPage />} />
                      <Route path="/notes" element={<Notes />} />
                      <Route path="/project/:id" element={<Project />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/about" element={<About />} />
                      <Route path="/ai/:mode?" element={<AiLab />} />
                      <Route path="/tools/:id?" element={<Tools />} />
                      <Route path="*" element={<Dashboard />} />
                    </Routes>
                  </Suspense>
                </motion.div>
              </AnimatePresence>
            </main>
            {settings.aiPanel && <AiPanel />}
          </div>
        </div>
        <CommandPalette /><ShortcutsDialog /><Toasts /><Onboarding />
      </TooltipProvider>
    </MotionConfig>
  )
}
