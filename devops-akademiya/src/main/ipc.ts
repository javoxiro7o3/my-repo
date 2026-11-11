import { app, BrowserWindow, dialog, ipcMain, shell, nativeTheme } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import type { AiRequest } from '@shared/types'
import { EXTERNAL_HOSTS, type InvokeChannel } from '@shared/ipc'
import { redact } from '@shared/geminiCore'
import { PROMPT_VERSION } from '@shared/prompts'
import { curriculum } from '@shared/curriculum'
import type { Store } from './store'
import { cachedFor, cancelAi, clearKey, hasKey, saveKey, startAi, testKey } from './ai'

const str = (v: unknown, max = 200_000): string => { if (typeof v !== 'string') throw new Error('Matn kutilgan'); return v.slice(0, max) }
const int = (v: unknown): number => { const n = Number(v); if (!Number.isInteger(n)) throw new Error('Butun son kutilgan'); return n }

const PRINT_CSS = `
@page { margin: 16mm 14mm; }
* { box-sizing: border-box; }
body { font-family: "Segoe UI", Inter, system-ui, sans-serif; font-size: 11pt; line-height: 1.55; color: #111; }
h1 { font-size: 20pt; border-bottom: 2px solid #4f46e5; padding-bottom: 6px; } h2 { font-size: 14pt; margin-top: 18px; color: #312e81; } h3 { font-size: 12pt; }
pre { background: #f4f4f8; border: 1px solid #ddd; border-radius: 6px; padding: 8px 10px; font-size: 9pt; white-space: pre-wrap; word-break: break-word; page-break-inside: avoid; }
code { font-family: "JetBrains Mono", Consolas, monospace; font-size: 9.5pt; background: #f1f1f5; padding: 1px 4px; border-radius: 3px; } pre code { background: none; padding: 0; }
table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 10pt; } th, td { border: 1px solid #ccc; padding: 5px 8px; text-align: left; vertical-align: top; } th { background: #eef; }
blockquote { border-left: 3px solid #4f46e5; margin: 8px 0; padding: 2px 12px; color: #333; background: #f7f7ff; }
button, .no-print { display: none !important; } svg { max-width: 100%; height: auto; }
footer { margin-top: 24px; font-size: 8pt; color: #777; border-top: 1px solid #ddd; padding-top: 6px; }`

export function registerIpc(store: Store, getWin: () => BrowserWindow | null) {
  const h = <T>(ch: InvokeChannel, fn: (payload: any, e: Electron.IpcMainInvokeEvent) => T | Promise<T>) =>
    ipcMain.handle(ch, async (e, payload) => {
      // faqat o'z oynamizdan kelgan so'rovlar
      if (e.sender !== getWin()?.webContents) throw new Error('Ruxsat yo\'q')
      try { return await fn(payload, e) } catch (err: any) { throw new Error(redact(String(err?.message ?? err))) }
    })
  const settings = () => ({ ...store.getSettings(), hasKey: hasKey() })

  h('settings:get', () => settings())
  h('settings:set', (p) => { store.setSettings(p ?? {}); return settings() })
  h('key:test', (p) => testKey(str(p?.key, 200).trim(), str(p?.model ?? store.getSettings().model, 80)))
  h('key:set', (p) => { const k = str(p?.key, 200).trim(); if (k.length < 20) throw new Error('Kalit juda qisqa'); const r = saveKey(k); return { ...r, settings: settings() } })
  h('key:clear', () => { clearKey(); return settings() })

  h('ai:start', (p: AiRequest, e) => { void startAi(store, { ...p, id: str(p.id, 80) }, e.sender); return true })
  h('ai:cancel', (p) => cancelAi(str(p, 80)))
  h('ai:cached', (p) => p?.request ? (cachedFor(store, p.request) ?? null) : store.cachedSections(int(p?.lessonId)))
  h('cache:clear', () => store.cacheClear())
  h('usage:get', () => store.usage())

  const reward = (r: ReturnType<Store['markSection']>) => { if (r.xp || r.badges.length) getWin()?.webContents.send('app:reward', r); return r }
  h('progress:mark', (p) => reward(store.markSection(int(p.lessonId), str(p.section, 20))))
  h('progress:last', (p) => store.setLast(int(p.lessonId), str(p.section, 20)))
  h('progress:reset', () => store.resetProgress())
  h('stats:get', () => store.stats())
  h('event:add', (p) => reward(store.event(p.kind === 'lab' ? 'lab' : 'breakfix', str(p.ref, 120))))
  h('quiz:record', (p) => reward(store.recordQuiz(int(p.lessonId), Array.isArray(p.answers) ? p.answers.slice(0, 50) : [])))
  h('quiz:weak', (p) => store.weakTopics(p?.lessonId ? int(p.lessonId) : undefined))
  h('srs:due', (p) => store.dueCards(p?.limit ? int(p.limit) : 30))
  h('srs:review', (p) => reward(store.reviewCard(int(p.id), int(p.q))))
  h('notes:list', (p) => store.notes(p?.lessonId ? int(p.lessonId) : undefined))
  h('notes:add', (p) => store.addNote({ lessonId: int(p.lessonId), section: str(p.section, 20), quote: str(p.quote), note: str(p.note ?? ''), color: p.color }))
  h('notes:update', (p) => store.updateNote(int(p.id), str(p.note)))
  h('notes:delete', (p) => store.deleteNote(int(p)))
  h('bookmark:toggle', (p) => store.toggleBookmark(int(p.lessonId), str(p.section, 20)))
  h('chat:list', (p) => store.chatList(str(p, 80)))
  h('chat:add', (p) => store.chatAdd({ thread: str(p.thread, 80), role: p.role === 'model' ? 'model' : 'user', content: str(p.content) }))
  h('chat:clear', (p) => store.chatClear(str(p, 80)))
  h('search:query', (p) => store.search(str(p, 300)))
  h('project:toggle', (p) => reward(store.toggleTask(int(p.moduleId), int(p.idx), !!p.done)))

  h('export:md', async (p) => {
    const r = await dialog.showSaveDialog(getWin()!, { title: 'Markdown sifatida saqlash', defaultPath: `${str(p.name, 120).replace(/[\\/:*?"<>|]/g, '-')}.md`, filters: [{ name: 'Markdown', extensions: ['md'] }] })
    if (r.canceled || !r.filePath) return false
    writeFileSync(r.filePath, redact(str(p.markdown, 2_000_000)), 'utf8'); return true
  })
  h('export:pdf', async (p) => {
    const title = str(p.title, 200)
    const r = await dialog.showSaveDialog(getWin()!, { title: 'PDF sifatida saqlash', defaultPath: `${title.replace(/[\\/:*?"<>|]/g, '-')}.pdf`, filters: [{ name: 'PDF', extensions: ['pdf'] }] })
    if (r.canceled || !r.filePath) return false
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
    const html = `<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><title>${esc(title)}</title><style>${PRINT_CSS}</style></head><body><h1>${esc(title)}</h1>${redact(str(p.html, 4_000_000))}<footer>DevOps Akademiya · ${new Date().toLocaleDateString('uz')}</footer></body></html>`
    const w = new BrowserWindow({ show: false, webPreferences: { javascript: false, sandbox: true, contextIsolation: true } })
    try {
      await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
      writeFileSync(r.filePath, await w.webContents.printToPDF({ printBackground: true, pageSize: 'A4' }))
    } finally { w.destroy() }
    return true
  })
  h('backup:export', async () => {
    const r = await dialog.showSaveDialog(getWin()!, { title: 'Progress zaxira nusxasi', defaultPath: `devops-akademiya-zaxira-${new Date().toISOString().slice(0, 10)}.json`, filters: [{ name: 'JSON', extensions: ['json'] }] })
    if (r.canceled || !r.filePath) return false
    writeFileSync(r.filePath, redact(store.exportBackup()), 'utf8'); return true
  })
  h('backup:import', async () => {
    const r = await dialog.showOpenDialog(getWin()!, { title: 'Zaxiradan tiklash', filters: [{ name: 'JSON', extensions: ['json'] }], properties: ['openFile'] })
    if (r.canceled || !r.filePaths[0]) return false
    store.importBackup(readFileSync(r.filePaths[0], 'utf8')); return true
  })

  h('app:info', () => ({ version: app.getVersion(), electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node, platform: process.platform, promptVersion: PROMPT_VERSION, curriculumVersion: curriculum.version, systemDark: nativeTheme.shouldUseDarkColors }))
  h('app:openExternal', (p) => {
    const u = new URL(str(p, 500))
    if (u.protocol !== 'https:' || !EXTERNAL_HOSTS.some((host) => u.hostname === host || u.hostname.endsWith('.' + host))) throw new Error('Bu havolani ochishga ruxsat yo\'q')
    return shell.openExternal(u.toString())
  })
  h('window:theme', (p) => {
    const w = getWin()
    if (w && process.platform !== 'darwin') { try { w.setTitleBarOverlay({ color: str(p.color, 20), symbolColor: str(p.symbol, 20), height: 40 }) } catch { /* qo'llab-quvvatlanmaydi */ } }
    w?.setBackgroundColor(str(p.color, 20))
  })
}
