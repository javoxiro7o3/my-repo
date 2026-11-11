import { useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Bot, BookMarked, Check, ChevronRight, Flame, Gauge, Keyboard, LayoutDashboard, Map as MapIcon, Moon, Repeat, Search, Settings as SettingsIcon, Sparkles, Sun, Terminal, WifiOff, Wrench, Zap, FolderKanban, Info } from 'lucide-react'
import { LESSONS, MODULES } from '@shared/curriculum'
import { SECTION_IDS } from '@shared/sections'
import { levelFromXp } from '@shared/gamify'
import { cn } from '@/lib/utils'
import { useApp, resolveTheme } from '@/store/app'
import { Button, Kbd, Ring, Tip } from './ui'
import Logo from './Logo'

export function TitleBar() {
  const { stats, settings, setSettings, set, online } = useApp()
  const lv = levelFromXp(stats?.xp ?? 0)
  const theme = resolveTheme(settings?.theme ?? 'dark')
  const next = theme === 'dark' ? 'light' : theme === 'light' ? 'terminal' : 'dark'
  const isMac = window.api.platform === 'darwin'
  return (
    <header className={cn('drag flex h-10 shrink-0 items-center gap-3 border-b bg-panel/80 pl-3 backdrop-blur', isMac ? 'pl-20 pr-3' : 'pr-[150px]')}>
      <div className="flex items-center gap-2"><Logo size={20} /><span className="text-[13px] font-semibold tracking-tight">DevOps Akademiya</span></div>
      <button onClick={() => set({ palette: true })} className="no-drag mx-auto flex h-7 w-[min(420px,40vw)] items-center gap-2 rounded-lg border bg-bg/60 px-2.5 text-[12.5px] text-faint transition hover:border-accent/60 hover:text-muted" aria-label="Qidiruv va buyruqlar palitrasi">
        <Search size={13} /> <span className="flex-1 text-left">Dars, vosita yoki buyruq qidirish…</span> <Kbd>Ctrl K</Kbd>
      </button>
      <div className="no-drag flex items-center gap-1.5">
        {!online && <Tip label="Internet yo'q — tayyor darslar va kesh ishlaydi"><span className="chip !border-warn/40 !text-warn"><WifiOff size={11} /> Oflayn</span></Tip>}
        <Tip label={`Kunlik streak: ${stats?.streak ?? 0} kun (rekord: ${stats?.bestStreak ?? 0})`}><span className={cn('chip tabular-nums', (stats?.streak ?? 0) > 0 && '!border-warn/40 !text-warn')}><Flame size={12} /> {stats?.streak ?? 0}</span></Tip>
        <Tip label={`${lv.title} · ${lv.cur}/${lv.need} XP keyingi darajagacha`}><span className="chip tabular-nums"><Zap size={11} className="text-accent" /> {lv.level}-daraja · {stats?.xp ?? 0} XP</span></Tip>
        <Tip label={`Mavzu: ${theme === 'dark' ? 'Tungi' : theme === 'light' ? 'Kunduzgi' : 'Terminal Green'} → almashtirish`}><Button variant="ghost" size="iconSm" onClick={() => setSettings({ theme: next })} aria-label="Mavzuni almashtirish">{theme === 'dark' ? <Moon size={15} /> : theme === 'light' ? <Sun size={15} /> : <Terminal size={15} />}</Button></Tip>
        <Tip label="Klaviatura yorliqlari (?)"><Button variant="ghost" size="iconSm" onClick={() => set({ shortcuts: true })} aria-label="Klaviatura yorliqlari"><Keyboard size={15} /></Button></Tip>
        <Tip label="AI-Ustoz paneli (Ctrl+/)"><Button variant={settings?.aiPanel ? 'secondary' : 'ghost'} size="iconSm" onClick={() => setSettings({ aiPanel: !settings?.aiPanel })} aria-label="AI-Ustoz panelini ochish/yopish" aria-pressed={!!settings?.aiPanel}><Bot size={15} /></Button></Tip>
      </div>
    </header>
  )
}

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Bosh sahifa', end: true },
  { to: '/roadmap', icon: MapIcon, label: 'Yo\'l xaritasi' },
  { to: '/review', icon: Repeat, label: 'Takrorlash' },
  { to: '/tools', icon: Wrench, label: 'Interaktiv vositalar' },
  { to: '/ai', icon: Sparkles, label: 'AI laboratoriya' },
  { to: '/notes', icon: BookMarked, label: 'Eslatma va xatcho\'plar' }
]

export function Sidebar() {
  const { stats } = useApp()
  const loc = useLocation()
  const nav = useNavigate()
  const curLesson = Number(/^\/lesson\/(\d+)/.exec(loc.pathname)?.[1] ?? 0)
  const curMod = LESSONS.find((l) => l.id === curLesson)?.module
  const [open, setOpen] = useState<Record<number, boolean>>({})
  const isOpen = (id: number) => open[id] ?? (curMod ? curMod === id : id === (LESSONS.find((l) => l.id === stats?.last?.lessonId)?.module ?? 1))
  const done = useMemo(() => new Set(stats?.lessonsDone ?? []), [stats])
  const frac = (id: number) => (stats?.sectionsDone[id]?.length ?? 0) / SECTION_IDS.length
  const total = LESSONS.reduce((a, l) => a + frac(l.id), 0) / LESSONS.length

  return (
    <nav className="flex h-full w-[292px] shrink-0 flex-col border-r bg-panel" aria-label="Asosiy navigatsiya">
      <div className="space-y-0.5 p-2.5">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn('flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13.5px] font-medium transition', isActive ? 'bg-accent/14 text-fg' : 'text-muted hover:bg-elev hover:text-fg')}>
            <n.icon size={16} className="shrink-0" /> <span className="flex-1">{n.label}</span>
            {n.to === '/review' && (stats?.dueCards ?? 0) > 0 && <span className="rounded-full bg-accent px-1.5 text-[10.5px] font-semibold text-accent-fg">{stats!.dueCards}</span>}
          </NavLink>
        ))}
      </div>
      <div className="flex items-center justify-between border-t px-4 pb-1.5 pt-3">
        <span className="label">Kurs · 73 dars</span>
        <span className="flex items-center gap-1.5 text-[11px] tabular-nums text-faint"><Gauge size={11} /> {Math.round(total * 100)}%</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {MODULES.map((m) => {
          const mf = m.lessons.reduce((a, id) => a + frac(id), 0) / m.lessons.length
          const o = isOpen(m.id)
          return (
            <div key={m.id} className="mb-0.5">
              <button onClick={() => setOpen({ ...open, [m.id]: !o })} aria-expanded={o} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-elev">
                <Ring value={mf} size={24} stroke={2.5} color={m.color}><span style={{ color: m.color }}>{m.id}</span></Ring>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{m.title}</span>
                <span className="text-[10.5px] tabular-nums text-faint">{m.lessons.filter((id) => done.has(id)).length}/{m.lessons.length}</span>
                <ChevronRight size={13} className={cn('shrink-0 text-faint transition-transform', o && 'rotate-90')} />
              </button>
              <AnimatePresence initial={false}>
                {o && (
                  <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="ml-[19px] overflow-hidden border-l pl-1.5">
                    {m.lessons.map((id) => {
                      const l = LESSONS[id - 1], f = frac(id), active = id === curLesson
                      return (
                        <li key={id}>
                          <NavLink to={`/lesson/${id}`} className={cn('group flex items-center gap-2 rounded-md px-2 py-[5px] text-[12.5px] leading-snug transition', active ? 'bg-accent/14 font-medium text-fg' : 'text-muted hover:bg-elev hover:text-fg')} aria-current={active ? 'page' : undefined}>
                            {done.has(id) ? <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-ok/20 text-ok"><Check size={11} strokeWidth={3} /></span> : <Ring value={f} size={18} stroke={2} />}
                            <span className="w-5 shrink-0 text-right font-mono text-[10.5px] text-faint">{id}</span>
                            <span className="line-clamp-2 flex-1">{l.title}</span>
                            {l.premium && <Tip label="Qo'lda yozilgan tayyor kontent — oflayn ishlaydi"><span className="shrink-0 text-[10px]" aria-label="Tayyor oflayn kontent">★</span></Tip>}
                          </NavLink>
                        </li>
                      )
                    })}
                    <li>
                      <button onClick={() => nav(`/project/${m.id}`)} className={cn('flex w-full items-center gap-2 rounded-md px-2 py-[5px] text-left text-[12.5px] transition hover:bg-elev', loc.pathname === `/project/${m.id}` ? 'bg-accent/14 text-fg' : 'text-muted')}>
                        <FolderKanban size={14} className="ml-0.5 shrink-0" style={{ color: m.color }} /> <span className="ml-[22px] flex-1">Final loyiha: {m.project.title}</span>
                      </button>
                    </li>
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
      <div className="flex gap-1 border-t p-2">
        <NavLink to="/settings" className={({ isActive }) => cn('flex flex-1 items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition', isActive ? 'bg-accent/14 text-fg' : 'text-muted hover:bg-elev hover:text-fg')}><SettingsIcon size={15} /> Sozlamalar</NavLink>
        <NavLink to="/about" className={({ isActive }) => cn('flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition', isActive ? 'bg-accent/14 text-fg' : 'text-muted hover:bg-elev hover:text-fg')}><Info size={15} /> Haqida</NavLink>
      </div>
    </nav>
  )
}
