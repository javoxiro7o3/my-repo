import { Suspense } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Wrench } from 'lucide-react'
import { LESSONS } from '@shared/curriculum'
import { TOOLS } from '@/tools/registry'
import { Button, PageHeader, SkeletonText } from '@/components/ui'

export default function Tools() {
  const { id } = useParams()
  const nav = useNavigate()
  const tool = TOOLS.find((t) => t.id === id)
  if (tool) {
    const C = tool.component
    const used = LESSONS.filter((l) => l.tools.includes(tool.id))
    return (
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center gap-3 border-b px-6 py-3">
          <Button variant="ghost" size="iconSm" onClick={() => nav('/tools')} aria-label="Vositalar ro'yxatiga qaytish"><ArrowLeft size={16} /></Button>
          <span className="text-2xl">{tool.icon}</span>
          <div className="min-w-0 flex-1"><h1 className="text-[17px] font-semibold tracking-tight">{tool.title}</h1><p className="truncate text-xs text-muted">{tool.desc}</p></div>
          <div className="hidden items-center gap-1.5 @4xl:flex">{used.slice(0, 4).map((l) => <Link key={l.id} to={`/lesson/${l.id}`} className="chip hover:border-accent hover:text-fg">#{l.id} dars</Link>)}</div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto"><div className="mx-auto max-w-[1280px] p-6"><Suspense fallback={<SkeletonText lines={10} />}><C /></Suspense></div></div>
      </div>
    )
  }
  const groups = [...new Set(TOOLS.map((t) => t.group))]
  return (
    <div className="h-full overflow-y-auto"><div className="mx-auto max-w-6xl p-8">
      <PageHeader icon={<Wrench size={22} />} title="Interaktiv vositalar" desc="Ilova ichida ishlaydigan simulyatorlar — hech narsa o'rnatmasdan, internetsiz" />
      {groups.map((g) => (
        <section key={g} className="mb-8"><h2 className="label mb-3">{g}</h2>
          <div className="grid gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3">{TOOLS.filter((t) => t.group === g).map((t) => (
            <Link key={t.id} to={`/tools/${t.id}`} className="card group flex gap-4 p-5 transition hover:-translate-y-0.5 hover:border-accent hover:shadow-glow">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-elev text-2xl transition group-hover:scale-110">{t.icon}</span>
              <span><span className="block text-[15px] font-semibold">{t.title}</span><span className="mt-0.5 block text-[13px] leading-relaxed text-muted">{t.desc}</span></span>
            </Link>
          ))}</div>
        </section>
      ))}
    </div></div>
  )
}
