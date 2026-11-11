import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Hammer, RotateCcw, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'

const PRESETS: Record<string, string> = {
  'Yomon tartib': 'FROM node:22-alpine\nWORKDIR /app\nCOPY . .\nRUN npm ci\nRUN npm run build\nEXPOSE 3000\nCMD ["node", "dist/server.js"]',
  'Yaxshi tartib': 'FROM node:22-alpine\nWORKDIR /app\nCOPY package.json package-lock.json ./\nRUN npm ci\nCOPY . .\nRUN npm run build\nEXPOSE 3000\nCMD ["node", "dist/server.js"]',
  'Multi-stage': 'FROM node:22-alpine AS build\nWORKDIR /app\nCOPY package.json package-lock.json ./\nRUN npm ci\nCOPY . .\nRUN npm run build\n\nFROM node:22-alpine\nWORKDIR /app\nENV NODE_ENV=production\nCOPY package.json package-lock.json ./\nRUN npm ci --omit=dev\nCOPY --from=build /app/dist ./dist\nUSER node\nCMD ["node", "dist/server.js"]',
  'apt keshi xatosi': 'FROM ubuntu:24.04\nRUN apt-get update\nRUN apt-get install -y curl\nCOPY app.sh /usr/local/bin/app.sh\nRUN apt-get install -y nginx\nCMD ["nginx", "-g", "daemon off;"]'
}
const FILES = [{ id: 'src', label: 'src/ (ilova kodi)', hint: 'eng tez-tez o\'zgaradi' }, { id: 'pkg', label: 'package.json / lock', hint: 'bog\'liqlik qo\'shilganda' }, { id: 'other', label: 'README, app.sh va boshqalar', hint: '' }]

interface Layer { line: string; instr: string; arg: string; key: string; cost: number; size: number; meta: boolean; stage: number; inputs: string[] }
/** Dockerfile ni tahlil qilib, har bir instruksiya uchun kesh kalitini hisoblaydi */
export function analyze(src: string, ver: Record<string, number>): Layer[] {
  const out: Layer[] = []; let parent = '', stage = -1
  for (const raw of src.split('\n')) {
    const line = raw.trim(); if (!line || line.startsWith('#')) continue
    const [instr, ...rest] = line.split(/\s+/); const I = instr.toUpperCase(), arg = rest.join(' ')
    let inputs: string[] = [], cost = 0.1, size = 0, meta = true
    if (I === 'FROM') { stage++; parent = ''; cost = 0.3; size = /alpine/.test(arg) ? 55 : /ubuntu|debian/.test(arg) ? 78 : /scratch/.test(arg) ? 0 : 120; meta = false }
    else if (I === 'COPY' || I === 'ADD') {
      meta = false; cost = 0.4
      if (/--from=/.test(arg)) { inputs = ['src', 'pkg']; size = 4 } // oldingi bosqich natijasi
      else if (/^\.\s/.test(arg) || /\s\.\/?\s+\.\/?$/.test(' ' + arg)) { inputs = ['src', 'pkg', 'other']; size = 12 }
      else { if (/package|requirements|go\.(mod|sum)|pom\.xml|lock/.test(arg)) inputs.push('pkg'); if (/src|app\/|\.py|\.js|\.go/.test(arg) && !/app\.sh/.test(arg)) inputs.push('src'); if (!inputs.length) inputs = ['other']; size = inputs.includes('src') ? 8 : 1 }
    } else if (I === 'RUN') {
      meta = false
      if (/npm (ci|install)|pip install|go mod download|mvn|bundle install|composer install/.test(arg)) { cost = /--omit=dev|--production/.test(arg) ? 18 : 42; size = /--omit=dev|--production/.test(arg) ? 60 : 180 }
      else if (/apt-get install|apk add|yum install/.test(arg)) { cost = 25; size = 90 } else if (/apt-get update|apk update/.test(arg)) { cost = 8; size = 40 }
      else if (/build|compile|tsc|webpack|vite/.test(arg)) { cost = 30; size = 25 } else { cost = 3; size = 2 }
    }
    // Kesh kaliti = ota qatlam kaliti + instruksiya matni + (COPY/ADD uchun) fayllar checksum i
    const key = `${parent}|${I} ${arg}|${inputs.map((i) => `${i}@${ver[i]}`).join(',')}`
    out.push({ line, instr: I, arg, key, cost, size, meta, stage, inputs }); parent = key
  }
  return out
}

export default function Layers() {
  const [src, setSrc] = useState(PRESETS['Yomon tartib'])
  const [ver, setVer] = useState<Record<string, number>>({ src: 1, pkg: 1, other: 1 })
  const [cache, setCache] = useState<Set<string>>(new Set())
  const [built, setBuilt] = useState<{ layers: (Layer & { hit: boolean })[]; time: number; n: number } | null>(null)
  const [history, setHistory] = useState<{ n: number; time: number; hits: number; total: number; what: string }[]>([])
  const [pending, setPending] = useState('birinchi build')
  const layers = useMemo(() => analyze(src, ver), [src, ver])
  const build = () => {
    const res = layers.map((l) => ({ ...l, hit: cache.has(l.key) }))
    const time = res.reduce((a, l) => a + (l.hit ? 0 : l.cost), 0)
    setCache(new Set([...cache, ...layers.map((l) => l.key)]))
    const n = (built?.n ?? 0) + 1
    setBuilt({ layers: res, time, n }); setHistory((h) => [...h.slice(-5), { n, time, hits: res.filter((l) => l.hit).length, total: res.length, what: pending }]); setPending('o\'zgarishsiz')
  }
  const change = (id: string) => { setVer({ ...ver, [id]: ver[id] + 1 }); setPending(`${FILES.find((f) => f.id === id)!.label} o'zgardi`) }
  const lastStage = Math.max(0, ...layers.map((l) => l.stage))
  const finalSize = layers.filter((l) => l.stage === lastStage).reduce((a, l) => a + l.size, 0)
  const firstMiss = built?.layers.findIndex((l) => !l.hit) ?? -1
  return (
    <div className="grid gap-5 @5xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">{Object.keys(PRESETS).map((p) => <button key={p} onClick={() => { setSrc(PRESETS[p]); setPending('Dockerfile o\'zgardi') }} className={cn('chip hover:border-accent hover:text-fg', src === PRESETS[p] && '!border-accent !text-fg')}>{p}</button>)}</div>
        <textarea value={src} onChange={(e) => { setSrc(e.target.value); setPending('Dockerfile o\'zgardi') }} rows={14} spellCheck={false} className="input resize-y font-mono text-[13px] leading-relaxed" aria-label="Dockerfile" />
        <div className="card p-4"><div className="label mb-2">Manba fayllarni "o'zgartirish"</div><div className="grid gap-2">{FILES.map((f) => <button key={f.id} onClick={() => change(f.id)} className="flex items-center justify-between rounded-lg border bg-elev/50 px-3 py-2 text-left text-[13px] transition hover:border-accent"><span>✏️ {f.label} <span className="text-xs text-faint">{f.hint}</span></span><span className="font-mono text-xs text-muted">v{ver[f.id]}</span></button>)}</div></div>
        <div className="flex items-center gap-2"><Button variant="primary" size="lg" onClick={build}><Hammer size={16} /> docker build</Button><Button variant="ghost" onClick={() => { setCache(new Set()); setBuilt(null); setHistory([]); setPending('birinchi build') }}><RotateCcw size={14} /> Keshni tozalash (--no-cache)</Button><span className="text-xs text-faint">Keyingi build: {pending}</span></div>
      </div>
      <div className="space-y-4">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b bg-elev/60 px-4 py-2 text-[13px]"><span className="font-medium">{built ? `Build #${built.n}` : 'Qatlamlar (hali build qilinmagan)'}</span>{built && <span className="font-mono tabular-nums">{built.time.toFixed(1)} s · yakuniy image ≈ {finalSize} MB</span>}</div>
          <ol>
            <AnimatePresence initial={false}>
              {(built?.layers ?? layers.map((l) => ({ ...l, hit: false }))).map((l, i) => { const state = !built ? 'idle' : l.hit ? 'hit' : 'miss'; return (
                <motion.li key={`${built?.n}-${i}`} initial={built ? { opacity: 0, x: 20 } : false} animate={{ opacity: 1, x: 0 }} transition={{ delay: built ? i * 0.07 : 0 }} className={cn('flex items-center gap-3 border-b px-4 py-2 last:border-0', state === 'miss' && 'bg-bad/[.07]', state === 'hit' && 'bg-ok/[.05]', i === firstMiss && 'ring-1 ring-inset ring-bad/50')}>
                  <span className="w-5 text-center font-mono text-[11px] text-faint">{i + 1}</span>
                  <span className={cn('w-[86px] shrink-0 rounded px-1.5 py-0.5 text-center font-mono text-[10.5px] font-bold', state === 'hit' ? 'bg-ok/20 text-ok' : state === 'miss' ? 'bg-bad/20 text-bad' : 'bg-elev text-faint')}>{state === 'hit' ? 'CACHED' : state === 'miss' ? 'BUILD' : '—'}</span>
                  <code className="min-w-0 flex-1 truncate font-mono text-[12.5px]"><b className="text-accent">{l.instr}</b> {l.arg}</code>
                  {l.stage < lastStage && <span className="chip !py-0 text-[10px]">bosqich {l.stage}</span>}
                  <span className="w-14 text-right font-mono text-[11px] tabular-nums text-muted">{state === 'hit' ? '0.0 s' : `${l.cost.toFixed(1)} s`}</span>
                </motion.li>
              ) })}
            </AnimatePresence>
          </ol>
        </div>
        {built && firstMiss >= 0 && built.n > 1 && <div className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-[13px] leading-relaxed"><Zap size={13} className="mr-1 inline text-warn" /><b>Kesh {firstMiss + 1}-qatlamda buzildi</b> (<code className="font-mono">{built.layers[firstMiss].instr}</code>) — va undan keyingi <b>barcha</b> qatlamlar qayta qurildi. Sabab: har bir qatlam kaliti ota qatlam kalitini o'z ichiga oladi (zanjir). {built.layers[firstMiss].instr === 'COPY' && built.layers.slice(firstMiss).some((l) => /npm ci|pip install/.test(l.arg)) ? 'Bog\'liqliklar o\'rnatilishi COPY . . dan KEYIN turgani uchun har kod o\'zgarishida qayta ishlayapti — avval faqat package fayllarni nusxalang.' : ''}</div>}
        {built && firstMiss < 0 && <div className="rounded-xl border border-ok/40 bg-ok/10 px-4 py-3 text-[13px]">✓ Hamma qatlam keshdan olindi — hech narsa o'zgarmagan.</div>}
        {history.length > 0 && <div className="card p-4"><div className="label mb-3">Build tarixi</div><div className="space-y-2">{history.map((h) => <div key={h.n} className="flex items-center gap-3 text-[12.5px]"><span className="w-8 font-mono text-faint">#{h.n}</span><div className="h-5 flex-1 overflow-hidden rounded bg-elev"><motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(1.5, (h.time / Math.max(...history.map((x) => x.time), 1)) * 100)}%` }} className={cn('h-full', h.time > 30 ? 'bg-bad/70' : h.time > 5 ? 'bg-warn/70' : 'bg-ok/70')} /></div><span className="w-16 text-right font-mono tabular-nums">{h.time.toFixed(1)} s</span><span className="w-12 text-right font-mono text-faint">{h.hits}/{h.total}</span><span className="w-52 truncate text-muted">{h.what}</span></div>)}</div></div>}
        <div className="card p-4 text-[13px] leading-relaxed text-muted"><b className="text-fg">Kesh qoidalari:</b> RUN uchun — instruksiya <i>matni</i> solishtiriladi (shuning uchun alohida turgan <code className="font-mono">apt-get update</code> eskirib qoladi: uni install bilan bitta RUN ga qo'shing). COPY/ADD uchun — fayllar <i>checksum</i> i. Bitta qatlam mos kelmasa, undan keyingi hammasi qayta quriladi. Shuning uchun: <b className="text-fg">kam o'zgaradigan narsa yuqorida, ko'p o'zgaradigani pastda.</b></div>
      </div>
    </div>
  )
}
