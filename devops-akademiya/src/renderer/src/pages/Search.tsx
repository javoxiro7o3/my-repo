import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search as SearchIcon, Sparkles } from 'lucide-react'
import type { SearchHit } from '@shared/types'
import { LESSONS, MODULES } from '@shared/curriculum'
import { sectionMeta } from '@shared/sections'
import { invoke, runAi, type AiRun } from '@/lib/api'
import { useApp } from '@/store/app'
import { Button, Empty, PageHeader, SkeletonText } from '@/components/ui'
import { Markdown } from '@/components/Markdown'

export default function SearchPage() {
  const [sp, setSp] = useSearchParams()
  const q = sp.get('q') ?? ''
  const [input, setInput] = useState(q)
  const [hits, setHits] = useState<SearchHit[] | null>(null)
  const [ai, setAi] = useState<{ text: string; busy: boolean; err?: string } | null>(null)
  const run = useRef<AiRun | null>(null)
  const hasKey = useApp((s) => s.settings?.hasKey)
  const ask = (query: string) => {
    run.current?.cancel(); setAi({ text: '', busy: true })
    const r = runAi({ kind: 'search', text: query, selection: LESSONS.map((l) => `#${l.id} ${l.title}`).join('\n') }, { onChunk: (f) => setAi({ text: f, busy: true }) })
    run.current = r
    r.done.then((x) => setAi({ text: x.text, busy: false })).catch((e) => setAi({ text: '', busy: false, err: e.message }))
  }
  useEffect(() => { setInput(q); setAi(null); if (!q) return setHits(null); invoke<SearchHit[]>('search:query', q).then(setHits); if (sp.get('ai')) ask(q); return () => run.current?.cancel() }, [q]) // eslint-disable-line react-hooks/exhaustive-deps
  const snip = (s: string) => s.split(/[⟦⟧]/).map((p, i) => i % 2 ? <mark key={i} className="rounded bg-accent/30 px-0.5 text-fg">{p}</mark> : p)
  return (
    <div className="h-full overflow-y-auto"><div className="mx-auto max-w-4xl p-8">
      <PageHeader icon={<SearchIcon size={22} />} title="Qidiruv" desc="Barcha darslar bo'ylab to'liq matnli qidiruv va AI semantik savol" />
      <form onSubmit={(e) => { e.preventDefault(); setSp({ q: input }) }} className="mb-6 flex gap-2">
        <input autoFocus value={input} onChange={(e) => setInput(e.target.value)} placeholder="Masalan: Pod nega Pending turibdi?" className="input h-11 text-[15px]" aria-label="Qidiruv so'rovi" />
        <Button type="submit" variant="primary" size="lg">Qidirish</Button>
        <Button size="lg" disabled={!input.trim() || !hasKey} onClick={() => { setSp({ q: input, ai: '1' }); if (input === q) ask(input) }}><Sparkles size={15} /> AI dan so'rash</Button>
      </form>
      {ai && <div className="card mb-6 border-accent/40 p-5"><div className="label mb-2 flex items-center gap-1.5 !text-accent"><Sparkles size={11} /> AI javobi</div>{ai.err ? <p className="text-sm text-bad">{ai.err}</p> : ai.text ? <Markdown text={ai.text} streaming={ai.busy} className="!text-[14.5px]" /> : <SkeletonText lines={4} />}</div>}
      {!q ? <Empty icon="🔎" title="Nima qidiramiz?" desc="Atama, buyruq yoki xato xabarini yozing. Savol shaklida yozsangiz, AI dan so'rash tugmasi javob beradi va tegishli darslarni ko'rsatadi." />
        : hits === null ? <SkeletonText /> : !hits.length ? <Empty icon="🤷" title="Hech narsa topilmadi" desc="Boshqa so'z bilan urinib ko'ring yoki AI dan so'rang. Eslatma: AI yaratadigan bo'limlar faqat generatsiya qilingandan keyin indekslanadi." />
        : <ul className="space-y-2.5">{hits.map((h, i) => { const l = LESSONS[h.lessonId - 1]; const m = MODULES[l.module - 1]; return (
          <li key={i}><Link to={`/lesson/${h.lessonId}/${h.section}`} className="card block p-4 transition hover:border-accent"><div className="flex items-center gap-2 text-xs"><span className="rounded px-1.5 py-0.5 font-mono font-semibold" style={{ background: m.color + '22', color: m.color }}>#{l.id}</span><span className="font-semibold text-fg">{l.title}</span><span className="text-faint">· {sectionMeta(h.section).icon} {sectionMeta(h.section).title}</span></div><p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{snip(h.snippet)}</p></Link></li>
        ) })}</ul>}
    </div></div>
  )
}
