import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, FolderKanban, Lock, Map as MapIcon, Star } from 'lucide-react'
import { LESSONS, MODULES } from '@shared/curriculum'
import { SECTION_IDS } from '@shared/sections'
import { BADGES, MODULE_BADGES } from '@shared/gamify'
import { cn } from '@/lib/utils'
import { useApp } from '@/store/app'
import { PageHeader, Ring, Tip } from '@/components/ui'

const STAGES = [['Linux', [1]], ['Network', [2]], ['Deploy', [3]], ['Docker', [4]], ['CI/CD', [5]], ['IaC', [6]], ['Observability', [7]], ['Kubernetes', [8, 9, 10, 11]], ['Private Infra', [12, 13]]] as const

export default function Roadmap() {
  const stats = useApp((s) => s.stats)
  const nav = useNavigate()
  if (!stats) return null
  const done = new Set(stats.lessonsDone)
  const frac = (id: number) => (stats.sectionsDone[id]?.length ?? 0) / SECTION_IDS.length
  const modDone = (mid: number) => MODULES[mid - 1].lessons.every((id) => done.has(id))
  // Tavsiya etilgan yo'l: oldingi modul kamida 50% bo'lsa "ochiq" (qat'iy qulf emas — istalgan darsga kirish mumkin)
  const modFrac = (mid: number) => MODULES[mid - 1].lessons.reduce((a, id) => a + frac(id), 0) / MODULES[mid - 1].lessons.length
  const recommended = (mid: number) => mid === 1 || modFrac(mid - 1) >= 0.5 || modFrac(mid) > 0
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1100px] p-8">
        <PageHeader icon={<MapIcon size={22} />} title="Yo'l xaritasi" desc="Linux dan to'liq private infratuzilmagacha — 13 modul, 73 dars" />
        <div className="card mb-8 flex items-center gap-1 overflow-x-auto p-4">
          {STAGES.map(([name, mods], i) => { const f = mods.reduce((a, m) => a + modFrac(m), 0) / mods.length; return (
            <div key={name} className="flex shrink-0 items-center gap-1">
              {i > 0 && <span className="h-0.5 w-6 rounded" style={{ background: f > 0 ? 'hsl(var(--accent))' : 'hsl(var(--border))' }} />}
              <button onClick={() => document.getElementById(`mod-${mods[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className={cn('flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition hover:border-accent', f >= 1 ? 'border-ok/50 bg-ok/10 text-ok' : f > 0 ? 'border-accent/50 bg-accent/10' : 'text-muted')}>{f >= 1 ? <Check size={12} /> : <span className="tabular-nums text-faint">{Math.round(f * 100)}%</span>} {name}</button>
            </div>
          ) })}
        </div>

        <div className="relative">
          <div className="absolute bottom-0 left-[27px] top-0 w-0.5 bg-border" aria-hidden />
          {MODULES.map((m, mi) => {
            const rec = recommended(m.id), badge = BADGES.find((b) => b.id === MODULE_BADGES[m.id - 1])!
            return (
              <motion.section key={m.id} id={`mod-${m.id}`} initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.3, delay: Math.min(mi * 0.02, 0.2) }} className="relative mb-8 scroll-mt-4 pl-[76px]">
                <div className="absolute left-0 top-0 flex h-14 w-14 items-center justify-center rounded-2xl border-2 bg-panel" style={{ borderColor: m.color }}>
                  {modDone(m.id) ? <Check size={24} style={{ color: m.color }} strokeWidth={3} /> : <Ring value={modFrac(m.id)} size={40} stroke={3.5} color={m.color}><span className="text-[13px]" style={{ color: m.color }}>{m.id}</span></Ring>}
                </div>
                <div className={cn('card overflow-hidden transition', !rec && 'opacity-70')}>
                  <div className="flex items-center justify-between gap-4 border-b px-5 py-3.5" style={{ background: `linear-gradient(90deg, ${m.color}18, transparent 60%)` }}>
                    <div><h2 className="text-lg font-semibold tracking-tight">{m.id}-modul. {m.title}</h2><p className="text-[13px] text-muted">{m.summary}</p></div>
                    <div className="flex shrink-0 items-center gap-2">
                      {!rec && <Tip label="Tavsiya: avval oldingi modulning kamida yarmini o'ting. Qulf qat'iy emas — darslarga baribir kira olasiz."><span className="chip"><Lock size={11} /> avval {m.id - 1}-modul</span></Tip>}
                      <Tip label={<span><b>{badge.name}</b><br />{badge.desc}</span>}><span className={cn('flex h-9 w-9 items-center justify-center rounded-xl border text-lg', stats.badges[badge.id] ? 'border-warn/40 bg-warn/10' : 'opacity-35 grayscale')}>{badge.icon}</span></Tip>
                    </div>
                  </div>
                  <div className="grid gap-2 p-4 @2xl:grid-cols-2">
                    {m.lessons.map((id) => { const l = LESSONS[id - 1], f = frac(id); return (
                      <Link key={id} to={`/lesson/${id}`} className="group flex items-center gap-3 rounded-lg border bg-bg/40 px-3 py-2.5 transition hover:border-accent hover:bg-elev">
                        {done.has(id) ? <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ok/20 text-ok"><Check size={14} strokeWidth={3} /></span> : <Ring value={f} size={28} stroke={2.5} color={m.color}><span className="text-[10px] text-muted">{id}</span></Ring>}
                        <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-medium">{l.title}</span><span className="block truncate text-[11.5px] text-faint">{l.concepts.slice(0, 4).join(' · ')}</span></span>
                        {l.premium && <Tip label="Tayyor oflayn kontent"><Star size={13} className="shrink-0 fill-warn text-warn" /></Tip>}
                      </Link>
                    ) })}
                    <button onClick={() => nav(`/project/${m.id}`)} className="flex items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 text-left transition hover:border-accent hover:bg-elev @2xl:col-span-2" style={{ borderColor: m.color + '77' }}>
                      <FolderKanban size={18} style={{ color: m.color }} /><span className="flex-1"><span className="block text-[13.5px] font-semibold">{m.id === 13 ? '🏁 ' : ''}Final loyiha: {m.project.title}</span><span className="block text-[12px] text-muted">{m.project.tasks.filter((_, i) => stats.projects[`${m.id}:${i}`]).length} / {m.project.tasks.length} talab bajarilgan</span></span>
                    </button>
                  </div>
                </div>
              </motion.section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
