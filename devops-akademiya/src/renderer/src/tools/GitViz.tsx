import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { GitBranch, GitCommit, GitMerge, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'

interface Commit { id: string; parents: string[]; msg: string; lane: number; order: number }
interface Repo { commits: Record<string, Commit>; branches: Record<string, string>; head: string; detached?: string; n: number; log: string[]; lanes: Record<string, number> }
const hash = (n: number) => ((n * 2654435761) >>> 0).toString(16).padStart(7, '0').slice(0, 7)
const init = (): Repo => { const id = hash(1); return { commits: { [id]: { id, parents: [], msg: 'Boshlang\'ich commit', lane: 0, order: 0 } }, branches: { main: id }, head: 'main', n: 1, log: ['git init → main branch, birinchi commit'], lanes: { main: 0 } } }
const tip = (r: Repo) => r.detached ?? r.branches[r.head]
const ancestors = (r: Repo, id: string): Set<string> => { const s = new Set<string>(), st = [id]; while (st.length) { const x = st.pop()!; if (s.has(x)) continue; s.add(x); st.push(...r.commits[x].parents) } return s }
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#a855f7']

export function gitExec(r0: Repo, line: string): Repo {
  const r: Repo = structuredClone(r0)
  const a = line.trim().replace(/^git\s+/, '').split(/\s+/)
  const say = (s: string) => { r.log.push(`$ git ${a.join(' ')}`, '  ' + s) }
  const add = (parents: string[], msg: string, lane: number) => { r.n++; const id = hash(r.n); r.commits[id] = { id, parents, msg, lane, order: Object.keys(r.commits).length }; return id }
  const lane = () => (r.detached ? 0 : r.lanes[r.head] ?? 0)
  const move = (id: string) => { if (r.detached) r.detached = id; else r.branches[r.head] = id }
  switch (a[0]) {
    case 'commit': { const m = line.match(/-m\s+["'](.+?)["']/)?.[1] ?? `${r.detached ? 'detached' : r.head}: o'zgarish #${r.n}`; const id = add([tip(r)], m, lane()); move(id); say(`[${r.detached ? 'detached HEAD' : r.head} ${id}] ${m}${r.detached ? '  ⚠ bu commit hech bir branch ga tegishli emas!' : ''}`); break }
    case 'branch': { if (!a[1]) { say(Object.keys(r.branches).map((b) => (b === r.head && !r.detached ? '* ' : '  ') + b).join(' ')); break } if (a[1] === '-d' || a[1] === '-D') { if (a[2] === r.head) { say(`xato: joriy branch ni o'chirib bo'lmaydi`); break } if (!r.branches[a[2]]) { say(`xato: '${a[2]}' branch topilmadi`); break } delete r.branches[a[2]]; say(`${a[2]} branch o'chirildi (commitlar joyida — faqat ko'rsatkich yo'qoldi)`); break } if (r.branches[a[1]]) { say(`fatal: '${a[1]}' nomli branch allaqachon bor`); break } r.branches[a[1]] = tip(r); r.lanes[a[1]] = Math.max(...Object.values(r.lanes)) + 1; say(`Yangi ko'rsatkich '${a[1]}' → ${tip(r)} (hech narsa nusxalanmadi!)`); break }
    case 'checkout': case 'switch': { let name = a[1]; if (name === '-b' || name === '-c') { name = a[2]; if (!name || r.branches[name]) { say('fatal: branch nomi noto\'g\'ri yoki mavjud'); break } r.branches[name] = tip(r); r.lanes[name] = Math.max(...Object.values(r.lanes)) + 1 } if (r.branches[name]) { r.head = name; delete r.detached; say(`'${name}' branch ga o'tildi (HEAD → ${name})`) } else if (r.commits[name]) { r.detached = name; say(`HEAD endi ${name} da — "detached HEAD" holati`) } else say(`error: '${name}' topilmadi`); break }
    case 'merge': { const other = r.branches[a[1]]; if (!other) { say(`merge: '${a[1]}' topilmadi`); break } const mine = tip(r); if (ancestors(r, mine).has(other)) { say('Already up to date.'); break } if (ancestors(r, other).has(mine) && !a.includes('--no-ff')) { move(other); say(`Fast-forward: ko'rsatkich shunchaki ${other} ga surildi — merge commit yo'q`); break } const id = add([mine, other], `Merge branch '${a[1]}'`, lane()); move(id); say(`Three-way merge: ikki ota-onali ${id} merge commit yaratildi`); break }
    case 'rebase': { const onto = r.branches[a[1]]; if (!onto || r.detached) { say('rebase: branch topilmadi'); break } const base = ancestors(r, onto); const mine: Commit[] = []; let c = r.commits[tip(r)]; while (c && !base.has(c.id)) { mine.unshift(c); c = r.commits[c.parents[0]] } if (!mine.length) { say('Current branch is up to date.'); break } let parent = onto; for (const m of mine) parent = add([parent], m.msg, lane()); r.branches[r.head] = parent; say(`${mine.length} ta commit ${a[1]} ustiga QAYTA YOZILDI — yangi hash lar! Eski commitlar (${mine.map((m) => m.id).join(', ')}) endi yetim.`); break }
    case 'reset': { const hard = a.includes('--hard'); const t = a.find((x) => /^HEAD~\d*$/.test(x)); const n = t ? +(t.split('~')[1] || 1) : 1; let id = tip(r); for (let i = 0; i < n && r.commits[id].parents[0]; i++) id = r.commits[id].parents[0]; move(id); say(`${r.head} ko'rsatkichi ${id} ga qaytarildi (${hard ? '--hard: ishchi katalog ham tozalandi' : '--mixed: o\'zgarishlar ishchi katalogda qoldi'}). Commitlar reflog da 90 kun turadi.`); break }
    case 'revert': { const id = add([tip(r)], `Revert "${r.commits[tip(r)].msg}"`, lane()); move(id); say(`${id}: teskari o'zgarishli YANGI commit — tarix qayta yozilmadi (public branch uchun xavfsiz)`); break }
    case 'tag': { say(`tag '${a[1] ?? 'v1.0.0'}' → ${tip(r)} (branch dan farqi: hech qachon siljimaydi)`); break }
    default: say(`'${a[0]}' bu vizualizatorda yo'q. Mavjud: commit, branch, checkout/switch [-b], merge [--no-ff], rebase, reset [--hard] HEAD~N, revert`)
  }
  return r
}

export default function GitViz() {
  const [repo, setRepo] = useState<Repo>(init)
  const [cmd, setCmd] = useState('')
  const run = (c: string) => setRepo((r) => gitExec(r, c))
  const reach = useMemo(() => { const s = new Set<string>(); for (const b of Object.values(repo.branches)) ancestors(repo, b).forEach((x) => s.add(x)); if (repo.detached) ancestors(repo, repo.detached).forEach((x) => s.add(x)); return s }, [repo])
  const list = Object.values(repo.commits).sort((a, b) => a.order - b.order)
  const X = (c: Commit) => 60 + c.order * 92, Y = (c: Commit) => 50 + c.lane * 64
  const W = Math.max(700, 140 + list.length * 92), H = 100 + Math.max(...list.map((c) => c.lane)) * 64 + 40
  const scenario = (cmds: string[]) => setRepo(cmds.reduce((r, c) => gitExec(r, c), init()))
  const others = Object.keys(repo.branches).filter((b) => b !== repo.head)
  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <Button size="sm" variant="primary" onClick={() => run('commit')}><GitCommit size={14} /> commit</Button>
        <Button size="sm" onClick={() => run(`checkout -b feature${Object.keys(repo.branches).length}`)}><GitBranch size={14} /> yangi branch</Button>
        {Object.keys(repo.branches).map((b) => <Button key={b} size="sm" variant={b === repo.head && !repo.detached ? 'ok' : 'ghost'} onClick={() => run(`checkout ${b}`)}>⇄ {b}</Button>)}
        <span className="mx-1 h-5 w-px bg-border" />
        {others.map((b) => <span key={b} className="flex gap-1"><Button size="sm" onClick={() => run(`merge ${b}`)}><GitMerge size={14} /> merge {b}</Button><Button size="sm" onClick={() => run(`rebase ${b}`)}>rebase {b}</Button></span>)}
        <Button size="sm" variant="ghost" onClick={() => run('reset --hard HEAD~1')}>reset HEAD~1</Button><Button size="sm" variant="ghost" onClick={() => run('revert HEAD')}>revert</Button>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setRepo(init())}><RotateCcw size={13} /> Boshidan</Button>
      </div>
      <div className="flex flex-wrap gap-2 text-xs"><span className="py-1 text-faint">Tayyor ssenariylar:</span>
        {([['Merge (three-way)', ['commit', 'checkout -b feature', 'commit', 'commit', 'checkout main', 'commit', 'merge feature']], ['Rebase', ['commit', 'checkout -b feature', 'commit', 'commit', 'checkout main', 'commit', 'checkout feature', 'rebase main']], ['Fast-forward', ['commit', 'checkout -b fix', 'commit', 'commit', 'checkout main', 'merge fix']], ['Detached HEAD tuzog\'i', ['commit', 'commit', `checkout ${hash(2)}`, 'commit', 'checkout main']], ['reset vs revert', ['commit', 'commit', 'commit', 'reset --hard HEAD~2', 'commit', 'revert HEAD']]] as [string, string[]][]).map(([n, c]) => <button key={n} onClick={() => scenario(c)} className="chip hover:border-accent hover:text-fg">{n}</button>)}
      </div>
      <div className="card overflow-x-auto p-2">
        <svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: W, height: H }} role="img" aria-label="Commit grafi">
          {list.flatMap((c) => c.parents.map((p) => { const pc = repo.commits[p]; return <motion.path key={c.id + p} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} d={`M${X(pc)} ${Y(pc)} C ${X(pc) + 46} ${Y(pc)}, ${X(c) - 46} ${Y(c)}, ${X(c)} ${Y(c)}`} fill="none" stroke={reach.has(c.id) ? COLORS[c.lane % 6] : 'hsl(var(--border))'} strokeWidth="3" strokeDasharray={reach.has(c.id) ? '' : '4 4'} /> }))}
          {list.map((c) => { const orphan = !reach.has(c.id); const labels = [...Object.entries(repo.branches).filter(([, v]) => v === c.id).map(([b]) => b)]; const isHead = tip(repo) === c.id; return (
            <motion.g key={c.id} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: orphan ? 0.4 : 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} style={{ transformOrigin: `${X(c)}px ${Y(c)}px` }}>
              <circle cx={X(c)} cy={Y(c)} r={c.parents.length > 1 ? 13 : 16} fill={orphan ? 'hsl(var(--elev))' : COLORS[c.lane % 6]} stroke={isHead ? 'hsl(var(--fg))' : 'none'} strokeWidth="3" />
              <text x={X(c)} y={Y(c) + 32} textAnchor="middle" fontSize="10.5" fontFamily="JetBrains Mono" fill="hsl(var(--muted))">{c.id}</text><title>{c.msg}</title>
              {labels.map((b, i) => <g key={b}><rect x={X(c) - 34} y={Y(c) - 42 - i * 20} width={68} height={17} rx={5} fill={b === repo.head && !repo.detached ? 'hsl(var(--ok))' : 'hsl(var(--elev))'} stroke="hsl(var(--border))" /><text x={X(c)} y={Y(c) - 30 - i * 20} textAnchor="middle" fontSize="10.5" fontWeight="700" fill={b === repo.head && !repo.detached ? 'hsl(var(--bg))' : 'hsl(var(--fg))'}>{b === repo.head && !repo.detached ? 'HEAD→' : ''}{b.slice(0, 8)}</text></g>)}
              {repo.detached === c.id && <g><rect x={X(c) - 30} y={Y(c) - 42} width={60} height={17} rx={5} fill="hsl(var(--warn))" /><text x={X(c)} y={Y(c) - 30} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#111">HEAD</text></g>}
            </motion.g>
          ) })}
        </svg>
      </div>
      <div className="grid gap-4 @4xl:grid-cols-2">
        <div className="card p-3">
          <form onSubmit={(e) => { e.preventDefault(); if (cmd.trim()) { run(cmd); setCmd('') } }} className="mb-2 flex items-center gap-2 font-mono text-sm"><span className="text-ok">$ git</span><input value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder='commit -m "xabar" | merge feature | rebase main …' className="input !py-1.5 font-mono text-[13px]" aria-label="Git buyrug'i" /></form>
          <pre className="h-44 overflow-y-auto whitespace-pre-wrap rounded-lg bg-bg p-3 font-mono text-[12px] leading-relaxed text-muted" aria-live="polite">{repo.log.slice(-14).join('\n')}</pre>
        </div>
        <div className="card space-y-2 p-4 text-[13px] leading-relaxed text-muted">
          <p><b className="text-fg">Branch — bu ko'rsatkich.</b> .git/refs/heads/main ichida bitta commit hash i yozilgan, xolos. Yangi branch = 41 baytli yangi fayl.</p>
          <p><b className="text-fg">Merge</b> tarixni saqlaydi (ikki ota-onali commit). <b className="text-fg">Rebase</b> commitlarni qayta yaratadi — tarix chiziqli, lekin hash lar o'zgaradi. Shuning uchun: <span className="text-warn">boshqalar tortib olgan branch ni rebase qilmang.</span></p>
          <p className={cn(list.some((c) => !reach.has(c.id)) && 'text-warn')}>Xira, uzuq chiziqli commitlar — <b>yetim</b>: hech bir branch ularga yetmaydi. Ular reflog orqali topiladi (git reflog), keyin gc tozalaydi.</p>
        </div>
      </div>
    </div>
  )
}
