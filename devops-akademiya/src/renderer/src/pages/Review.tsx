import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { PartyPopper, Repeat } from 'lucide-react'
import type { SrsCard } from '@shared/types'
import { lessonById } from '@shared/curriculum'
import { sm2 } from '@shared/sm2'
import { invoke } from '@/lib/api'
import { useApp } from '@/store/app'
import { Button, Empty, Kbd, PageHeader } from '@/components/ui'

const GRADES = [{ q: 1, label: 'Bilmadim', key: '1', v: 'danger' as const }, { q: 3, label: 'Qiyin', key: '2', v: 'secondary' as const }, { q: 4, label: 'Yaxshi', key: '3', v: 'secondary' as const }, { q: 5, label: 'Oson', key: '4', v: 'ok' as const }]
const when = (c: SrsCard, q: number) => { if (q < 3) return '10 daqiqa'; const d = sm2(c, q).interval; return d === 1 ? '1 kun' : `${d} kun` }

export default function Review() {
  const [cards, setCards] = useState<SrsCard[] | null>(null)
  const [i, setI] = useState(0)
  const [flip, setFlip] = useState(false)
  const [count, setCount] = useState(0)
  const refreshStats = useApp((s) => s.refreshStats)
  useEffect(() => { invoke<SrsCard[]>('srs:due', { limit: 40 }).then(setCards) }, [])
  const c = cards?.[i]
  const grade = async (q: number) => { if (!c) return; await invoke('srs:review', { id: c.id, q }); setFlip(false); setCount((n) => n + 1); setI(i + 1); void refreshStats() }
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (!c) return; if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlip(true) } else if (flip) { const g = GRADES.find((x) => x.key === e.key); if (g) void grade(g.q) } }
    addEventListener('keydown', h); return () => removeEventListener('keydown', h)
  })
  return (
    <div className="h-full overflow-y-auto"><div className="mx-auto max-w-3xl p-8">
      <PageHeader icon={<Repeat size={22} />} title="Bugungi takrorlash" desc="SM-2 oraliqli takrorlash: unutish arafasida eslatamiz — bilim uzoq muddatli xotiraga o'tadi" right={cards?.length ? <span className="chip tabular-nums">{Math.min(i + 1, cards.length)} / {cards.length}</span> : null} />
      {!cards ? null : !cards.length ? <Empty icon="✨" title="Bugun takrorlanadigan karta yo'q" desc="Darsni tugatganingizda uning atamalari, testda xato qilganingizda esa o'sha savol avtomatik kartaga aylanadi. Kartalar SM-2 algoritmi belgilagan kuni shu yerda paydo bo'ladi." action={<Link to="/"><Button variant="primary">Darslarga qaytish</Button></Link>} />
        : !c ? <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}><Empty icon={<PartyPopper size={28} />} title={`Barakalla! ${count} ta karta takrorlandi`} desc={`+${count * 3} XP. Keyingi takrorlash vaqti kelganda bosh sahifada ko'rinadi.`} action={<Link to="/"><Button variant="primary">Bosh sahifa</Button></Link>} /></motion.div>
        : (
          <>
            <div className="mb-4 h-1 overflow-hidden rounded-full bg-elev"><motion.div className="h-full bg-accent" animate={{ width: `${(i / cards.length) * 100}%` }} /></div>
            <AnimatePresence mode="wait">
              <motion.div key={c.id} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.2 }} className="card min-h-[320px] p-8">
                <Link to={`/lesson/${c.lessonId}`} className="label hover:text-accent">#{c.lessonId} {lessonById(c.lessonId)?.title}</Link>
                <p className="mt-4 whitespace-pre-wrap text-xl font-medium leading-relaxed">{c.front}</p>
                {flip ? <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 whitespace-pre-wrap rounded-xl border-l-[3px] border-accent bg-accent/[.07] px-5 py-4 text-[15px] leading-relaxed">{c.back}</motion.div>
                  : <div className="mt-10 flex flex-col items-center gap-3"><p className="text-sm text-muted">Avval javobni xayolan ayting, keyin tekshiring</p><Button variant="primary" size="lg" onClick={() => setFlip(true)} autoFocus>Javobni ko'rsatish <Kbd>Space</Kbd></Button></div>}
              </motion.div>
            </AnimatePresence>
            {flip && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 grid grid-cols-4 gap-3">{GRADES.map((g) => <Button key={g.q} variant={g.v} className="h-auto flex-col gap-0.5 py-3" onClick={() => grade(g.q)}><span className="text-[15px]">{g.label}</span><span className="text-[11px] font-normal opacity-70">{when(c, g.q)} · <Kbd>{g.key}</Kbd></span></Button>)}</motion.div>}
          </>
        )}
    </div></div>
  )
}
