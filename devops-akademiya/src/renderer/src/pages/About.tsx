import { useEffect, useState } from 'react'
import { Heart, ShieldCheck } from 'lucide-react'
import { LESSONS, MODULES } from '@shared/curriculum'
import { invoke } from '@/lib/api'
import Logo from '@/components/Logo'
import { TOOLS } from '@/tools/registry'

export default function About() {
  const [info, setInfo] = useState<any>(null)
  useEffect(() => { invoke('app:info').then(setInfo) }, [])
  return (
    <div className="h-full overflow-y-auto"><div className="mx-auto max-w-2xl p-8">
      <div className="card overflow-hidden">
        <div className="flex flex-col items-center gap-3 bg-gradient-to-br from-accent/20 via-transparent to-info/15 px-8 py-10 text-center">
          <Logo size={84} />
          <h1 className="text-2xl font-semibold tracking-tight">DevOps Akademiya</h1>
          <p className="max-w-md text-sm leading-relaxed text-muted">O'zbek tilidagi chuqur DevOps o'quv dasturi. Avval «nega», keyin «ichida qanday ishlaydi», keyin «qanday ishlatiladi», oxirida «qanday buziladi va tuzatiladi».</p>
          <span className="chip font-mono">v{info?.version ?? '…'}</span>
        </div>
        <div className="grid grid-cols-4 divide-x border-y text-center">{[[MODULES.length, 'modul'], [LESSONS.length, 'dars'], [LESSONS.filter((l) => l.premium).length, 'tayyor oflayn dars'], [TOOLS.length, 'interaktiv vosita']].map(([n, l]) => <div key={l as string} className="py-4"><div className="text-2xl font-semibold tabular-nums">{n}</div><div className="text-xs text-muted">{l}</div></div>)}</div>
        <dl className="divide-y px-8 py-2 text-sm">{[['Kurikulum versiyasi', info?.curriculumVersion], ['Prompt versiyasi', info?.promptVersion], ['Electron', info?.electron], ['Chromium', info?.chrome], ['Node.js', info?.node], ['Platforma', info?.platform]].map(([k, v]) => <div key={k} className="flex justify-between py-2.5"><dt className="text-muted">{k}</dt><dd className="font-mono text-[13px]">{v ?? '…'}</dd></div>)}</dl>
        <div className="border-t bg-elev/40 px-8 py-5 text-[13px] leading-relaxed text-muted">
          <p className="flex items-start gap-2"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-ok" /><span><b className="text-fg">Maxfiylik:</b> barcha ma'lumotlaringiz (progress, eslatmalar, chat) faqat shu kompyuterdagi SQLite bazada saqlanadi. API kalit operatsion tizim shifrlashi bilan himoyalangan. Tashqariga faqat siz yuborgan AI so'rovlari (Google Gemini API ga) chiqadi.</span></p>
          <p className="mt-3 flex items-start gap-2"><Heart size={16} className="mt-0.5 shrink-0 text-bad" /><span>Texnologiyalar: Electron, React, TypeScript, Vite, Tailwind CSS, Radix UI, Framer Motion, Monaco Editor, xterm.js, Mermaid, SQLite (better-sqlite3). Shriftlar: Inter va JetBrains Mono (SIL OFL). Litsenziya: MIT.</span></p>
        </div>
      </div>
    </div></div>
  )
}
