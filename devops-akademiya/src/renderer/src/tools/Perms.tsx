import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { Segmented } from '@/components/ui'
import { DOW, describe, expandField, nextRuns } from '@shared/cron'

const WHO = ['Egasi (u)', 'Guruh (g)', 'Boshqalar (o)']
const BITS = [['r', 'o\'qish', 4], ['w', 'yozish', 2], ['x', 'bajarish', 1]] as const

export function modeToString(mode: number, special = 0, dir = false): string {
  let s = dir ? 'd' : '-'
  for (let w = 0; w < 3; w++) {
    const m = (mode >> ((2 - w) * 3)) & 7
    const sp = (special >> (2 - w)) & 1
    s += m & 4 ? 'r' : '-'; s += m & 2 ? 'w' : '-'
    s += sp ? (w === 2 ? (m & 1 ? 't' : 'T') : m & 1 ? 's' : 'S') : m & 1 ? 'x' : '-'
  }
  return s
}

function Chmod() {
  const [mode, setMode] = useState(0o755)
  const [special, setSpecial] = useState(0)
  const [dir, setDir] = useState(false)
  const [umask, setUmask] = useState('022')
  const oct = mode.toString(8).padStart(3, '0')
  const um = parseInt(/^[0-7]{3,4}$/.test(umask) ? umask : '0', 8)
  const meaning = (w: number) => { const m = (mode >> ((2 - w) * 3)) & 7; return dir ? [m & 4 && 'ro\'yxatni ko\'rish (ls)', m & 2 && 'fayl yaratish/o\'chirish', m & 1 && 'ichiga kirish (cd)'].filter(Boolean).join(', ') || 'hech narsa' : [m & 4 && 'o\'qish', m & 2 && 'o\'zgartirish', m & 1 && 'ishga tushirish'].filter(Boolean).join(', ') || 'hech narsa' }
  return (
    <div className="grid gap-5 @4xl:grid-cols-2">
      <div className="card p-6">
        <div className="mb-5 flex items-center justify-between"><Segmented label="Tur" value={dir ? 'd' : 'f'} onChange={(v) => setDir(v === 'd')} options={[{ value: 'f', label: 'Fayl' }, { value: 'd', label: 'Katalog' }]} /><input value={(special ? String(special) : '') + oct} onChange={(e) => { const v = e.target.value.replace(/[^0-7]/g, '').slice(-4); if (v.length >= 3) { setMode(parseInt(v.slice(-3), 8)); setSpecial(v.length === 4 ? +v[0] : 0) } }} className="input w-28 text-center font-mono text-xl font-bold" aria-label="Sakkizlik ruxsat" /></div>
        <div className="grid grid-cols-3 gap-3">{WHO.map((who, w) => (
          <div key={who} className="rounded-xl border bg-elev/50 p-3"><div className="mb-2 text-center text-[13px] font-semibold">{who}</div>
            {BITS.map(([ch, label, val]) => { const bit = val << ((2 - w) * 3), on = !!(mode & bit); return <button key={ch} onClick={() => setMode(mode ^ bit)} aria-pressed={on} className={cn('mb-1.5 flex w-full items-center justify-between rounded-lg border px-3 py-1.5 text-[13px] transition', on ? 'border-accent bg-accent/15' : 'opacity-60 hover:opacity-100')}><span className="font-mono font-bold">{ch}</span><span className="text-xs text-muted">{label}</span><span className="font-mono text-xs">{val}</span></button> })}
            <div className="mt-1 text-center font-mono text-lg font-bold text-accent">{(mode >> ((2 - w) * 3)) & 7}</div>
          </div>
        ))}</div>
        <div className="mt-4 flex gap-2">{[['SUID', 4, 'Fayl egasi huquqi bilan ishga tushadi (masalan /usr/bin/passwd)'], ['SGID', 2, 'Guruh huquqi bilan; katalogda — yangi fayllar katalog guruhini meros oladi'], ['Sticky', 1, 'Katalogda faqat fayl egasi o\'chira oladi (masalan /tmp)']].map(([n, v, d]) => <button key={n as string} title={d as string} onClick={() => setSpecial(special ^ (v as number))} aria-pressed={!!(special & (v as number))} className={cn('flex-1 rounded-lg border px-3 py-2 text-[13px] font-medium transition', special & (v as number) ? 'border-warn bg-warn/15 text-warn' : 'text-muted hover:text-fg')}>{n} ({v})</button>)}</div>
      </div>
      <div className="space-y-5">
        <div className="card p-6">
          <div className="font-mono text-3xl font-bold tracking-wider">{modeToString(mode, special, dir)}</div>
          <code className="mt-3 block rounded-lg border bg-bg px-3 py-2 font-mono text-sm">chmod {special || ''}{oct} {dir ? 'katalog/' : 'fayl'}</code>
          <code className="mt-2 block rounded-lg border bg-bg px-3 py-2 font-mono text-sm">chmod u={['r', 'w', 'x'].filter((_, k) => (mode >> 6) & (4 >> k)).join('')},g={['r', 'w', 'x'].filter((_, k) => (mode >> 3) & (4 >> k)).join('')},o={['r', 'w', 'x'].filter((_, k) => mode & (4 >> k)).join('')} {dir ? 'katalog/' : 'fayl'}</code>
          <ul className="mt-4 space-y-1.5 text-[13.5px]">{WHO.map((w, k) => <li key={w}><b>{w}:</b> <span className="text-muted">{meaning(k)}</span></li>)}</ul>
          {!dir && mode & 0o002 ? <p className="mt-3 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-[13px] text-bad">⚠️ Hamma yoza oladigan fayl — xavfli. 777 deyarli hech qachon to'g'ri yechim emas.</p> : null}
          {dir && <p className="mt-3 text-[12.5px] leading-relaxed text-muted">Katalogda <b>x</b> — "ichidan o'tish" huquqi. r bor, x yo'q bo'lsa: nomlarni ko'rasiz, lekin fayllarga yeta olmaysiz. Faylni o'chirish huquqi faylning emas, <b>katalogning w</b> bitiga bog'liq.</p>}
        </div>
        <div className="card p-6">
          <div className="mb-3 flex items-center gap-3"><span className="text-sm font-medium">umask</span><input value={umask} onChange={(e) => setUmask(e.target.value)} className="input w-24 text-center font-mono" aria-label="umask" /></div>
          <div className="grid grid-cols-2 gap-3 font-mono text-sm"><div className="rounded-lg border bg-elev/50 p-3"><div className="font-sans text-xs text-muted">Yangi fayl: 666 & ~{umask}</div><div className="mt-1 text-lg font-bold">{(0o666 & ~um).toString(8).padStart(3, '0')} <span className="text-sm font-normal text-muted">{modeToString(0o666 & ~um)}</span></div></div><div className="rounded-lg border bg-elev/50 p-3"><div className="font-sans text-xs text-muted">Yangi katalog: 777 & ~{umask}</div><div className="mt-1 text-lg font-bold">{(0o777 & ~um).toString(8).padStart(3, '0')} <span className="text-sm font-normal text-muted">{modeToString(0o777 & ~um, 0, true)}</span></div></div></div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-muted">umask ayirish emas, <b>bitli niqob</b>: natija = asos AND NOT umask. Fayllar uchun asos 666 (x hech qachon avtomatik berilmaydi).</p>
        </div>
      </div>
    </div>
  )
}

function Cron() {
  const [expr, setExpr] = useState('*/15 9-18 * * 1-5')
  const r = useMemo(() => { try { return { runs: nextRuns(expr, new Date()), text: describe(expr) } } catch (e: any) { return { err: e.message as string } } }, [expr])
  const f = expr.trim().split(/\s+/)
  return (
    <div className="grid gap-5 @4xl:grid-cols-2">
      <div className="card p-6">
        <input value={expr} onChange={(e) => setExpr(e.target.value)} className="input text-center font-mono text-2xl font-bold tracking-widest" aria-label="Cron ifodasi" spellCheck={false} />
        <div className="mt-3 grid grid-cols-5 gap-2 text-center">{[['daqiqa', '0–59'], ['soat', '0–23'], ['oy kuni', '1–31'], ['oy', '1–12'], ['hafta kuni', '0–6 (0=yak)']].map(([n, rng], k) => <div key={n} className="rounded-lg border bg-elev/50 px-1 py-2"><div className="font-mono text-base font-bold text-accent">{f[k] ?? '?'}</div><div className="text-[11.5px] font-medium">{n}</div><div className="text-[10px] text-faint">{rng}</div></div>)}</div>
        <div className="mt-4 flex flex-wrap gap-1.5">{[['0 3 * * *', 'har kuni 03:00'], ['*/5 * * * *', 'har 5 daqiqada'], ['0 9 * * 1-5', 'ish kunlari 09:00'], ['30 2 1 * *', 'har oyning 1-kuni 02:30'], ['0 */6 * * *', 'har 6 soatda'], ['0 0 * * 0', 'har yakshanba yarim tunda']].map(([e, l]) => <button key={e} onClick={() => setExpr(e)} className="chip hover:border-accent hover:text-fg"><span className="font-mono">{e}</span> — {l}</button>)}</div>
        <table className="mt-5 w-full text-[13px]"><tbody className="divide-y">{[['*', 'har qanday qiymat'], ['*/n', 'har n birlikda'], ['a-b', 'oraliq'], ['a,b,c', 'ro\'yxat'], ['a-b/n', 'oraliqda har n']].map(([k, v]) => <tr key={k}><td className="w-20 py-1.5 font-mono text-accent">{k}</td><td className="py-1.5 text-muted">{v}</td></tr>)}</tbody></table>
      </div>
      <div className="card p-6">
        {'err' in r ? <p className="text-sm text-bad" role="alert">{r.err}</p> : <>
          <div className="label mb-1">Ma'nosi</div><p className="text-[15px] font-medium leading-relaxed">{r.text}</p>
          <div className="label mb-2 mt-5">Keyingi 5 ta ishga tushish</div>
          <ol className="space-y-1.5">{r.runs!.map((d, k) => <li key={k} className="flex items-center gap-3 rounded-lg border bg-elev/50 px-3 py-2 font-mono text-[13px]"><span className="text-faint">{k + 1}.</span>{d.toLocaleDateString('uz')} {d.toTimeString().slice(0, 5)} <span className="ml-auto font-sans text-xs text-muted">{DOW[d.getDay()]}</span></li>)}</ol>
          <code className="mt-5 block overflow-x-auto whitespace-pre rounded-lg border bg-bg px-3 py-2 font-mono text-[12.5px]">{`# crontab -e\nPATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin\n${expr} /opt/scripts/vazifa.sh >> /var/log/vazifa.log 2>&1`}</code>
          <p className="mt-3 text-[12.5px] leading-relaxed text-muted">Esda tuting: cron minimal muhitda ishlaydi (PATH qisqa, .bashrc o'qilmaydi) — to'liq yo'llarni yozing va chiqishni logga yo'naltiring. Vaqt server vaqt zonasida.</p>
        </>}
      </div>
    </div>
  )
}

export default function Perms() {
  const [tab, setTab] = useState<'chmod' | 'cron'>('chmod')
  return <div className="space-y-5"><Segmented label="Vosita" value={tab} onChange={setTab} options={[{ value: 'chmod', label: 'chmod / umask kalkulyatori' }, { value: 'cron', label: 'Cron ifoda tuzuvchi' }]} />{tab === 'chmod' ? <Chmod /> : <Cron />}</div>
}
