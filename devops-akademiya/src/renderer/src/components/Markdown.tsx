import { Children, isValidElement, lazy, memo, Suspense, useMemo, useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeHighlight from 'rehype-highlight'
import { Check, Copy, Lightbulb, Sparkles } from 'lucide-react'
import type { GlossaryItem } from '@shared/types'
import { cn, copy } from '@/lib/utils'
import { useApp } from '@/store/app'
import { Button, Modal, Tip } from './ui'
import Mermaid from './Mermaid'

const BreakFix = lazy(() => import('./BreakFix'))

// XSS himoyasi: faqat xavfsiz teglar; skript, iframe, on* atributlar olib tashlanadi
const schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'details', 'summary', 'abbr', 'mark', 'kbd', 'figure', 'figcaption'],
  attributes: { ...defaultSchema.attributes, code: [['className', /^language-[\w-]+$/]], details: ['open'], '*': [...(defaultSchema.attributes?.['*'] ?? []).filter((a) => a !== 'style')] },
  protocols: { ...defaultSchema.protocols, src: ['data', 'https'], href: ['https', 'http', 'mailto'] }
}

const textOf = (n: ReactNode): string => typeof n === 'string' || typeof n === 'number' ? String(n) : Array.isArray(n) ? n.map(textOf).join('') : isValidElement(n) ? textOf((n.props as any).children) : ''
const slug = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60)

/** Lug'at atamalarini (har biri bir marta) <abbr data-g> ga o'raydi — kod, havola va sarlavhalardan tashqari */
function rehypeGlossary(terms: GlossaryItem[]) {
  return () => (tree: any) => {
    if (!terms.length) return
    const left = new Map(terms.map((t) => [t.term.toLowerCase(), t]))
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const walk = (node: any) => {
      if (!node.children || !left.size) return
      if (node.type === 'element' && ['code', 'pre', 'a', 'h1', 'h2', 'h3', 'h4', 'abbr', 'summary', 'th'].includes(node.tagName)) return
      const out: any[] = []
      for (const ch of node.children) {
        if (ch.type !== 'text' || !left.size) { walk(ch); out.push(ch); continue }
        let text: string = ch.value
        const re = new RegExp(`(?<![\\p{L}\\p{N}_-])(${[...left.keys()].sort((a, b) => b.length - a.length).map(esc).join('|')})(?![\\p{L}\\p{N}_-])`, 'iu')
        let m: RegExpExecArray | null, guard = 0
        while (left.size && guard++ < 6 && (m = re.exec(text))) {
          const t = left.get(m[1].toLowerCase()); if (!t) break
          left.delete(m[1].toLowerCase())
          if (m.index) out.push({ type: 'text', value: text.slice(0, m.index) })
          out.push({ type: 'element', tagName: 'abbr', properties: { 'data-g': t.def }, children: [{ type: 'text', value: m[1] }] })
          text = text.slice(m.index + m[1].length)
          break
        }
        if (text) out.push({ type: 'text', value: text })
      }
      node.children = out
    }
    walk(tree)
  }
}

function CodeBlock({ lang, code, children }: { lang: string; code: string; children: ReactNode }) {
  const [ok, setOk] = useState(false)
  const askAi = useApp((s) => s.askAi)
  return (
    <div className="codeblock group">
      <div className="flex items-center justify-between border-b bg-elev/60 px-3 py-1">
        <span className="font-mono text-[11px] uppercase tracking-wider text-faint">{lang || 'matn'}</span>
        <div className="no-print flex gap-1 opacity-60 transition group-hover:opacity-100">
          <Tip label="AI-Ustozdan qator-qator tushuntirishni so'rash"><Button variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-[11px]" onClick={() => askAi('Shu kodni qator-qator tushuntir: har bir flag va parametr nima qiladi, o\'chirilsa nima bo\'ladi?', code)}><Sparkles size={12} /> Tushuntir</Button></Tip>
          <Button variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-[11px]" onClick={async () => { if (await copy(code)) { setOk(true); setTimeout(() => setOk(false), 1400) } }} aria-label="Kodni nusxalash">{ok ? <><Check size={12} className="text-ok" /> Nusxalandi</> : <><Copy size={12} /> Nusxa ol</>}</Button>
        </div>
      </div>
      <pre tabIndex={0}>{children}</pre>
    </div>
  )
}

/** "Bu buyruqni tahlil qil" — qism ustiga kelsa/bosilsa izohi yoritiladi */
function Tahlil({ raw }: { raw: string }) {
  const data = useMemo(() => { try { const d = JSON.parse(raw); return Array.isArray(d.parts) ? (d as { command: string; parts: { t: string; d: string }[] }) : null } catch { return null } }, [raw])
  const [act, setAct] = useState(0)
  if (!data) return <div className="codeblock"><pre><code>{raw}</code></pre></div>
  const hues = [243, 190, 152, 38, 320, 268, 12, 95]
  return (
    <div className="my-5 overflow-hidden rounded-xl border bg-panel">
      <div className="flex items-center gap-2 border-b bg-elev/60 px-3 py-1.5 text-xs text-muted"><Lightbulb size={13} className="text-warn" /> Buyruq tahlili — qism ustiga kursorni olib boring yoki bosing</div>
      <div className="flex flex-wrap gap-1.5 px-4 pb-2 pt-4 font-mono text-[.9em]">
        {data.parts.map((p, i) => (
          <button key={i} onMouseEnter={() => setAct(i)} onFocus={() => setAct(i)} onClick={() => setAct(i)} aria-pressed={act === i}
            className={cn('rounded-md border px-2 py-1 transition', act === i ? 'scale-105 shadow-soft' : 'opacity-75 hover:opacity-100')}
            style={{ borderColor: `hsl(${hues[i % 8]} 80% 60% / ${act === i ? 0.9 : 0.35})`, background: `hsl(${hues[i % 8]} 80% 60% / ${act === i ? 0.2 : 0.07})` }}>{p.t}</button>
        ))}
      </div>
      <div className="mx-4 mb-4 mt-1 min-h-[3.2em] rounded-lg border-l-[3px] bg-elev/70 px-3 py-2 text-[.92em] leading-relaxed" style={{ borderColor: `hsl(${hues[act % 8]} 80% 60%)` }} aria-live="polite">
        <code className="mr-2 font-mono text-[.9em] font-semibold">{data.parts[act]?.t}</code>{data.parts[act]?.d}
      </div>
      <ol className="sr-only">{data.parts.map((p, i) => <li key={i}>{p.t}: {p.d}</li>)}</ol>
    </div>
  )
}

function GlossaryTerm({ def, children }: { def: string; children: ReactNode }) {
  return <Tip wide side="top" label={<span><b className="text-accent">{textOf(children)}</b> — {def}</span>}><abbr data-g="" tabIndex={0}>{children}</abbr></Tip>
}
function Img(p: any) {
  const [z, setZ] = useState(false)
  return <><img {...p} loading="lazy" onClick={() => setZ(true)} alt={p.alt ?? 'Rasm'} /><Modal open={z} onOpenChange={setZ} title={p.alt || 'Rasm'} wide><img src={p.src} alt={p.alt ?? ''} className="mx-auto max-h-[75vh]" /></Modal></>
}

export interface MarkdownProps { text: string; glossary?: GlossaryItem[]; streaming?: boolean; className?: string; context?: string }

function MarkdownImpl({ text, glossary, streaming, className, context }: MarkdownProps) {
  const rehype = useMemo(() => [rehypeRaw, [rehypeSanitize, schema], [rehypeHighlight, { detect: false }], rehypeGlossary(glossary ?? [])] as any, [glossary])
  const components = useMemo(() => ({
    pre({ children }: any) {
      const child = Children.toArray(children)[0] as any
      const cls: string = child?.props?.className ?? ''
      const lang = /language-([\w-]+)/.exec(cls)?.[1] ?? ''
      const code = textOf(child?.props?.children).replace(/\n$/, '')
      if (lang === 'mermaid') return <Mermaid code={code} streaming={streaming} />
      if (lang === 'tahlil') return streaming ? <div className="skeleton my-4 h-24 rounded-xl" /> : <Tahlil raw={code} />
      if (lang === 'breakfix') return streaming ? <div className="skeleton my-4 h-48 rounded-xl" /> : <Suspense fallback={<div className="skeleton my-4 h-48 rounded-xl" />}><BreakFix raw={code} context={context} /></Suspense>
      return <CodeBlock lang={lang} code={code}>{children}</CodeBlock>
    },
    table: ({ children }: any) => <div className="table-wrap"><table>{children}</table></div>,
    h2: ({ children }: any) => <h2 id={slug(textOf(children))}>{children}</h2>,
    h3: ({ children }: any) => <h3 id={slug(textOf(children))}>{children}</h3>,
    h1: ({ children }: any) => <h2 id={slug(textOf(children))}>{children}</h2>,
    a: ({ href, children }: any) => <a href={href} onClick={(e) => { e.preventDefault(); if (href) window.open(href, '_blank') }} rel="noreferrer">{children}</a>,
    abbr: (p: any) => p['data-g'] ? <GlossaryTerm def={p['data-g']}>{p.children}</GlossaryTerm> : <abbr title={p.title}>{p.children}</abbr>,
    img: Img
  }), [streaming, context])
  return (
    <div className={cn('prose', streaming && '[&>*:last-child]:cursor-blink', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={rehype} components={components as any}>{text}</ReactMarkdown>
    </div>
  )
}
export const Markdown = memo(MarkdownImpl)
export const headingsOf = (md: string) => [...md.matchAll(/^(#{2,3})\s+(.+)$/gm)].map((m) => ({ level: m[1].length, text: m[2].replace(/[*`_]/g, ''), id: slug(m[2].replace(/[*`_]/g, '')) }))
