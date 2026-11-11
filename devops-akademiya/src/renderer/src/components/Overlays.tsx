import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Command } from 'cmdk'
import { AnimatePresence, motion } from 'framer-motion'
import { Award, Bot, BookOpen, CheckCircle2, ExternalLink, Info, KeyRound, Loader2, Search, ShieldCheck, Sparkles, Wrench, XCircle, Zap } from 'lucide-react'
import type { SearchHit } from '@shared/types'
import { LESSONS, MODULES } from '@shared/curriculum'
import { sectionMeta } from '@shared/sections'
import { BADGES } from '@shared/gamify'
import { invoke } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useApp } from '@/store/app'
import { TOOLS } from '@/tools/registry'
import { Button, Kbd, Modal } from './ui'
import Logo from './Logo'

export function CommandPalette() {
  const { palette, set, setSettings, settings } = useApp()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  useEffect(() => { if (!palette) setQ('') }, [palette])
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return }
    const t = setTimeout(() => invoke<SearchHit[]>('search:query', q).then(setHits), 120)
    return () => clearTimeout(t)
  }, [q])
  const go = (to: string) => { set({ palette: false }); nav(to) }
  const item = 'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-muted data-[selected=true]:bg-accent/14 data-[selected=true]:text-fg'
  const snip = (s: string) => s.split(/[⟦⟧]/).map((p, i) => i % 2 ? <mark key={i} className="rounded bg-accent/30 px-0.5 text-fg">{p}</mark> : p)
  return (
    <Command.Dialog open={palette} onOpenChange={(o) => set({ palette: o })} label="Buyruqlar palitrasi" shouldFilter={true}
      overlayClassName="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" contentClassName="fixed left-1/2 top-[12vh] z-50 w-[min(680px,92vw)] -translate-x-1/2 overflow-hidden rounded-xl border bg-panel shadow-soft animate-in fade-in-0 zoom-in-95">
      <div className="flex items-center gap-2.5 border-b px-4"><Search size={16} className="text-faint" /><Command.Input value={q} onValueChange={setQ} placeholder="Dars, mavzu, vosita yoki amal… (masalan: Pod Pending)" className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint" /><Kbd>Esc</Kbd></div>
      <Command.List className="max-h-[56vh] overflow-y-auto p-2">
        <Command.Empty className="px-4 py-8 text-center text-sm text-muted">Hech narsa topilmadi. <button className="text-accent underline" onClick={() => go(`/search?q=${encodeURIComponent(q)}&ai=1`)}>AI dan so'rash →</button></Command.Empty>
        {q.trim().length >= 2 && (
          <Command.Group heading="Qidiruv" className="[&_[cmdk-group-heading]]:label [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5">
            <Command.Item value={`ai-savol ${q}`} onSelect={() => go(`/search?q=${encodeURIComponent(q)}&ai=1`)} className={item}><Sparkles size={15} className="text-accent" /> AI dan so'rash: <b className="truncate text-fg">{q}</b></Command.Item>
            <Command.Item value={`toliq-qidiruv ${q}`} onSelect={() => go(`/search?q=${encodeURIComponent(q)}`)} className={item}><Search size={15} /> Barcha natijalarni ko'rish</Command.Item>
            {hits.slice(0, 8).map((h, i) => (
              <Command.Item key={i} value={`hit-${i} ${q}`} onSelect={() => go(`/lesson/${h.lessonId}/${h.section}`)} className={cn(item, 'items-start')}>
                <BookOpen size={15} className="mt-0.5 shrink-0" />
                <span className="min-w-0"><span className="block truncate text-fg">#{h.lessonId} {LESSONS[h.lessonId - 1]?.title} <span className="text-faint">· {sectionMeta(h.section).title}</span></span><span className="line-clamp-1 text-xs text-faint">{snip(h.snippet)}</span></span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
        <Command.Group heading="Amallar" className="[&_[cmdk-group-heading]]:label [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5">
          {[['/', 'Bosh sahifa'], ['/roadmap', 'Yo\'l xaritasi'], ['/review', 'Bugungi takrorlash (SM-2)'], ['/tools', 'Interaktiv vositalar'], ['/ai/explain', 'AI: buyruqni tushuntir'], ['/ai/review', 'AI: kod review'], ['/ai/interview', 'AI: intervyu simulyatori'], ['/ai/incident', 'AI: debug o\'yini'], ['/ai/quiz', 'AI: adaptiv test'], ['/notes', 'Eslatma va xatcho\'plar'], ['/settings', 'Sozlamalar'], ['/about', 'Dastur haqida']].map(([to, label]) => (
            <Command.Item key={to} value={`amal ${label}`} onSelect={() => go(to)} className={item}><Zap size={15} /> {label}</Command.Item>
          ))}
          <Command.Item value="amal ai panel ustoz chat" onSelect={() => { void setSettings({ aiPanel: !settings?.aiPanel }); set({ palette: false }) }} className={item}><Bot size={15} /> AI-Ustoz panelini ochish/yopish <span className="ml-auto"><Kbd>Ctrl /</Kbd></span></Command.Item>
          {(['dark', 'light', 'terminal', 'system'] as const).map((t) => <Command.Item key={t} value={`amal mavzu theme ${t}`} onSelect={() => { void setSettings({ theme: t }); set({ palette: false }) }} className={item}><Zap size={15} /> Mavzu: {{ dark: 'Tungi (Dark)', light: 'Kunduzgi (Light)', terminal: 'Terminal Green', system: 'Tizim mavzusi' }[t]}</Command.Item>)}
          <Command.Item value="amal klaviatura yorliqlari shortcut" onSelect={() => set({ palette: false, shortcuts: true })} className={item}><Zap size={15} /> Klaviatura yorliqlari</Command.Item>
        </Command.Group>
        <Command.Group heading="Vositalar" className="[&_[cmdk-group-heading]]:label [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5">
          {TOOLS.map((t) => <Command.Item key={t.id} value={`vosita ${t.title} ${t.tags}`} onSelect={() => go(`/tools/${t.id}`)} className={item}><Wrench size={15} /> {t.title}</Command.Item>)}
        </Command.Group>
        <Command.Group heading="Darslar" className="[&_[cmdk-group-heading]]:label [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5">
          {LESSONS.map((l) => <Command.Item key={l.id} value={`dars ${l.id} ${l.title} ${l.concepts.join(' ')}`} onSelect={() => go(`/lesson/${l.id}`)} className={item}><span className="w-6 text-right font-mono text-xs text-faint">{l.id}</span><span className="flex-1 truncate">{l.title}</span><span className="text-[11px] text-faint">{MODULES[l.module - 1].short}</span></Command.Item>)}
        </Command.Group>
      </Command.List>
      <div className="flex items-center gap-4 border-t px-4 py-2 text-[11px] text-faint"><span><Kbd>↑↓</Kbd> tanlash</span><span><Kbd>Enter</Kbd> ochish</span><span className="ml-auto">To'liq matnli qidiruv (FTS5) + AI savol</span></div>
    </Command.Dialog>
  )
}

export function Toasts() {
  const { toasts, dismiss } = useApp()
  const ICON = { xp: <Zap size={16} className="text-accent" />, badge: <Award size={18} className="text-warn" />, info: <Info size={16} className="text-info" />, error: <XCircle size={16} className="text-bad" />, ok: <CheckCircle2 size={16} className="text-ok" /> }
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[90] flex -translate-x-1/2 flex-col items-center gap-2" role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button key={t.id} layout initial={{ opacity: 0, y: 24, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.95 }} transition={{ type: 'spring', stiffness: 380, damping: 26 }} onClick={() => dismiss(t.id)}
            className={cn('pointer-events-auto flex max-w-md items-center gap-3 rounded-xl border bg-elev px-4 py-2.5 text-left shadow-soft', t.kind === 'badge' && 'border-warn/50 shadow-glow')}>
            {t.icon ? <motion.span className="text-2xl" initial={{ rotate: -30, scale: 0.3 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 10, delay: 0.1 }}>{t.icon}</motion.span> : ICON[t.kind]}
            <span><span className="block text-[13.5px] font-semibold">{t.title}</span>{t.desc && <span className="block text-xs text-muted">{t.desc}</span>}</span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  )
}
export const badgeToast = (id: string) => { const b = BADGES.find((x) => x.id === id); if (b) useApp.getState().toast({ kind: 'badge', title: `Yangi nishon: ${b.name}`, desc: b.desc, icon: b.icon }) }

const SHORTCUTS: [string, string][] = [
  ['Ctrl K', 'Buyruqlar palitrasi va qidiruv'], ['Ctrl /', 'AI-Ustoz panelini ochish/yopish va savolga fokus'], ['J  /  K', 'Keyingi / oldingi bo\'lim (dars ichida)'], ['Ctrl B', 'Joriy bo\'limni xatcho\'pga qo\'shish'],
  ['Ctrl Enter', 'Bo\'limni tugatish va keyingisiga o\'tish'], ['[  /  ]', 'Oldingi / keyingi dars'], ['Ctrl +  /  Ctrl −', 'O\'qish shriftini kattalashtirish / kichraytirish'], ['G keyin H', 'Bosh sahifa'], ['G keyin R', 'Yo\'l xaritasi'], ['G keyin T', 'Vositalar'], ['G keyin A', 'AI laboratoriya'], ['?', 'Shu oynani ochish'], ['Esc', 'Oynani yopish']
]
export function ShortcutsDialog() {
  const { shortcuts, set } = useApp()
  return (
    <Modal open={shortcuts} onOpenChange={(o) => set({ shortcuts: o })} title="Klaviatura yorliqlari" desc="Sichqonchasiz ham to'liq ishlash mumkin">
      <ul className="divide-y">{SHORTCUTS.map(([k, d]) => <li key={k} className="flex items-center justify-between gap-4 py-2 text-sm"><span className="text-muted">{d}</span><span className="flex shrink-0 gap-1">{k.split('  ').map((p, i) => p === '/' || p === 'keyin' ? <span key={i} className="text-xs text-faint">{p}</span> : <Kbd key={i}>{p}</Kbd>)}</span></li>)}</ul>
    </Modal>
  )
}

/** Birinchi ishga tushirish: xush kelibsiz + API kalit */
export function KeyForm({ onSaved, compact }: { onSaved?: () => void; compact?: boolean }) {
  const { settings, set, toast } = useApp()
  const [key, setKey] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'bad'>('idle')
  const [msg, setMsg] = useState('')
  const test = async () => {
    setState('busy'); setMsg('')
    try { const r = await invoke<{ ok: boolean; message: string }>('key:test', { key, model: settings?.model }); setState(r.ok ? 'ok' : 'bad'); setMsg(r.message); return r.ok }
    catch (e: any) { setState('bad'); setMsg(e.message); return false }
  }
  const save = async () => {
    if (state !== 'ok' && !(await test())) return
    const r = await invoke<{ persisted: boolean; settings: any }>('key:set', { key })
    set({ settings: r.settings }); setKey('')
    toast({ kind: 'ok', title: 'Kalit saqlandi', desc: r.persisted ? 'Operatsion tizim darajasida shifrlangan (safeStorage)' : 'Bu tizimda shifrlash mavjud emas — kalit faqat joriy seans xotirasida saqlanadi' })
    onSaved?.()
  }
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium" htmlFor="apikey">Gemini API kaliti</label>
      <div className="flex gap-2">
        <div className="relative flex-1"><KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" /><input id="apikey" type="password" autoComplete="off" spellCheck={false} value={key} onChange={(e) => { setKey(e.target.value); setState('idle') }} placeholder={settings?.hasKey ? '•••••••••• (saqlangan — almashtirish uchun yangisini kiriting)' : 'AIza…'} className="input pl-9 font-mono" /></div>
        <Button onClick={test} disabled={key.trim().length < 20 || state === 'busy'}>{state === 'busy' ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} Tekshirish</Button>
        <Button variant="primary" onClick={save} disabled={key.trim().length < 20 || state === 'busy'}>Saqlash</Button>
      </div>
      {msg && <p role="status" className={cn('flex items-start gap-1.5 whitespace-pre-line break-words text-[13px] select-text', state === 'ok' ? 'text-ok' : 'text-bad')}>{state === 'ok' ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <XCircle size={14} className="mt-0.5 shrink-0" />} <span className="min-w-0">{msg}</span></p>}
      {!compact && <p className="text-[13px] leading-relaxed text-muted">Kalit <b>faqat shu kompyuterda</b>, operatsion tizim shifrlashi (Windows DPAPI) bilan saqlanadi. U interfeys qismiga (renderer) hech qachon uzatilmaydi, loglarga va eksportga tushmaydi. Kalitni bepul olish: <button className="inline-flex items-center gap-1 text-accent underline" onClick={() => invoke('app:openExternal', 'https://aistudio.google.com/app/apikey')}>Google AI Studio <ExternalLink size={11} /></button></p>}
    </div>
  )
}

export function Onboarding() {
  const { settings, setSettings } = useApp()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  if (!settings || settings.onboarded) return null
  const finish = () => setSettings({ onboarded: true, name: name.trim() })
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-bg/90 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Xush kelibsiz">
      <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="w-[min(640px,92vw)] overflow-hidden rounded-2xl border bg-panel shadow-soft">
        <div className="relative overflow-hidden border-b bg-gradient-to-br from-accent/20 via-transparent to-info/15 px-8 py-7">
          <div className="flex items-center gap-4"><Logo size={56} /><div><h1 className="text-2xl font-semibold tracking-tight">Xush kelibsiz!</h1><p className="mt-1 text-sm text-muted">DevOps Akademiya — 73 dars, ichki mexanizmlarigacha, o'zbek tilida</p></div></div>
          <div className="mt-5 flex gap-1.5">{[0, 1, 2].map((i) => <span key={i} className={cn('h-1 flex-1 rounded-full transition-colors', i <= step ? 'bg-accent' : 'bg-border')} />)}</div>
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.18 }} className="px-8 py-6">
            {step === 0 && (
              <div className="space-y-4">
                <p className="text-[15px] leading-relaxed">Bu yerda har bir mavzu shu tartibda o'rgatiladi: <b>nega kerak</b> → <b>ichida qanday ishlaydi</b> → <b>qanday ishlatiladi</b> → <b>qanday buziladi va tuzatiladi</b>.</p>
                <ul className="grid grid-cols-2 gap-2.5 text-[13.5px]">{[['📚', '13 bo\'limli dars shabloni'], ['🤖', 'Gemini asosidagi AI-Ustoz'], ['🧪', '15 ta interaktiv vosita'], ['🔁', 'SM-2 oraliqli takrorlash'], ['🏆', 'XP, daraja va nishonlar'], ['✈️', 'Tayyor darslar oflayn ishlaydi']].map(([i, t]) => <li key={t} className="flex items-center gap-2.5 rounded-lg border bg-elev/60 px-3 py-2"><span className="text-lg">{i}</span>{t}</li>)}</ul>
                <div><label htmlFor="uname" className="mb-1.5 block text-sm font-medium">Ismingiz (ixtiyoriy)</label><input id="uname" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Masalan: Jasur" className="input" /></div>
              </div>
            )}
            {step === 1 && <div className="space-y-4"><p className="text-[15px] leading-relaxed">AI-Ustoz, darslarni generatsiya qilish va kod review uchun <b>Google Gemini API kaliti</b> kerak. Kalitsiz ham 10 ta tayyor dars va barcha interaktiv vositalar ishlaydi — kalitni keyinroq Sozlamalarda kiritishingiz mumkin.</p><KeyForm onSaved={() => setStep(2)} /></div>}
            {step === 2 && (
              <div className="space-y-4">
                <p className="text-[15px] leading-relaxed">Mavzuni tanlang (keyin Sozlamalarda o'zgartirish mumkin):</p>
                <div className="grid grid-cols-3 gap-3">{([['dark', 'Tungi', '#0d0f1a', '#8b8ff7'], ['light', 'Kunduzgi', '#f5f6fa', '#4f46e5'], ['terminal', 'Terminal Green', '#07100a', '#3dfc6b']] as const).map(([id, label, bg, ac]) => (
                  <button key={id} onClick={() => setSettings({ theme: id })} aria-pressed={settings.theme === id} className={cn('overflow-hidden rounded-xl border-2 text-left transition', settings.theme === id ? 'border-accent shadow-glow' : 'border-border hover:border-faint')}>
                    <div className="h-16 p-2.5" style={{ background: bg }}><div className="h-2 w-10 rounded" style={{ background: ac }} /><div className="mt-2 h-1.5 w-20 rounded opacity-40" style={{ background: ac }} /><div className="mt-1.5 h-1.5 w-14 rounded opacity-25" style={{ background: ac }} /></div>
                    <div className="px-3 py-2 text-[13px] font-medium">{label}</div>
                  </button>
                ))}</div>
                <p className="text-[13px] text-muted">Maslahat: istalgan payt <Kbd>Ctrl K</Kbd> bosib qidiring, <Kbd>?</Kbd> bilan yorliqlarni ko'ring.</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
        <div className="flex items-center justify-between border-t bg-elev/40 px-8 py-4">
          <Button variant="ghost" onClick={() => (step ? setStep(step - 1) : finish())}>{step ? 'Orqaga' : 'O\'tkazib yuborish'}</Button>
          {step < 2 ? <Button variant="primary" onClick={() => setStep(step + 1)}>{step === 1 && !settings.hasKey ? 'Kalitsiz davom etish' : 'Davom etish'}</Button> : <Button variant="primary" onClick={finish} data-testid="onboarding-finish">O'qishni boshlash 🚀</Button>}
        </div>
      </motion.div>
    </div>
  )
}
