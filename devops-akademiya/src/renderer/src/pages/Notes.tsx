import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookMarked, Bookmark, Trash2 } from 'lucide-react'
import type { Note } from '@shared/types'
import { lessonById } from '@shared/curriculum'
import { sectionMeta } from '@shared/sections'
import { invoke } from '@/lib/api'
import { useApp } from '@/store/app'
import { Button, Empty, PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([])
  const { stats, refreshStats, toast } = useApp()
  const load = () => invoke<Note[]>('notes:list').then(setNotes)
  useEffect(() => { void load() }, [])
  const exportMd = async () => { const md = '# Eslatmalarim — DevOps Akademiya\n\n' + notes.map((n) => `## #${n.lessonId} ${lessonById(n.lessonId)?.title} — ${sectionMeta(n.section).title}\n\n> ${n.quote.replace(/\n/g, '\n> ')}\n\n${n.note}\n`).join('\n'); if (await invoke('export:md', { name: 'eslatmalar', markdown: md })) toast({ kind: 'ok', title: 'Eslatmalar saqlandi' }) }
  return (
    <div className="h-full overflow-y-auto"><div className="mx-auto max-w-4xl p-8">
      <PageHeader icon={<BookMarked size={22} />} title="Eslatma va xatcho'plar" desc="Belgilagan joylaringiz va izohlaringiz bir joyda" right={notes.length ? <Button onClick={exportMd}>Markdown ga eksport</Button> : null} />
      <Tabs defaultValue="notes">
        <TabsList><TabsTrigger value="notes">Eslatmalar · {notes.length}</TabsTrigger><TabsTrigger value="bm">Xatcho'plar · {stats?.bookmarks.length ?? 0}</TabsTrigger></TabsList>
        <TabsContent value="notes" className="mt-5 space-y-3">
          {!notes.length ? <Empty icon="🖍️" title="Hali eslatma yo'q" desc="Dars matnidan istalgan joyni sichqoncha bilan belgilang — paydo bo'lgan panelda marker tugmasini bosing." /> : notes.map((n) => (
            <div key={n.id} className="card p-4">
              <div className="mb-2 flex items-center justify-between gap-2 text-xs"><Link to={`/lesson/${n.lessonId}/${n.section}`} className="font-medium text-accent hover:underline">#{n.lessonId} {lessonById(n.lessonId)?.title} · {sectionMeta(n.section).icon} {sectionMeta(n.section).title}</Link><span className="flex items-center gap-2 text-faint">{new Date(n.createdAt).toLocaleDateString('uz')}<Button variant="ghost" size="iconSm" aria-label="Eslatmani o'chirish" onClick={async () => { await invoke('notes:delete', n.id); void load() }}><Trash2 size={13} /></Button></span></div>
              <blockquote className="border-l-[3px] border-warn bg-warn/[.07] px-3 py-1.5 text-sm italic text-muted">{n.quote}</blockquote>
              {n.note && <p className="mt-2 whitespace-pre-wrap text-sm">{n.note}</p>}
            </div>
          ))}
        </TabsContent>
        <TabsContent value="bm" className="mt-5 space-y-2">
          {!stats?.bookmarks.length ? <Empty icon={<Bookmark size={24} />} title="Xatcho'plar yo'q" desc="Dars ichida Ctrl+B bosing — bo'lim shu ro'yxatga qo'shiladi." /> : stats.bookmarks.map((b) => (
            <div key={`${b.lessonId}-${b.section}`} className="card flex items-center gap-3 px-4 py-3"><Bookmark size={15} className="fill-accent text-accent" /><Link to={`/lesson/${b.lessonId}/${b.section}`} className="flex-1 text-sm font-medium hover:text-accent">#{b.lessonId} {lessonById(b.lessonId)?.title} <span className="font-normal text-muted">· {sectionMeta(b.section).icon} {sectionMeta(b.section).title}</span></Link><Button variant="ghost" size="iconSm" aria-label="Xatcho'pni olib tashlash" onClick={async () => { await invoke('bookmark:toggle', b); void refreshStats() }}><Trash2 size={13} /></Button></div>
          ))}
        </TabsContent>
      </Tabs>
    </div></div>
  )
}
