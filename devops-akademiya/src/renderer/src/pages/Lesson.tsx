import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, Check, CheckCircle2, Clock, Download, FileText, Highlighter, Hourglass, Layers, RefreshCw, Sparkles, StickyNote, Timer, Wand2, WifiOff, Wrench, Copy as CopyIcon } from 'lucide-react'
import type { Note, QuizQuestion, SectionId } from '@shared/types'
import { lessonById, LESSONS, MODULES } from '@shared/curriculum'
import { SECTIONS, SECTION_IDS, sectionMeta } from '@shared/sections'
import { premiumQuiz, premiumSection } from '@shared/premium'
import { extractJson } from '@shared/geminiCore'
import { invoke, runAi, type AiRun } from '@/lib/api'
import { cn, copy } from '@/lib/utils'
import { useApp } from '@/store/app'
import { Button, Empty, Modal, SkeletonText, Tip } from '@/components/ui'
import { Markdown, headingsOf } from '@/components/Markdown'
import Quiz, { validQuiz } from '@/components/Quiz'
import { TOOLS } from '@/tools/registry'

type Content = { state: 'loading' } | { state: 'ready'; text: string; source: 'premium' | 'ai' | 'static'; cached?: boolean } | { state: 'empty' } | { state: 'streaming'; text: string; wait?: number } | { state: 'error'; message: string; code: string }

function GoalSection({ lessonId }: { lessonId: number }) {
  const l = lessonById(lessonId)!
  const m = MODULES[l.module - 1]
  return (
    <div className="prose">
      <p className="!mt-0 text-[1.12em] leading-relaxed text-muted">{l.summary}</p>
      <div className="not-prose my-5 flex flex-wrap gap-2 text-[13px]">
        <span className="chip"><Clock size={12} /> ~{l.minutes} daqiqa</span><span className="chip" style={{ borderColor: m.color + '66', color: m.color }}>{m.id}-modul · {m.title}</span>
        {l.versions.map((v) => <span key={v} className="chip font-mono">{v}</span>)}
      </div>
      {l.note && <blockquote><p>ℹ️ {l.note}</p></blockquote>}
      <h2>Dars oxirida siz…</h2>
      <ul className="not-prose grid gap-2.5">{l.objectives.map((o) => <li key={o} className="flex items-start gap-3 rounded-xl border bg-panel px-4 py-3 text-[.97em]"><CheckCircle2 size={18} className="mt-0.5 shrink-0 text-ok" /> {o}</li>)}</ul>
      <h2>Chuqurlik nuqtalari</h2>
      <p>Bu darsda quyidagi ichki mexanizmlar albatta ochib beriladi:</p>
      <ol>{l.depth.map((d) => <li key={d}>{d}</li>)}</ol>
      <h2>Kalit tushunchalar</h2>
      <div className="not-prose flex flex-wrap gap-2">{l.concepts.map((c) => <span key={c} className="rounded-lg border bg-elev px-2.5 py-1 font-mono text-[.84em]">{c}</span>)}</div>
      <h2>Atamalar lug'ati</h2>
      <div className="table-wrap"><table><thead><tr><th>Atama</th><th>Ma'nosi</th></tr></thead><tbody>{l.glossary.map((g) => <tr key={g.term}><td><code>{g.term}</code></td><td>{g.def}</td></tr>)}</tbody></table></div>
      {l.tools.length > 0 && <><h2>Shu darsga oid interaktiv vositalar</h2><div className="not-prose grid gap-2.5 @lg:grid-cols-2">{l.tools.map((t) => { const tool = TOOLS.find((x) => x.id === t)!; return <Link key={t} to={`/tools/${t}`} className="flex items-center gap-3 rounded-xl border bg-panel px-4 py-3 transition hover:border-accent hover:shadow-glow"><span className="text-2xl">{tool.icon}</span><span><span className="block text-[.95em] font-semibold">{tool.title}</span><span className="text-[.82em] text-muted">{tool.desc}</span></span></Link> })}</div></>}
    </div>
  )
}

function RelatedSection({ lessonId }: { lessonId: number }) {
  const l = lessonById(lessonId)!
  const stats = useApp((s) => s.stats)
  const done = new Set(stats?.lessonsDone ?? [])
  const Card = ({ id, tag }: { id: number; tag: string }) => {
    const x = lessonById(id); if (!x) return null
    const m = MODULES[x.module - 1]
    return (
      <Link to={`/lesson/${id}`} className="group flex items-start gap-3 rounded-xl border bg-panel p-4 transition hover:border-accent hover:shadow-glow">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-semibold" style={{ background: m.color + '22', color: m.color }}>{id}</span>
        <span className="min-w-0 flex-1"><span className="label">{tag}</span><span className="block font-semibold leading-snug">{x.title}</span><span className="line-clamp-2 text-[.86em] text-muted">{x.summary}</span></span>
        {done.has(id) ? <Check size={16} className="mt-1 text-ok" /> : <ArrowRight size={16} className="mt-1 text-faint transition group-hover:translate-x-1 group-hover:text-accent" />}
      </Link>
    )
  }
  const before = l.related.filter((r) => r < l.id), after = l.related.filter((r) => r > l.id)
  const W = 640, cx = W / 2
  const pos = (arr: number[], x: number) => arr.map((id, i) => ({ id, x, y: 40 + (i + 0.5) * (200 / Math.max(arr.length, 1)) }))
  const nodes = [...pos(before, 90), ...pos(after, W - 90)]
  return (
    <div className="space-y-8">
      <p className="text-muted">Bilim zanjirga o'xshaydi: bu dars oldingilarga tayanadi va keyingilarga poydevor bo'ladi.</p>
      <svg viewBox={`0 0 ${W} 280`} className="w-full rounded-xl border bg-panel" role="img" aria-label="Bog'liq darslar xaritasi">
        {nodes.map((n) => <path key={n.id} d={`M${n.x} ${n.y} C ${(n.x + cx) / 2} ${n.y}, ${(n.x + cx) / 2} 140, ${cx} 140`} fill="none" stroke="hsl(var(--border))" strokeWidth="2" strokeDasharray={n.x < cx ? '' : '5 4'} />)}
        <circle cx={cx} cy={140} r={36} fill="hsl(var(--accent) / .18)" stroke="hsl(var(--accent))" strokeWidth="2" />
        <text x={cx} y={146} textAnchor="middle" fontSize="20" fontWeight="700" fill="hsl(var(--fg))">#{l.id}</text>
        {nodes.map((n) => { const x = lessonById(n.id)!; return <g key={n.id}><circle cx={n.x} cy={n.y} r={22} fill="hsl(var(--elev))" stroke={MODULES[x.module - 1].color} strokeWidth="2" /><text x={n.x} y={n.y + 5} textAnchor="middle" fontSize="13" fontWeight="600" fill="hsl(var(--fg))">{n.id}</text><text x={n.x < cx ? n.x + 30 : n.x - 30} y={n.y + 4} textAnchor={n.x < cx ? 'start' : 'end'} fontSize="11" fill="hsl(var(--muted))">{x.title.slice(0, 30)}{x.title.length > 30 ? '…' : ''}</text></g> })}
        <text x={90} y={22} textAnchor="middle" fontSize="11" fill="hsl(var(--faint))">POYDEVOR</text><text x={W - 90} y={22} textAnchor="middle" fontSize="11" fill="hsl(var(--faint))">DAVOMI</text>
      </svg>
      <div className="grid gap-3 @2xl:grid-cols-2">
        {l.id > 1 && <Card id={l.id - 1} tag="← Oldingi dars" />}{l.id < 73 && <Card id={l.id + 1} tag="Keyingi dars →" />}
        {l.related.filter((r) => r !== l.id - 1 && r !== l.id + 1).map((r) => <Card key={r} id={r} tag={r < l.id ? 'Poydevor mavzu' : 'Shu mavzuning davomi'} />)}
      </div>
    </div>
  )
}

/** Tanlangan matn ustida suzuvchi asboblar paneli */
function SelectionBar({ container, onNote }: { container: React.RefObject<HTMLDivElement | null>; onNote: (quote: string) => void }) {
  const [pos, setPos] = useState<{ x: number; y: number; text: string } | null>(null)
  const askAi = useApp((s) => s.askAi)
  useEffect(() => {
    const h = () => {
      const s = getSelection(); const t = s?.toString().trim() ?? ''
      if (!s || s.isCollapsed || t.length < 3 || !container.current?.contains(s.anchorNode) || (s.anchorNode?.parentElement?.closest('.monaco-editor, textarea, input'))) return setPos(null)
      const r = s.getRangeAt(0).getBoundingClientRect()
      setPos({ x: Math.max(180, Math.min(innerWidth - 600, r.left + r.width / 2)), y: r.top - 46, text: t })
    }
    document.addEventListener('selectionchange', h)
    return () => document.removeEventListener('selectionchange', h)
  }, [container])
  if (!pos) return null
  const act = (q: string) => { askAi(q, pos.text); getSelection()?.removeAllRanges() }
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="no-print fixed z-40 flex -translate-x-1/2 items-center gap-0.5 rounded-xl border bg-elev p-1 shadow-soft" style={{ left: pos.x, top: Math.max(48, pos.y) }} onMouseDown={(e) => e.preventDefault()} role="toolbar" aria-label="Tanlangan matn amallari">
      <Button variant="ghost" size="sm" onClick={() => act('Shuni batafsil tushuntirib ber.')}><Sparkles size={13} className="text-accent" /> Tushuntir</Button>
      <Button variant="ghost" size="sm" onClick={() => act('Tushunmadim. Soddaroq, boshqa analogiya bilan tushuntir.')}>Soddaroq ayt</Button>
      <Button variant="ghost" size="sm" onClick={() => act('Shunga amaliy misol va ishlaydigan kod ber.')}>Misol ber</Button>
      <Button variant="ghost" size="sm" onClick={() => act('Nega aynan shunday? Boshqacha bo\'lsa nima bo\'ladi?')}>Nega?</Button>
      <span className="mx-0.5 h-5 w-px bg-border" />
      <Tip label="Belgilash va eslatma qo'shish"><Button variant="ghost" size="iconSm" onClick={() => { onNote(pos.text); getSelection()?.removeAllRanges() }} aria-label="Belgilash va eslatma"><Highlighter size={14} className="text-warn" /></Button></Tip>
      <Tip label="Nusxa olish"><Button variant="ghost" size="iconSm" onClick={() => { void copy(pos.text); getSelection()?.removeAllRanges() }} aria-label="Nusxa olish"><CopyIcon size={14} /></Button></Tip>
    </motion.div>
  )
}

export default function Lesson() {
  const params = useParams()
  const nav = useNavigate()
  const id = Number(params.id)
  const lesson = lessonById(id)
  const section = (SECTION_IDS.includes(params.section as SectionId) ? params.section : 'goal') as SectionId
  const { stats, settings, online, set, toast, refreshStats } = useApp()
  const [content, setContent] = useState<Content>({ state: 'loading' })
  const [notes, setNotes] = useState<Note[]>([])
  const [noteDraft, setNoteDraft] = useState<{ quote: string; note: string } | null>(null)
  const [recap, setRecap] = useState<{ open: boolean; text: string; busy: boolean }>({ open: false, text: '', busy: false })
  const [progress, setProgress] = useState(0)
  const [showNotes, setShowNotes] = useState(false)
  const run = useRef<AiRun | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const meta = sectionMeta(section)
  const idx = SECTION_IDS.indexOf(section)
  const doneSet = useMemo(() => new Set(stats?.sectionsDone[id] ?? []), [stats, id])
  const bookmarked = !!stats?.bookmarks.some((b) => b.lessonId === id && b.section === section)

  const generate = useCallback((force = false) => {
    if (!lesson) return
    run.current?.cancel()
    setContent({ state: 'streaming', text: '' })
    const r = runAi({ kind: 'section', lessonId: id, section, force }, { onChunk: (full) => setContent({ state: 'streaming', text: full }), onWait: (w) => setContent((c) => ({ state: 'streaming', text: c.state === 'streaming' ? c.text : '', wait: w })) })
    run.current = r
    r.done.then(({ text, cached }) => { if (run.current === r) setContent({ state: 'ready', text, source: 'ai', cached }) })
      .catch((e) => { if (run.current === r) setContent(e.message === 'To\'xtatildi' ? { state: 'empty' } : { state: 'error', message: e.message, code: e.code }) })
  }, [id, section, lesson])

  // Bo'lim kontentini aniqlash: statik → premium → kesh → bo'sh
  useEffect(() => {
    if (!lesson) return
    run.current?.cancel(); run.current = null
    set({ ctx: { lessonId: id, section } })
    void invoke('progress:last', { lessonId: id, section })
    scroller.current?.scrollTo({ top: 0 }); setProgress(0)
    if (meta.source === 'static') return setContent({ state: 'ready', text: '', source: 'static' })
    const prem = section === 'quiz' ? (premiumQuiz(id) ? JSON.stringify(premiumQuiz(id)) : undefined) : premiumSection(id, section)
    if (prem) return setContent({ state: 'ready', text: prem, source: 'premium' })
    setContent({ state: 'loading' })
    let dead = false
    invoke<string | null>('ai:cached', { request: { kind: 'section', lessonId: id, section } }).then((hit) => { if (!dead) setContent(hit ? { state: 'ready', text: hit, source: 'ai', cached: true } : { state: 'empty' }) })
    return () => { dead = true; run.current?.cancel() }
  }, [id, section]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { invoke<Note[]>('notes:list', { lessonId: id }).then(setNotes) }, [id])

  // Saqlangan belgilashlarni matnda yoritish (CSS Custom Highlight API)
  useEffect(() => {
    const H = (globalThis as any).Highlight, reg = (CSS as any).highlights
    if (!H || !reg || !body.current) return
    const ranges: Range[] = []
    const quotes = notes.filter((n) => n.section === section).map((n) => n.quote).filter((q) => q.length > 2)
    if (quotes.length && content.state === 'ready') {
      const walker = document.createTreeWalker(body.current, NodeFilter.SHOW_TEXT)
      for (let n = walker.nextNode(); n; n = walker.nextNode()) for (const q of quotes) {
        const first = q.split('\n')[0].slice(0, 120); const at = n.textContent?.indexOf(first) ?? -1
        if (at >= 0) { const r = new Range(); r.setStart(n, at); r.setEnd(n, at + first.length); ranges.push(r) }
      }
    }
    reg.set('da-note', new H(...ranges))
    return () => reg.delete('da-note')
  }, [notes, section, content.state])

  const go = useCallback((s: SectionId) => nav(`/lesson/${id}/${s}`), [nav, id])
  const complete = useCallback(async () => {
    await invoke('progress:mark', { lessonId: id, section }); await refreshStats()
    if (idx < SECTION_IDS.length - 1) go(SECTION_IDS[idx + 1]); else if (id < 73) nav(`/lesson/${id + 1}`)
  }, [id, section, idx, go, nav, refreshStats])
  const toggleBookmark = useCallback(async () => { const on = await invoke<boolean>('bookmark:toggle', { lessonId: id, section }); toast({ kind: 'info', title: on ? 'Xatcho\'pga qo\'shildi' : 'Xatcho\'pdan olib tashlandi' }); void refreshStats() }, [id, section, toast, refreshStats])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.closest('.monaco-editor, .xterm, [role=dialog]')) { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); void toggleBookmark() } return }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); void toggleBookmark() }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void complete() }
      else if (e.ctrlKey || e.metaKey || e.altKey) return
      else if (e.key.toLowerCase() === 'j' && idx < SECTION_IDS.length - 1) go(SECTION_IDS[idx + 1])
      else if (e.key.toLowerCase() === 'k' && idx > 0) go(SECTION_IDS[idx - 1])
      else if (e.key === ']' && id < 73) nav(`/lesson/${id + 1}`)
      else if (e.key === '[' && id > 1) nav(`/lesson/${id - 1}`)
    }
    addEventListener('keydown', h); return () => removeEventListener('keydown', h)
  }, [idx, id, go, nav, complete, toggleBookmark])

  const quiz = useMemo<QuizQuestion[] | null>(() => {
    if (section !== 'quiz' || content.state !== 'ready') return null
    try { return validQuiz(extractJson(content.text)) } catch { return [] }
  }, [section, content])

  if (!lesson) return <div className="p-10"><Empty icon="🔍" title="Dars topilmadi" desc="Bunday raqamli dars mavjud emas." action={<Button onClick={() => nav('/')}>Bosh sahifaga</Button>} /></div>
  const mod = MODULES[lesson.module - 1]
  const text = content.state === 'ready' || content.state === 'streaming' ? content.text : ''
  const toc = section !== 'quiz' && text ? headingsOf(text).filter((h) => h.level === 2) : []
  const mdOut = () => `# ${lesson.title} — ${meta.icon} ${meta.title}\n\n${meta.source === 'static' ? body.current?.innerText ?? '' : section === 'quiz' ? (quiz ?? []).map((q, i) => `### ${i + 1}. ${q.q}\n${q.code ? '```\n' + q.code + '\n```\n' : ''}${(q.options ?? q.items ?? []).map((o) => `- ${o}`).join('\n')}\n\n> ${q.explain}`).join('\n\n') : text}\n`
  const exportPdf = async () => { const ok = await invoke('export:pdf', { title: `${lesson.id}. ${lesson.title} — ${meta.title}`, html: body.current?.innerHTML ?? '' }); if (ok) toast({ kind: 'ok', title: 'PDF saqlandi' }) }
  const exportMd = async () => { const ok = await invoke('export:md', { name: `${lesson.id}-${section}`, markdown: mdOut() }); if (ok) toast({ kind: 'ok', title: 'Markdown saqlandi' }) }
  const openRecap = async () => {
    setRecap({ open: true, text: '', busy: true })
    try { const r = await runAi({ kind: 'recap', lessonId: id }, { onChunk: (f) => setRecap({ open: true, text: f, busy: true }) }).done; setRecap({ open: true, text: r.text, busy: false }) }
    catch (e: any) { setRecap({ open: true, text: `> ⚠️ ${e.message}`, busy: false }) }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="h-0.5 shrink-0 bg-elev"><div className="h-full bg-gradient-to-r from-accent to-info transition-[width] duration-150" style={{ width: `${progress * 100}%` }} /></div>
      {/* Yopishqoq sarlavha va bo'limlar */}
      <div className="shrink-0 border-b bg-panel/70 backdrop-blur">
        <div className="flex items-center gap-3 px-6 pt-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-bold" style={{ background: mod.color + '22', color: mod.color }}>{lesson.id}</span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] font-semibold tracking-tight">{lesson.title}</h1>
            <div className="flex items-center gap-2 text-[11.5px] text-faint"><span>{mod.id}-modul · {mod.title}</span>·<span>{doneSet.size}/13 bo'lim</span>{lesson.premium && <><span>·</span><span className="text-warn">★ tayyor oflayn kontent</span></>}</div>
          </div>
          <div className="flex items-center gap-1">
            <Tip label="Bu darsni 5 daqiqada eslat (AI)"><Button variant="ghost" size="sm" onClick={openRecap}><Timer size={14} /> 5 daqiqada</Button></Tip>
            <Tip label={`Eslatmalar (${notes.length})`}><Button variant={showNotes ? 'secondary' : 'ghost'} size="iconSm" onClick={() => setShowNotes((s) => !s)} aria-label="Eslatmalar"><StickyNote size={15} /></Button></Tip>
            <Tip label="Xatcho'p (Ctrl+B)"><Button variant="ghost" size="iconSm" onClick={toggleBookmark} aria-label="Xatcho'p" aria-pressed={bookmarked}>{bookmarked ? <BookmarkCheck size={15} className="text-accent" /> : <Bookmark size={15} />}</Button></Tip>
            <Tip label="PDF ga eksport"><Button variant="ghost" size="iconSm" onClick={exportPdf} aria-label="PDF ga eksport"><Download size={15} /></Button></Tip>
            <Tip label="Markdown ga eksport"><Button variant="ghost" size="iconSm" onClick={exportMd} aria-label="Markdown ga eksport"><FileText size={15} /></Button></Tip>
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto px-5 pb-2 pt-2.5" role="tablist" aria-label="Dars bo'limlari">
          {SECTIONS.map((s, i) => (
            <Tip key={s.id} label={<span><b>{s.title}</b><br />{s.hint}</span>}>
              <button role="tab" aria-selected={s.id === section} onClick={() => go(s.id)} className={cn('relative flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition', s.id === section ? 'bg-accent/15 text-fg' : 'text-muted hover:bg-elev hover:text-fg')}>
                <span aria-hidden>{s.icon}</span><span className={cn(s.id !== section && 'hidden @7xl:inline')}>{s.title}</span>
                {doneSet.has(s.id) && <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-ok text-bg"><Check size={9} strokeWidth={4} /></span>}
                <span className="sr-only">{i + 1}-bo'lim</span>
              </button>
            </Tip>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div ref={scroller} className="min-w-0 flex-1 overflow-y-auto" onScroll={(e) => { const t = e.currentTarget; setProgress(t.scrollTop / Math.max(1, t.scrollHeight - t.clientHeight)) }}>
          <article className="mx-auto max-w-[860px] px-8 pb-24 pt-8">
            <AnimatePresence mode="wait">
              <motion.div key={`${id}-${section}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
                <header className="mb-6 flex items-center justify-between gap-4">
                  <div><div className="label mb-1">{idx + 1} / 13 · {meta.hint}</div><h2 className="flex items-center gap-2.5 text-[28px] font-semibold tracking-tight"><span>{meta.icon}</span>{meta.title}</h2></div>
                  {content.state === 'ready' && content.source === 'ai' && <div className="no-print flex items-center gap-2"><span className="chip"><Layers size={11} /> {content.cached ? 'keshdan' : 'yangi'} · AI</span><Tip label="Qayta generatsiya (keshni yangilaydi)"><Button size="sm" onClick={() => generate(true)}><RefreshCw size={13} /> Qayta generatsiya</Button></Tip></div>}
                  {content.state === 'streaming' && <Button size="sm" variant="danger" onClick={() => run.current?.cancel()}>To'xtatish</Button>}
                </header>

                <div ref={body}>
                  {section === 'goal' && <GoalSection lessonId={id} />}
                  {section === 'related' && <RelatedSection lessonId={id} />}
                  {content.state === 'loading' && meta.source === 'ai' && <SkeletonText lines={12} />}
                  {content.state === 'empty' && (
                    <div className="space-y-6">
                      <Empty icon={<Wand2 size={26} />} title="Bu bo'lim hali yaratilmagan"
                        desc={settings?.hasKey ? (online ? 'AI-Ustoz bu bo\'limni dars rejasidagi barcha chuqurlik nuqtalari bo\'yicha yozib beradi. Natija keshlanadi — keyingi safar internetsiz ham ochiladi.' : 'Hozir internet yo\'q. Bu bo\'lim uchun avval onlayn bo\'lib, bir marta generatsiya qilish kerak.') : 'Bu bo\'limni yaratish uchun Gemini API kaliti kerak. Sozlamalarda kalitni kiriting — yoki ★ belgili tayyor darslardan boshlang.'}
                        action={settings?.hasKey ? <Button variant="primary" size="lg" disabled={!online} onClick={() => generate()} data-testid="generate">{online ? <><Sparkles size={16} /> AI bilan yaratish</> : <><WifiOff size={16} /> Oflayn</>}</Button> : <Button variant="primary" onClick={() => nav('/settings')}>Sozlamalarga o'tish</Button>} />
                      <div className="card p-5"><div className="label mb-3">Bu bo'limda qamrab olinadi</div><ul className="grid gap-1.5 text-[14px] text-muted">{(section === 'lab' ? lesson.labs : section === 'breakfix' ? lesson.breakfix : section === 'interview' ? lesson.interview : section === 'quiz' ? lesson.quizTopics : lesson.depth).map((d) => <li key={d} className="flex gap-2"><span className="text-accent">▹</span>{d}</li>)}</ul></div>
                    </div>
                  )}
                  {content.state === 'error' && <Empty icon="⚠️" title={content.code === 'offline' ? 'Oflayn rejim' : ['key', 'nokey', 'region', 'quota', 'disabled'].includes(content.code ?? '') ? 'API kalit muammosi' : 'Yaratib bo\'lmadi'} desc={content.message} action={<div className="flex gap-2"><Button variant="primary" onClick={() => generate()}>Qayta urinish</Button>{['key', 'nokey', 'model', 'quota', 'region', 'disabled'].includes(content.code ?? '') && <Button onClick={() => nav('/settings')}>Sozlamalar</Button>}</div>} />}
                  {content.state === 'streaming' && (
                    <>
                      {content.wait ? <div className="mb-4 flex items-center gap-3 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn"><motion.span animate={{ rotate: [0, 180, 180, 360] }} transition={{ repeat: Infinity, duration: 2 }}><Hourglass size={16} /></motion.span> So'rovlar limiti (429): {content.wait} soniya kutilmoqda — avtomatik qayta uriniladi…</div> : null}
                      {section === 'quiz' ? <div className="card p-6"><div className="mb-3 flex items-center gap-2 text-sm text-muted"><Sparkles size={14} className="animate-pulse text-accent" /> Savollar tuzilmoqda… ({content.text.length} belgi)</div><SkeletonText lines={5} /></div> : content.text ? <Markdown text={content.text} streaming glossary={lesson.glossary} context={`${id}`} /> : !content.wait && <div><div className="mb-4 flex items-center gap-2 text-sm text-muted"><Sparkles size={14} className="animate-pulse text-accent" /> AI-Ustoz yozmoqda…</div><SkeletonText lines={8} /></div>}
                    </>
                  )}
                  {content.state === 'ready' && content.source !== 'static' && (section === 'quiz'
                    ? (quiz && quiz.length ? <Quiz lessonId={id} questions={quiz} /> : <Empty icon="⚠️" title="Test formatini o'qib bo'lmadi" desc="AI noto'g'ri formatda javob qaytardi." action={<Button variant="primary" onClick={() => generate(true)}>Qayta generatsiya</Button>} />)
                    : <Markdown text={content.text} glossary={lesson.glossary} context={`${id}`} />)}
                </div>

                {(content.state === 'ready') && (
                  <footer className="no-print mt-12 flex items-center justify-between gap-3 border-t pt-6">
                    <Button variant="ghost" disabled={idx === 0 && id === 1} onClick={() => (idx > 0 ? go(SECTION_IDS[idx - 1]) : nav(`/lesson/${id - 1}`))}><ArrowLeft size={15} /> {idx > 0 ? sectionMeta(SECTION_IDS[idx - 1]).title : 'Oldingi dars'}</Button>
                    <Button variant={doneSet.has(section) ? 'ok' : 'primary'} size="lg" onClick={complete} data-testid="complete">
                      {doneSet.has(section) ? <><Check size={16} /> Tugatilgan</> : <><CheckCircle2 size={16} /> Bo'limni tugatdim <span className="opacity-70">+10 XP</span></>}
                      <ArrowRight size={15} /> <span className="font-normal opacity-80">{idx < 12 ? sectionMeta(SECTION_IDS[idx + 1]).title : id < 73 ? 'Keyingi dars' : 'Yakun'}</span>
                    </Button>
                  </footer>
                )}
              </motion.div>
            </AnimatePresence>
          </article>
        </div>

        {/* O'ng ustun: bo'lim mundarijasi yoki eslatmalar */}
        {(showNotes || toc.length > 2) && (
          <aside className="hidden w-60 shrink-0 overflow-y-auto border-l px-4 py-6 @5xl:block" aria-label={showNotes ? 'Eslatmalar' : 'Bo\'lim mundarijasi'}>
            {showNotes ? (
              <div className="space-y-3">
                <div className="label">Eslatmalar · {notes.length}</div>
                {!notes.length && <p className="text-xs leading-relaxed text-faint">Matnni belgilab, <Highlighter size={11} className="inline text-warn" /> tugmasini bosing — belgilash va izoh shu yerda saqlanadi.</p>}
                {notes.map((n) => (
                  <div key={n.id} className="rounded-lg border bg-panel p-2.5 text-xs">
                    <button className="line-clamp-3 border-l-2 border-warn pl-2 text-left italic text-muted hover:text-fg" onClick={() => go(n.section as SectionId)}>{n.quote}</button>
                    {n.note && <p className="mt-1.5 whitespace-pre-wrap">{n.note}</p>}
                    <div className="mt-1.5 flex items-center justify-between text-[10.5px] text-faint"><span>{sectionMeta(n.section).icon} {sectionMeta(n.section).title}</span><button className="hover:text-bad" onClick={async () => { await invoke('notes:delete', n.id); setNotes(await invoke('notes:list', { lessonId: id })) }}>o'chirish</button></div>
                  </div>
                ))}
              </div>
            ) : (
              <nav className="sticky top-0"><div className="label mb-2">Shu bo'limda</div><ul className="space-y-0.5 border-l">{toc.map((h) => <li key={h.id}><a href={`#${h.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' }) }} className="-ml-px block border-l border-transparent py-1 pl-3 text-[12.5px] leading-snug text-muted transition hover:border-accent hover:text-fg">{h.text}</a></li>)}</ul>
                {lesson.tools.length > 0 && <><div className="label mb-2 mt-6">Vositalar</div>{lesson.tools.map((t) => { const tool = TOOLS.find((x) => x.id === t)!; return <Link key={t} to={`/tools/${t}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] text-muted transition hover:bg-elev hover:text-fg"><Wrench size={12} /> {tool.title}</Link> })}</>}
              </nav>
            )}
          </aside>
        )}
      </div>

      <SelectionBar container={body} onNote={(quote) => setNoteDraft({ quote, note: '' })} />
      <Modal open={!!noteDraft} onOpenChange={(o) => !o && setNoteDraft(null)} title="Belgilash va eslatma">
        {noteDraft && <div className="space-y-3">
          <blockquote className="max-h-32 overflow-y-auto rounded-lg border-l-[3px] border-warn bg-warn/10 px-3 py-2 text-sm italic">{noteDraft.quote}</blockquote>
          <textarea autoFocus rows={4} value={noteDraft.note} onChange={(e) => setNoteDraft({ ...noteDraft, note: e.target.value })} placeholder="Izohingiz (ixtiyoriy)…" className="input resize-none" aria-label="Eslatma matni" />
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setNoteDraft(null)}>Bekor qilish</Button><Button variant="primary" onClick={async () => { setNotes(await invoke('notes:add', { lessonId: id, section, quote: noteDraft.quote, note: noteDraft.note })); setNoteDraft(null); setShowNotes(true); toast({ kind: 'ok', title: 'Eslatma saqlandi' }) }}>Saqlash</Button></div>
        </div>}
      </Modal>
      <Modal open={recap.open} onOpenChange={(o) => setRecap((r) => ({ ...r, open: o }))} title="⏱️ 5 daqiqada eslat" desc={lesson.title} wide className="max-w-3xl">
        {recap.text ? <Markdown text={recap.text} streaming={recap.busy} glossary={lesson.glossary} /> : <SkeletonText lines={8} />}
      </Modal>
    </div>
  )
}
