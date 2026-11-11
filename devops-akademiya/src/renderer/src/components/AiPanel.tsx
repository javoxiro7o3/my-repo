import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Bot, CornerDownLeft, Eraser, GraduationCap, HelpCircle, Hourglass, Quote, Square, WifiOff, X, Zap } from 'lucide-react'
import type { ChatMsg } from '@shared/types'
import { lessonById } from '@shared/curriculum'
import { sectionMeta } from '@shared/sections'
import { invoke, runAi, type AiRun } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useApp } from '@/store/app'
import { Button, Segmented, Tip } from './ui'
import { Markdown } from './Markdown'

const QUICK = [
  { label: 'Tushuntir', text: 'Shuni batafsil tushuntirib ber.' },
  { label: 'Soddaroq ayt', text: 'Tushunmadim. Soddaroq, boshqa analogiya bilan qayta tushuntir.' },
  { label: 'Misol ber', text: 'Shunga real hayotdan amaliy misol va ishlaydigan kod/konfiguratsiya ber.' },
  { label: 'Nega?', text: 'Nega aynan shunday? Boshqacha qilinsa nima bo\'ladi?' }
]

export function ChatView({ thread, kind = 'chat', intro, autoStart, lessonId, section, className, placeholder }: { thread: string; kind?: 'chat' | 'interview' | 'incident'; intro?: React.ReactNode; autoStart?: boolean; lessonId?: number; section?: string; className?: string; placeholder?: string }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [loaded, setLoaded] = useState(false)
  const [input, setInput] = useState('')
  const [sel, setSel] = useState('')
  const [mode, setMode] = useState<'ustoz' | 'sokrat'>('ustoz')
  const [stream, setStream] = useState<string | null>(null)
  const [wait, setWait] = useState(0)
  const run = useRef<AiRun | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const { ask, set, toast, online, settings } = useApp()

  useEffect(() => { setLoaded(false); invoke<ChatMsg[]>('chat:list', thread).then((m) => { setMsgs(m); setLoaded(true) }); return () => run.current?.cancel() }, [thread])
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }) }, [msgs, stream])

  const send = useCallback(async (text: string, selection?: string, m?: 'ustoz' | 'sokrat', silentUser?: boolean) => {
    if (stream !== null || !text.trim()) return
    const history = msgs.map((x) => ({ role: x.role, text: x.content }))
    const shown = selection ? `${text}\n\n> ${selection.slice(0, 600).replace(/\n/g, '\n> ')}${selection.length > 600 ? '…' : ''}` : text
    if (!silentUser) { setMsgs((p) => [...p, { thread, role: 'user', content: shown }]); void invoke('chat:add', { thread, role: 'user', content: shown }) }
    setInput(''); setSel(''); setStream(''); setWait(0)
    const r = runAi({ kind, lessonId, section: section as any, text, selection, mode: m ?? mode, history }, { onChunk: (f) => { setWait(0); setStream(f) }, onWait: (s) => setWait(s) })
    run.current = r
    try {
      const { text: full } = await r.done
      setMsgs((p) => [...p, { thread, role: 'model', content: full }]); void invoke('chat:add', { thread, role: 'model', content: full })
    } catch (e: any) { if (e.message !== 'To\'xtatildi') toast({ kind: 'error', title: e.code === 'offline' ? 'Oflayn rejim' : 'AI javob bera olmadi', desc: e.message }) }
    setStream(null); setWait(0); run.current = null
  }, [msgs, stream, thread, kind, lessonId, section, mode, toast])

  // Dars sahifasidan kelgan savol (tanlangan matn bilan)
  useEffect(() => { if (ask && kind === 'chat' && loaded) { set({ ask: null }); void send(ask.text, ask.selection, ask.mode) } }, [ask, kind, loaded, send, set])
  useEffect(() => { if (autoStart && loaded && !msgs.length && stream === null && settings?.hasKey) void send(kind === 'interview' ? 'Intervyuni boshla.' : 'Yangi incident ssenariysini boshla.', undefined, undefined, true) }, [autoStart, loaded]) // eslint-disable-line react-hooks/exhaustive-deps

  const clear = async () => { run.current?.cancel(); await invoke('chat:clear', thread); setMsgs([]); setStream(null) }

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div ref={box} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
        {loaded && !msgs.length && stream === null && intro}
        {msgs.map((m, i) => m.role === 'user'
          ? <div key={i} className="ml-8 rounded-xl rounded-br-sm bg-accent/15 px-3.5 py-2 text-[13.5px] leading-relaxed"><Markdown text={m.content} className="!text-[13.5px] [&_blockquote]:!my-1" /></div>
          : <div key={i} className="mr-2"><Markdown text={m.content} className="!text-[13.5px]" /></div>)}
        {stream !== null && (
          <div className="mr-2">
            {stream ? <Markdown text={stream} streaming className="!text-[13.5px]" /> : wait ? (
              <div className="flex items-center gap-2 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-[13px] text-warn"><motion.span animate={{ rotate: 180 }} transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}><Hourglass size={14} /></motion.span> Limit: {wait} soniya kutilmoqda, so'ng avtomatik qayta uriniladi…</div>
            ) : <div className="flex items-center gap-1.5 py-2" aria-label="AI yozmoqda">{[0, 1, 2].map((d) => <motion.span key={d} className="h-1.5 w-1.5 rounded-full bg-accent" animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.9, delay: d * 0.15 }} />)}</div>}
          </div>
        )}
      </div>
      {!online && <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-warn/30 bg-warn/10 px-3 py-1.5 text-xs text-warn"><WifiOff size={13} /> Oflayn rejim — yangi AI so'rovlar internet talab qiladi</div>}
      <div className="border-t p-3">
        {kind === 'chat' && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {QUICK.map((q) => <button key={q.label} disabled={stream !== null} onClick={() => send(q.text, sel || undefined)} className="chip transition hover:border-accent hover:text-fg disabled:opacity-40">{q.label}</button>)}
            <span className="ml-auto"><Segmented label="AI rejimi" value={mode} onChange={setMode} options={[{ value: 'ustoz', label: <Tip label="To'liq tushuntirib beradi"><span className="flex items-center gap-1"><GraduationCap size={12} /> Ustoz</span></Tip> }, { value: 'sokrat', label: <Tip label="Javob bermay, yo'naltiruvchi savollar beradi"><span className="flex items-center gap-1"><HelpCircle size={12} /> Sokrat</span></Tip> }]} /></span>
          </div>
        )}
        {sel && <div className="mb-2 flex items-start gap-2 rounded-lg border bg-elev px-2.5 py-1.5 text-xs text-muted"><Quote size={12} className="mt-0.5 shrink-0 text-accent" /><span className="line-clamp-2 flex-1 font-mono">{sel}</span><button onClick={() => setSel('')} aria-label="Tanlovni olib tashlash"><X size={12} /></button></div>}
        <div className="flex items-end gap-2">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={Math.min(6, Math.max(1, input.split('\n').length))} placeholder={placeholder ?? 'Savolingizni yozing… (Enter — yuborish)'} aria-label="AI-Ustozga savol"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input, sel || undefined) } }} className="input max-h-40 resize-none !py-2 text-[13.5px]" data-chat-input />
          {stream !== null ? <Button variant="danger" size="icon" onClick={() => run.current?.cancel()} aria-label="To'xtatish"><Square size={14} /></Button> : <Button variant="primary" size="icon" disabled={!input.trim()} onClick={() => send(input, sel || undefined)} aria-label="Yuborish"><CornerDownLeft size={15} /></Button>}
          <Tip label="Suhbatni tozalash"><Button variant="ghost" size="icon" onClick={clear} aria-label="Suhbatni tozalash"><Eraser size={15} /></Button></Tip>
        </div>
      </div>
    </div>
  )
}

export default function AiPanel() {
  const { ctx, settings, setSettings } = useApp()
  const lesson = ctx.lessonId ? lessonById(ctx.lessonId) : undefined
  return (
    <aside className="flex h-full w-[380px] shrink-0 flex-col border-l bg-panel 2xl:w-[440px]" aria-label="AI-Ustoz paneli">
      <div className="flex items-center gap-2.5 border-b px-4 py-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-info text-white"><Bot size={17} /></div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-tight">AI-Ustoz</div>
          <div className="truncate text-[11px] text-faint">{lesson ? `#${lesson.id} · ${sectionMeta(ctx.section ?? 'goal').title}` : 'Umumiy suhbat'}</div>
        </div>
        <Tip label={`Model: ${settings?.model}`}><span className="chip"><Zap size={10} /> {settings?.model?.replace('gemini-', '')}</span></Tip>
        <Tip label="Panelni yopish (Ctrl+/)"><Button variant="ghost" size="iconSm" onClick={() => setSettings({ aiPanel: false })} aria-label="Panelni yopish"><X size={15} /></Button></Tip>
      </div>
      <ChatView thread={lesson ? `lesson:${lesson.id}` : 'global'} lessonId={lesson?.id} section={ctx.section}
        intro={
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/12 text-accent"><GraduationCap size={26} /></div>
            <div className="text-sm font-semibold">Salom! Men DevOps Ustozman</div>
            <p className="text-[13px] leading-relaxed text-muted">{settings?.hasKey ? (lesson ? `Hozir «${lesson.title}» darsidasiz. Istalgan savolni bering yoki darsdagi matn/kodni belgilab, "Tushuntir" ni bosing.` : 'Istalgan DevOps savolini bering — nega, qanday ishlaydi, qanday buziladi.') : 'AI funksiyalari uchun Sozlamalarda Gemini API kalitini kiriting. Tayyor darslar kalitsiz ham ishlaydi.'}</p>
            {lesson && settings?.hasKey && <div className="mt-1 flex flex-wrap justify-center gap-1.5">{lesson.interview.slice(0, 3).map((q) => <button key={q} onClick={() => useApp.getState().askAi(q)} className="rounded-lg border bg-elev px-2.5 py-1.5 text-left text-xs text-muted transition hover:border-accent hover:text-fg">{q}</button>)}</div>}
          </div>
        } />
    </aside>
  )
}
