import { app, BrowserWindow, Menu, screen, session, shell } from 'electron'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { curriculum, LESSONS } from '@shared/curriculum'
import { allPremium } from '@shared/premium'
import { PROMPT_VERSION } from '@shared/prompts'
import { sectionMeta } from '@shared/sections'
import { EXTERNAL_HOSTS } from '@shared/ipc'
import { Store } from './store'
import { registerIpc } from './ipc'

if (process.env.DA_USER_DATA) app.setPath('userData', process.env.DA_USER_DATA)
const isDev = !app.isPackaged && !!process.env.ELECTRON_RENDERER_URL

let win: BrowserWindow | null = null
let splash: BrowserWindow | null = null
let store: Store

const SPLASH = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;background:transparent;font-family:"Segoe UI",system-ui,sans-serif;overflow:hidden}
.c{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:linear-gradient(145deg,#0f1220,#161a2e 60%,#1c1740);border-radius:18px;border:1px solid #2b2f4a;color:#e8eaf6}
svg{width:84px;height:84px;filter:drop-shadow(0 8px 24px #6366f188)}
h1{margin:0;font-size:21px;font-weight:650;letter-spacing:-.01em} p{margin:0;font-size:12.5px;color:#9aa0c0}
.b{width:150px;height:3px;border-radius:3px;background:#262a44;overflow:hidden;margin-top:6px}.b i{display:block;width:40%;height:100%;background:linear-gradient(90deg,#6366f1,#22d3ee);border-radius:3px;animation:m 1.1s ease-in-out infinite}
@keyframes m{0%{transform:translateX(-100%)}100%{transform:translateX(350%)}} .r{animation:s 6s linear infinite;transform-origin:50% 50%}@keyframes s{to{transform:rotate(360deg)}}
</style></head><body><div class="c">
<svg viewBox="0 0 128 128"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs><rect x="8" y="8" width="112" height="112" rx="28" fill="#12152a" stroke="url(#g)" stroke-width="3"/><path d="M34 64c0-11 8-18 17-18 13 0 17 36 30 36 9 0 17-7 17-18s-8-18-17-18c-13 0-17 36-30 36-9 0-17-7-17-18z" fill="none" stroke="url(#g)" stroke-width="9" stroke-linecap="round"/></svg>
<h1>DevOps Akademiya</h1><p>Chuqur o'rganamiz — ichki mexanizmlarigacha</p><div class="b"><i></i></div></div></body></html>`

function buildSearchIndex() {
  const ver = `${curriculum.version}|${PROMPT_VERSION}|${allPremium().size}|3`
  if (store.kv('indexVersion') === ver) return
  const docs: { lessonId: number; section: string; title: string; body: string }[] = []
  for (const l of LESSONS) {
    docs.push({ lessonId: l.id, section: 'goal', title: l.title, body: [l.summary, ...l.objectives, l.concepts.join(', '), ...l.depth, ...l.glossary.map((g) => `${g.term}: ${g.def}`), ...l.labs, ...l.breakfix, ...l.interview].join('\n') })
  }
  for (const [id, secs] of allPremium()) {
    const l = LESSONS.find((x) => x.id === id); if (!l) continue
    for (const [sec, body] of Object.entries(secs)) if (sec !== 'goal') docs.push({ lessonId: id, section: sec, title: `${l.title} — ${sectionMeta(sec).title}`, body: body ?? '' })
  }
  const cached = store.db.prepare("SELECT lesson_id, section, content FROM ai_cache WHERE key LIKE 'section|%' AND section != 'quiz' AND lesson_id IS NOT NULL").all() as { lesson_id: number; section: string; content: string }[]
  for (const c of cached) {
    const l = LESSONS.find((x) => x.id === c.lesson_id)
    if (l && !allPremium().get(l.id)?.[c.section as never]) docs.push({ lessonId: l.id, section: c.section, title: `${l.title} — ${sectionMeta(c.section).title}`, body: c.content })
  }
  store.indexDocs(docs, true)
  store.kv('indexVersion', ver)
}

function createSplash() {
  splash = new BrowserWindow({ width: 380, height: 260, frame: false, transparent: true, resizable: false, alwaysOnTop: true, skipTaskbar: true, show: true, webPreferences: { javascript: false, sandbox: true } })
  void splash.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(SPLASH))
}

function createWindow() {
  const saved = store.kv('window') as { x?: number; y?: number; width: number; height: number; max?: boolean } | undefined
  const area = screen.getPrimaryDisplay().workAreaSize
  const width = Math.min(saved?.width ?? 1440, area.width), height = Math.min(saved?.height ?? 900, area.height)
  const visible = saved?.x !== undefined && screen.getAllDisplays().some((d) => saved.x! >= d.bounds.x - 50 && saved.x! < d.bounds.x + d.bounds.width - 100 && saved.y! >= d.bounds.y - 50 && saved.y! < d.bounds.y + d.bounds.height - 100)
  win = new BrowserWindow({
    width, height, ...(visible ? { x: saved!.x, y: saved!.y } : {}), minWidth: 1100, minHeight: 640, show: false,
    backgroundColor: '#0d0f1a', title: 'DevOps Akademiya', icon: join(__dirname, '../../build/icon.png'),
    titleBarStyle: 'hidden', ...(process.platform !== 'darwin' ? { titleBarOverlay: { color: '#0d0f1a', symbolColor: '#c7cbe6', height: 40 } } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true,
      spellcheck: false, devTools: !app.isPackaged
    }
  })
  if (saved?.max) win.maximize()
  win.once('ready-to-show', () => { splash?.destroy(); splash = null; win?.show() })
  const saveBounds = () => { if (!win || win.isDestroyed()) return; const b = win.getNormalBounds(); store.kv('window', { ...b, max: win.isMaximized() }) }
  win.on('close', saveBounds)
  win.on('closed', () => { win = null })

  // Navigatsiya va yangi oynalarni qat'iy cheklash
  win.webContents.setWindowOpenHandler(({ url }) => {
    try { const u = new URL(url); if (u.protocol === 'https:' && EXTERNAL_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith('.' + h))) void shell.openExternal(url) } catch { /* noto'g'ri URL */ }
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => { if (!isDev || !url.startsWith(process.env.ELECTRON_RENDERER_URL!)) e.preventDefault() })
  win.webContents.on('will-attach-webview', (e) => e.preventDefault())

  if (isDev) void win.loadURL(process.env.ELECTRON_RENDERER_URL!)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.quit()
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus() } })
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null)
    if (!process.env.DA_NO_SPLASH) createSplash()
    const dbPath = join(app.getPath('userData'), 'akademiya.db')
    const nativeBinding = app.isPackaged ? join(process.resourcesPath, 'native', `${process.platform}-${process.arch}.node`) : undefined
    store = new Store(new Database(dbPath, nativeBinding ? { nativeBinding } : {}), curriculum)
    // Hech qanday ruxsat (kamera, geolokatsiya...) berilmaydi
    session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false))
    registerIpc(store, () => win)
    createWindow()
    setTimeout(() => { try { buildSearchIndex() } catch (e) { console.error('[index]', e) } }, 50)
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow() })
  })
  app.on('window-all-closed', () => { try { store?.db.close() } catch { /* yopilgan */ } if (process.platform !== 'darwin') app.quit() })
}
