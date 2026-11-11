import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Award, BookOpen, Flame, Play, Repeat, Sparkles, Target, TrendingDown, Zap } from 'lucide-react'
import { LESSONS, MODULES, lessonById } from '@shared/curriculum'
import { SECTION_IDS, sectionMeta } from '@shared/sections'
import { BADGES, dayKey, levelFromXp } from '@shared/gamify'
import { cn } from '@/lib/utils'
import { useApp } from '@/store/app'
import { Button, Ring, Tip } from '@/components/ui'

function Heatmap({ activity }: { activity: Record<string, number> }) {
  const weeks = 26
  const days = useMemo(() => {
    const end = new Date(); end.setHours(0, 0, 0, 0)
    const start = new Date(end); start.setDate(end.getDate() - (weeks * 7 - 1) - ((end.getDay() + 6) % 7) + 6 - 6)
    const startMon = new Date(end); startMon.setDate(end.getDate() - ((end.getDay() + 6) % 7) - (weeks - 1) * 7)
    return Array.from({ length: weeks * 7 }, (_, i) => { const d = new Date(startMon); d.setDate(startMon.getDate() + i); return { key: dayKey(d.getTime()), d, future: d > end } })
  }, [])
  const lvl = (n: number) => (n === 0 ? 0 : n < 3 ? 1 : n < 7 ? 2 : n < 14 ? 3 : 4)
  const months = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek']
  return (
    <div>
      <div className="mb-1 ml-7 grid text-[10px] text-faint" style={{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }}>{Array.from({ length: weeks }, (_, w) => { const d = days[w * 7].d; return <span key={w}>{d.getDate() <= 7 ? months[d.getMonth()] : ''}</span> })}</div>
      <div className="flex gap-1.5">
        <div className="grid grid-rows-7 gap-[3px] text-[9.5px] leading-[13px] text-faint"><span>Du</span><span /><span>Ch</span><span /><span>Ju</span><span /><span>Ya</span></div>
        <div className="grid flex-1 auto-cols-fr grid-flow-col grid-rows-7 gap-[3px]" role="img" aria-label="So'nggi 26 haftalik faollik xaritasi">
          {days.map((x) => { const n = activity[x.key] ?? 0; return <Tip key={x.key} side="top" label={`${x.d.toLocaleDateString('uz')} — ${n} ta faollik`}><span className={cn('h-[13px] min-w-0 rounded-[3px]', x.future && 'invisible')} style={{ background: n ? `hsl(var(--accent) / ${[0, 0.3, 0.5, 0.75, 1][lvl(n)]})` : 'hsl(var(--elev))' }} /></Tip> })}
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { stats, settings } = useApp()
  const nav = useNavigate()
  if (!stats) return null
  const lv = levelFromXp(stats.xp)
  const frac = (id: number) => (stats.sectionsDone[id]?.length ?? 0) / SECTION_IDS.length
  const total = LESSONS.reduce((a, l) => a + frac(l.id), 0) / LESSONS.length
  const last = stats.last ? lessonById(stats.last.lessonId) : undefined
  const doneSet = new Set(stats.lessonsDone)
  const nextLesson = LESSONS.find((l) => !doneSet.has(l.id) && l.id !== last?.id) ?? LESSONS[0]
  const nextSection = last ? SECTION_IDS.find((s) => !(stats.sectionsDone[last.id] ?? []).includes(s)) ?? stats.last!.section : 'goal'
  const hour = new Date().getHours()
  const hello = hour < 5 ? 'Xayrli tun' : hour < 11 ? 'Xayrli tong' : hour < 18 ? 'Xayrli kun' : 'Xayrli kech'
  const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }
  return (
    <div className="h-full overflow-y-auto">
      <motion.div initial="hidden" animate="show" transition={{ staggerChildren: 0.05 }} className="mx-auto max-w-[1180px] space-y-5 p-8">
        <motion.div variants={item}><h1 className="text-[28px] font-semibold tracking-tight">{hello}{settings?.name ? `, ${settings.name}` : ''}! 👋</h1><p className="mt-1 text-muted">{stats.streak > 0 ? `${stats.streak} kunlik streak davom etmoqda — bugun ham to'xtamang.` : 'Bugun bitta bo\'lim o\'qing — streak shu yerdan boshlanadi.'}</p></motion.div>

        <div className="grid gap-5 @4xl:grid-cols-3">
          <motion.div variants={item} className="card relative overflow-hidden p-6 @4xl:col-span-2">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/15 blur-3xl" />
            <div className="label mb-3 flex items-center gap-1.5"><Play size={11} /> {last ? 'Davom ettirish' : 'Boshlash'}</div>
            {(() => { const l = last ?? LESSONS[0]; const m = MODULES[l.module - 1]; return (
              <div className="flex items-center gap-5">
                <Ring value={frac(l.id)} size={76} stroke={6} color={m.color}><span className="text-base">{Math.round(frac(l.id) * 100)}%</span></Ring>
                <div className="min-w-0 flex-1">
                  <div className="text-xs" style={{ color: m.color }}>{m.id}-modul · {m.title}</div>
                  <div className="truncate text-xl font-semibold tracking-tight">#{l.id} {l.title}</div>
                  <div className="mt-0.5 text-sm text-muted">Keyingi bo'lim: {sectionMeta(nextSection).icon} {sectionMeta(nextSection).title}</div>
                </div>
                <Button variant="primary" size="lg" onClick={() => nav(`/lesson/${l.id}/${nextSection}`)} data-testid="continue">{last ? 'Davom etish' : 'Boshlash'} <ArrowRight size={16} /></Button>
              </div>
            ) })()}
          </motion.div>
          <motion.div variants={item} className="card flex flex-col justify-between p-6">
            <div className="flex items-center justify-between"><div className="label">Daraja</div><span className="chip"><Zap size={11} className="text-accent" /> {stats.xp} XP</span></div>
            <div className="mt-2"><span className="text-3xl font-semibold tracking-tight">{lv.level}</span><span className="ml-2 text-sm text-muted">{lv.title}</span></div>
            <div className="mt-3"><div className="h-2 overflow-hidden rounded-full bg-elev"><motion.div className="h-full rounded-full bg-gradient-to-r from-accent to-info" initial={{ width: 0 }} animate={{ width: `${(lv.cur / lv.need) * 100}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} /></div><div className="mt-1.5 text-xs text-faint">Keyingi darajagacha {lv.need - lv.cur} XP</div></div>
          </motion.div>
        </div>

        <div className="grid gap-5 @lg:grid-cols-2 @4xl:grid-cols-4">
          {[
            { icon: <Flame size={18} />, label: 'Kunlik streak', value: `${stats.streak} kun`, sub: `Rekord: ${stats.bestStreak} kun`, c: 'text-warn bg-warn/12' },
            { icon: <BookOpen size={18} />, label: 'Umumiy progress', value: `${Math.round(total * 100)}%`, sub: `${stats.lessonsDone.length} / 73 dars tugatilgan`, c: 'text-accent bg-accent/12' },
            { icon: <Target size={18} />, label: 'Test aniqligi', value: stats.quiz.total ? `${Math.round((stats.quiz.correct / stats.quiz.total) * 100)}%` : '—', sub: `${stats.quiz.correct} / ${stats.quiz.total} to'g'ri`, c: 'text-ok bg-ok/12' },
            { icon: <Repeat size={18} />, label: 'Bugungi takrorlash', value: `${stats.dueCards} karta`, sub: stats.dueCards ? 'SM-2 bo\'yicha vaqti keldi' : 'Hammasi takrorlangan ✓', c: 'text-info bg-info/12', to: '/review' }
          ].map((s) => (
            <motion.div key={s.label} variants={item} whileHover={{ y: -2 }} onClick={() => s.to && nav(s.to)} className={cn('card p-5', s.to && 'cursor-pointer hover:border-accent')} role={s.to ? 'link' : undefined} tabIndex={s.to ? 0 : undefined} onKeyDown={(e) => e.key === 'Enter' && s.to && nav(s.to)}>
              <div className={cn('mb-3 flex h-9 w-9 items-center justify-center rounded-lg', s.c)}>{s.icon}</div>
              <div className="text-2xl font-semibold tracking-tight tabular-nums">{s.value}</div><div className="text-[13px] text-muted">{s.label}</div><div className="mt-0.5 text-xs text-faint">{s.sub}</div>
            </motion.div>
          ))}
        </div>

        <div className="grid gap-5 @4xl:grid-cols-3">
          <motion.div variants={item} className="card p-6 @4xl:col-span-2"><div className="mb-4 flex items-center justify-between"><div className="label">Faollik xaritasi</div><span className="flex items-center gap-1 text-[10px] text-faint">kam {[0.15, 0.3, 0.5, 0.75, 1].map((o) => <span key={o} className="h-2.5 w-2.5 rounded-[3px]" style={{ background: `hsl(var(--accent) / ${o})` }} />)} ko'p</span></div><Heatmap activity={stats.activity} /></motion.div>
          <motion.div variants={item} className="card p-6">
            <div className="label mb-3 flex items-center gap-1.5"><Sparkles size={11} /> Keyingi tavsiya</div>
            <Link to={`/lesson/${nextLesson.id}`} className="group block rounded-xl border bg-elev/50 p-4 transition hover:border-accent"><div className="text-xs text-faint">#{nextLesson.id} · ~{nextLesson.minutes} daqiqa {nextLesson.premium && '· ★ oflayn'}</div><div className="mt-0.5 font-semibold leading-snug">{nextLesson.title}</div><div className="mt-1 line-clamp-2 text-[13px] text-muted">{nextLesson.summary}</div></Link>
            {stats.dueCards > 0 && <Button className="mt-3 w-full" onClick={() => nav('/review')}><Repeat size={14} /> {stats.dueCards} ta kartani takrorlash</Button>}
          </motion.div>
        </div>

        <div className="grid gap-5 @4xl:grid-cols-2">
          <motion.div variants={item} className="card p-6">
            <div className="label mb-3 flex items-center gap-1.5"><TrendingDown size={11} /> Zaif mavzular</div>
            {stats.weakTopics.length ? <ul className="space-y-2">{stats.weakTopics.slice(0, 6).map((w) => (
              <li key={`${w.lessonId}-${w.topic}`} className="flex items-center gap-3"><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{w.topic}</div><Link to={`/lesson/${w.lessonId}/quiz`} className="truncate text-xs text-faint hover:text-accent">#{w.lessonId} {lessonById(w.lessonId)?.title}</Link></div><div className="h-1.5 w-24 overflow-hidden rounded-full bg-elev"><div className="h-full bg-bad" style={{ width: `${(w.wrong / w.total) * 100}%` }} /></div><span className="w-12 text-right text-xs tabular-nums text-bad">{w.wrong}/{w.total}</span></li>
            ))}<li><Button size="sm" className="mt-2" onClick={() => nav('/ai/quiz')}><Sparkles size={13} /> Zaif joylar bo'yicha AI test</Button></li></ul> : <p className="text-sm leading-relaxed text-muted">Hali ma'lumot yo'q. Mini-testlarni yeching — xato qilgan mavzularingiz shu yerda ko'rinadi va AI ular bo'yicha yangi savollar tuzadi.</p>}
          </motion.div>
          <motion.div variants={item} className="card p-6">
            <div className="mb-3 flex items-center justify-between"><div className="label flex items-center gap-1.5"><Award size={11} /> Nishonlar</div><span className="text-xs text-faint">{Object.keys(stats.badges).length} / {BADGES.length}</span></div>
            <div className="grid grid-cols-6 gap-2.5 @lg:grid-cols-8 @4xl:grid-cols-7">{BADGES.map((b) => { const got = !!stats.badges[b.id]; return <Tip key={b.id} side="top" label={<span><b>{b.name}</b><br />{b.desc}{got ? <><br /><span className="text-ok">✓ {new Date(stats.badges[b.id]).toLocaleDateString('uz')}</span></> : <><br /><span className="text-faint">Hali ochilmagan</span></>}</span>}><div tabIndex={0} aria-label={`${b.name}${got ? ' (ochilgan)' : ' (yopiq)'}`} className={cn('flex aspect-square items-center justify-center rounded-xl border text-xl transition', got ? 'border-warn/40 bg-warn/10 shadow-soft' : 'opacity-30 grayscale')}>{b.icon}</div></Tip> })}</div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}
