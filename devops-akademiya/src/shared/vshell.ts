/**
 * Virtual shell — to'liq simulyatsiya qilingan fayl tizimi va buyruqlar.
 * Haqiqiy tizimga, diskka yoki jarayonlarga HECH QANDAY murojaat yo'q.
 */
export interface VNode { type: 'dir' | 'file'; mode: number; owner: string; group: string; mtime: number; content?: string; children?: Record<string, VNode> }
export interface Proc { pid: number; user: string; cmd: string; cpu: number; mem: number }
export interface Unit { name: string; active: boolean; enabled: boolean; desc: string; pid?: number; log: string[] }
export interface Result { out: string; err: string; code: number; clear?: boolean }

const T0 = Date.UTC(2026, 10, 10, 9, 0)
const d = (children: Record<string, VNode>, mode = 0o755, owner = 'root'): VNode => ({ type: 'dir', mode, owner, group: owner, mtime: T0, children })
const f = (content: string, mode = 0o644, owner = 'root'): VNode => ({ type: 'file', mode, owner, group: owner, mtime: T0, content })

const ACCESS = `203.0.113.7 - - [10/Nov/2026:09:01:12 +0500] "GET / HTTP/1.1" 200 5123
198.51.100.23 - - [10/Nov/2026:09:01:15 +0500] "GET /api/users HTTP/1.1" 200 842
203.0.113.7 - - [10/Nov/2026:09:01:19 +0500] "POST /api/login HTTP/1.1" 401 77
192.0.2.44 - - [10/Nov/2026:09:02:01 +0500] "GET /static/app.js HTTP/1.1" 304 0
203.0.113.7 - - [10/Nov/2026:09:02:03 +0500] "POST /api/login HTTP/1.1" 401 77
198.51.100.23 - - [10/Nov/2026:09:02:30 +0500] "GET /api/orders HTTP/1.1" 500 133
203.0.113.7 - - [10/Nov/2026:09:02:41 +0500] "POST /api/login HTTP/1.1" 200 310
192.0.2.44 - - [10/Nov/2026:09:03:05 +0500] "GET /health HTTP/1.1" 200 2
198.51.100.23 - - [10/Nov/2026:09:03:17 +0500] "GET /api/orders HTTP/1.1" 502 157
203.0.113.99 - - [10/Nov/2026:09:03:44 +0500] "GET /admin HTTP/1.1" 403 153
203.0.113.7 - - [10/Nov/2026:09:04:02 +0500] "GET /api/users HTTP/1.1" 200 842
192.0.2.44 - - [10/Nov/2026:09:04:10 +0500] "GET /health HTTP/1.1" 200 2
`
export function makeFs(): VNode {
  return d({
    bin: d({}), usr: d({ bin: d({}), local: d({ bin: d({}) }) }), tmp: d({}, 0o1777), root: d({}, 0o700), run: d({}), opt: d({ scripts: d({ 'backup.sh': f('#!/bin/bash\nset -euo pipefail\ntar -czf /tmp/backup-$(date +%F).tar.gz /var/www\necho "backup tayyor"\n', 0o644, 'talaba') }, 0o755, 'talaba') }),
    proc: d({ cpuinfo: f('processor\t: 0\nmodel name\t: Virtual CPU\ncpu MHz\t\t: 2400.000\nprocessor\t: 1\nmodel name\t: Virtual CPU\n', 0o444), meminfo: f('MemTotal:        4028508 kB\nMemFree:         1502332 kB\nMemAvailable:    2861120 kB\n', 0o444), loadavg: f('0.42 0.31 0.27 1/212 4821\n', 0o444) }, 0o555),
    etc: d({
      hostname: f('lab-server\n'), 'os-release': f('PRETTY_NAME="Ubuntu 24.04.1 LTS"\nNAME="Ubuntu"\nVERSION_ID="24.04"\nID=ubuntu\n'),
      passwd: f('root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\ntalaba:x:1000:1000:Talaba:/home/talaba:/bin/bash\ndeploy:x:1001:1001::/home/deploy:/bin/bash\n'),
      group: f('root:x:0:\nsudo:x:27:talaba\nwww-data:x:33:\ntalaba:x:1000:\ndeploy:x:1001:\n'), shadow: f('root:!:19700:0:99999:7:::\ntalaba:$y$j9T$...:19700:0:99999:7:::\n', 0o640),
      hosts: f('127.0.0.1 localhost\n127.0.1.1 lab-server\n10.0.0.5 db.internal\n'), 'resolv.conf': f('nameserver 127.0.0.53\noptions edns0 trust-ad\nsearch internal\n'),
      fstab: f('# <fs>  <mount>  <type>  <options>  <dump>  <pass>\nUUID=3f2a-11bc  /      ext4  defaults         0 1\nUUID=9c1d-77e0  /data  ext4  defaults,nofail  0 2\n'),
      crontab: f('SHELL=/bin/sh\nPATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin\n17 *\t* * *\troot\tcd / && run-parts --report /etc/cron.hourly\n'),
      nginx: d({ 'nginx.conf': f('user www-data;\nworker_processes auto;\npid /run/nginx.pid;\n\nevents {\n    worker_connections 768;\n}\n\nhttp {\n    sendfile on;\n    include /etc/nginx/mime.types;\n    access_log /var/log/nginx/access.log;\n    error_log /var/log/nginx/error.log;\n    include /etc/nginx/sites-enabled/*;\n}\n'), 'sites-enabled': d({ default: f('server {\n    listen 80 default_server;\n    server_name _;\n    root /var/www/html;\n    index index.html;\n\n    location / {\n        try_files $uri $uri/ =404;\n    }\n}\n') }) }),
      systemd: d({ system: d({ 'myapp.service': f('[Unit]\nDescription=Mening ilovam\nAfter=network.target\n\n[Service]\nUser=deploy\nWorkingDirectory=/opt/myapp\nExecStart=/usr/bin/python3 /opt/myapp/app.py\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target\n') }) }),
      ssh: d({ sshd_config: f('Port 22\nPermitRootLogin yes\nPasswordAuthentication yes\nPubkeyAuthentication yes\n') })
    }),
    var: d({ log: d({ syslog: f('Nov 10 09:00:01 lab-server CRON[4101]: (root) CMD (run-parts /etc/cron.hourly)\nNov 10 09:01:44 lab-server sshd[4188]: Failed password for root from 203.0.113.99 port 51122 ssh2\nNov 10 09:01:47 lab-server sshd[4188]: Failed password for root from 203.0.113.99 port 51122 ssh2\nNov 10 09:02:30 lab-server myapp[3920]: ERROR database connection refused (db.internal:5432)\nNov 10 09:02:31 lab-server systemd[1]: myapp.service: Main process exited, code=exited, status=1/FAILURE\nNov 10 09:03:10 lab-server kernel: Out of memory: Killed process 3811 (java)\n', 0o640), 'auth.log': f('Nov 10 09:01:44 lab-server sshd[4188]: Failed password for root from 203.0.113.99 port 51122 ssh2\nNov 10 09:05:02 lab-server sshd[4301]: Accepted publickey for talaba from 192.0.2.44 port 40022 ssh2\n', 0o640), nginx: d({ 'access.log': f(ACCESS, 0o640, 'www-data'), 'error.log': f('2026/11/10 09:02:30 [error] 811#811: *41 connect() failed (111: Connection refused) while connecting to upstream, upstream: "http://127.0.0.1:8000/api/orders"\n', 0o640, 'www-data') }) }), www: d({ html: d({ 'index.html': f('<!doctype html>\n<h1>Salom, DevOps!</h1>\n', 0o644, 'www-data') }, 0o755, 'www-data') }) }),
    home: d({ talaba: d({
      'README.txt': f('Xush kelibsiz, virtual laboratoriyaga!\nBu yerda hech narsani buzib qo\'yishdan qo\'rqmang — "reset" hammasini tiklaydi.\nBoshlash uchun: help\n', 0o644, 'talaba'),
      'notes.md': f('# Eslatmalar\n- pipe: bir buyruq chiqishi → ikkinchisining kirishi\n- 2>&1: stderr ni stdout ga yo\'naltirish\n', 0o644, 'talaba'),
      '.bashrc': f('export PATH=$PATH:/opt/scripts\nalias ll="ls -la"\n', 0o644, 'talaba'), '.ssh': d({ authorized_keys: f('ssh-ed25519 AAAAC3Nza... talaba@noutbuk\n', 0o600, 'talaba') }, 0o700, 'talaba'),
      loyiha: d({ 'app.py': f('import os\n\nDB_HOST = os.environ.get("DB_HOST", "localhost")\nPORT = 8000\n\ndef main():\n    print(f"Server {PORT}-portda ishga tushdi")\n\nif __name__ == "__main__":\n    main()\n', 0o644, 'talaba'), 'requirements.txt': f('flask==3.0.3\ngunicorn==22.0.0\npsycopg[binary]==3.2.1\n', 0o644, 'talaba'), '.env': f('DB_HOST=db.internal\nDB_PASSWORD=juda-maxfiy\nDEBUG=true\n', 0o666, 'talaba'), 'deploy.sh': f('#!/bin/bash\necho "Deploy boshlandi..."\ngit pull && systemctl restart myapp\n', 0o644, 'talaba'), logs: d({ 'app.log': f('INFO start\nERROR db timeout\nINFO retry\nERROR db timeout\nWARN slow query 2.3s\nINFO ok\n', 0o644, 'talaba') }, 0o755, 'talaba') }, 0o755, 'talaba')
    }, 0o755, 'talaba'), deploy: d({}, 0o750, 'deploy') })
  })
}

const norm = (p: string, cwd: string): string[] => {
  const parts = (p.startsWith('/') ? p : cwd + '/' + p).split('/'), out: string[] = []
  for (const s of parts) { if (!s || s === '.') continue; if (s === '..') out.pop(); else out.push(s) }
  return out
}
const pad = (s: string | number, n: number) => String(s).padStart(n)
const modeStr = (n: VNode) => (n.type === 'dir' ? 'd' : '-') + [6, 3, 0].map((sh, i) => { const m = (n.mode >> sh) & 7, sp = (n.mode >> (11 - i)) & 1; return (m & 4 ? 'r' : '-') + (m & 2 ? 'w' : '-') + (sp ? (i === 2 ? 't' : 's') : m & 1 ? 'x' : '-') }).join('')

export class VShell {
  fs = makeFs()
  cwd = '/home/talaba'
  user = 'talaba'
  env: Record<string, string> = { HOME: '/home/talaba', USER: 'talaba', SHELL: '/bin/bash', PATH: '/usr/local/bin:/usr/bin:/bin', LANG: 'uz_UZ.UTF-8' }
  history: string[] = []
  procs: Proc[] = [{ pid: 1, user: 'root', cmd: '/sbin/init', cpu: 0, mem: 0.3 }, { pid: 411, user: 'root', cmd: '/usr/sbin/sshd -D', cpu: 0, mem: 0.2 }, { pid: 800, user: 'root', cmd: 'nginx: master process /usr/sbin/nginx', cpu: 0, mem: 0.4 }, { pid: 811, user: 'www-data', cmd: 'nginx: worker process', cpu: 0.3, mem: 0.9 }, { pid: 3811, user: 'deploy', cmd: 'java -Xmx2g -jar report.jar', cpu: 97.2, mem: 61.4 }, { pid: 4500, user: 'talaba', cmd: '-bash', cpu: 0, mem: 0.1 }]
  units: Unit[] = [
    { name: 'nginx', active: true, enabled: true, desc: 'A high performance web server and a reverse proxy server', pid: 800, log: ['Started nginx.service - A high performance web server.'] },
    { name: 'ssh', active: true, enabled: true, desc: 'OpenBSD Secure Shell server', pid: 411, log: ['Server listening on 0.0.0.0 port 22.'] },
    { name: 'myapp', active: false, enabled: false, desc: 'Mening ilovam', log: ['Started myapp.service - Mening ilovam.', 'ERROR database connection refused (db.internal:5432)', 'myapp.service: Main process exited, code=exited, status=1/FAILURE', 'myapp.service: Failed with result \'exit-code\'.'] },
    { name: 'cron', active: true, enabled: true, desc: 'Regular background program processing daemon', pid: 399, log: ['(CRON) INFO (pidfile fd = 3)'] }
  ]
  lastCode = 0
  private nextPid = 5000

  node(path: string): VNode | undefined { let n: VNode = this.fs; for (const p of norm(path, this.cwd)) { if (n.type !== 'dir' || !n.children![p]) return undefined; n = n.children![p] } return n }
  abs(path: string) { return '/' + norm(path, this.cwd).join('/') }
  private parent(path: string): { dir?: VNode; name: string } { const parts = norm(path, this.cwd); const name = parts.pop() ?? ''; return { dir: this.node('/' + parts.join('/')), name } }
  private can(n: VNode, bit: 4 | 2 | 1): boolean { if (this.user === 'root') return true; const sh = n.owner === this.user ? 6 : n.group === this.user ? 3 : 0; return !!((n.mode >> sh) & bit) }
  read(path: string): string { const n = this.node(path); if (!n) throw new Error(`${path}: Bunday fayl yoki katalog yo'q`); if (n.type === 'dir') throw new Error(`${path}: Bu katalog`); if (!this.can(n, 4)) throw new Error(`${path}: Ruxsat berilmagan`); return n.content ?? '' }
  write(path: string, content: string, append = false) {
    const { dir, name } = this.parent(path)
    if (!dir || dir.type !== 'dir') throw new Error(`${path}: Bunday fayl yoki katalog yo'q`)
    const ex = dir.children![name]
    if (ex) { if (ex.type === 'dir') throw new Error(`${path}: Bu katalog`); if (!this.can(ex, 2)) throw new Error(`${path}: Ruxsat berilmagan`); ex.content = append ? (ex.content ?? '') + content : content; ex.mtime = Date.now() }
    else { if (!this.can(dir, 2)) throw new Error(`${path}: Ruxsat berilmagan`); dir.children![name] = { type: 'file', mode: 0o644, owner: this.user, group: this.user, mtime: Date.now(), content } }
  }

  prompt() { const home = this.env.HOME; const p = this.cwd === home ? '~' : this.cwd.startsWith(home + '/') ? '~' + this.cwd.slice(home.length) : this.cwd; return `${this.user}@lab-server:${p}${this.user === 'root' ? '#' : '$'} ` }

  /** Tab bilan to'ldirish uchun nomzodlar */
  complete(line: string): string[] {
    const tok = line.split(/\s+/).pop() ?? ''
    if (!line.includes(' ')) return Object.keys(this.cmds).filter((c) => c.startsWith(tok)).sort()
    const i = tok.lastIndexOf('/'), dirP = i >= 0 ? tok.slice(0, i + 1) : '', base = tok.slice(i + 1)
    const dn = this.node(dirP || '.'); if (!dn || dn.type !== 'dir') return []
    return Object.keys(dn.children!).filter((n) => n.startsWith(base)).sort().map((n) => dirP + n + (dn.children![n].type === 'dir' ? '/' : ''))
  }

  /** Tokenlarga ajratadi; har token uchun "qo'shtirnoq ichidami" belgisini ham qaytaradi (glob uchun kerak). */
  private tokenize(s: string): { v: string; quoted: boolean }[] {
    const out: { v: string; quoted: boolean }[] = []
    let cur = '', q = '', has = false, quoted = false
    const push = () => { if (cur || has) out.push({ v: cur, quoted }); cur = ''; has = false; quoted = false }
    for (let i = 0; i < s.length; i++) {
      const c = s[i]
      if (q) { if (c === q) q = ''; else if (c === '\\' && q === '"' && i + 1 < s.length) cur += s[++i]; else cur += q === '"' && c === '$' ? '\u0001' : c; continue }
      if (c === '"' || c === "'") { q = c; has = true; quoted = true; continue }
      if (c === '\\' && i + 1 < s.length) { cur += s[++i]; quoted = true; continue }
      if (/\s/.test(c)) { push(); continue }
      if (c === '$') { cur += '\u0001'; continue }
      if (c === '~' && cur === '' && (i + 1 >= s.length || s[i + 1] === '/' || /\s/.test(s[i + 1]))) { cur += this.env.HOME; continue }
      cur += c
    }
    push()
    return out.map((t) => ({ ...t, v: t.v.replace(/\u0001(\w+|\?)/g, (_, v) => (v === '?' ? String(this.lastCode) : this.env[v] ?? '')).replace(/\u0001/g, '$') }))
  }
  private glob(tok: string): string[] {
    if (!/[*?]/.test(tok)) return [tok]
    const i = tok.lastIndexOf('/'), dirP = i >= 0 ? tok.slice(0, i + 1) : '', pat = tok.slice(i + 1)
    const dn = this.node(dirP || '.'); if (!dn || dn.type !== 'dir') return [tok]
    const re = new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$')
    const m = Object.keys(dn.children!).filter((n) => re.test(n) && (pat.startsWith('.') || !n.startsWith('.'))).sort()
    return m.length ? m.map((n) => dirP + n) : [tok]
  }

  /** To'liq qatorni bajaradi: ; && || | > >> 2>&1 qo'llab-quvvatlanadi */
  run(line: string): Result {
    line = line.trim()
    if (!line || line.startsWith('#')) return { out: '', err: '', code: 0 }
    this.history.push(line)
    let out = '', err = '', clear = false
    const parts = line.split(/(&&|\|\||;)/).map((s) => s.trim())
    let skip = false
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]
      if (p === '&&') { skip = this.lastCode !== 0; continue } if (p === '||') { skip = this.lastCode === 0; continue } if (p === ';') { skip = false; continue }
      if (skip || !p) continue
      const r = this.pipeline(p); out += r.out; err += r.err; this.lastCode = r.code; clear ||= !!r.clear
    }
    return { out, err, code: this.lastCode, clear }
  }
  private pipeline(s: string): Result {
    const stages = s.split(/\s*\|(?!\|)\s*/)
    let stdin = '', errAll = '', code = 0, clear = false
    for (let i = 0; i < stages.length; i++) {
      let st = stages[i]
      // Yo'naltirishlarni CHAPDAN O'NGGA yig'amiz — tartib muhim (masalan "2>&1 > f" va "> f 2>&1" har xil)
      type Dest = 'term' | null | { path: string; append: boolean }
      let fd1: Dest = 'term', fd2: Dest = 'term'
      const re = /\s(2>&1|&>>?|2>>?|>>?|<)(?:\s*([^\s|<>]+))?/g
      let m: RegExpExecArray | null, cut = st.length, inFile: string | null = null
      while ((m = re.exec(st))) {
        cut = Math.min(cut, m.index)
        const op = m[1], target = this.tokenize(m[2] ?? '')[0]?.v ?? ''   // ~ va $VAR yo'naltirish manzilida ham ochiladi
        const dest: Dest = target === '/dev/null' ? null : { path: target, append: op.endsWith('>>') }
        if (op === '2>&1') fd2 = fd1
        else if (op === '<') inFile = target
        else if (op.startsWith('2>')) fd2 = dest
        else if (op.startsWith('&>')) { fd1 = dest; fd2 = dest }
        else fd1 = dest
      }
      st = st.slice(0, cut)
      if (inFile) { try { stdin = this.read(inFile) } catch (e: any) { return { out: '', err: `bash: ${e.message}\n`, code: 1 } } }
      const r = this.exec(st, stdin)
      let o = r.out, e = r.err
      const f1 = typeof fd1 === 'object' && fd1 !== null ? fd1 : null
      const f2 = typeof fd2 === 'object' && fd2 !== null ? fd2 : null
      const sameFile = !!f1 && !!f2 && f1.path === f2.path
      // stderr ni manzili bo'yicha taqsimlash
      if (fd2 === null) e = ''
      else if (f2) {
        if (sameFile) { o += e; e = '' }                                  // ikkalasi bir faylga: "> f 2>&1"
        else { try { this.write(f2.path, e, f2.append); e = '' } catch (x: any) { e = `bash: ${x.message}\n` } }
      }
      if (fd1 === null) o = ''
      else if (f1) { try { this.write(f1.path, o, f1.append); o = '' } catch (x: any) { e += `bash: ${x.message}\n`; r.code = 1; o = '' } }
      stdin = o; errAll += e; code = r.code; clear ||= !!r.clear
    }
    return { out: stdin, err: errAll, code, clear }
  }
  private exec(s: string, stdin: string): Result {
    const assign = /^(\w+)=(.*)$/.exec(s.trim()); if (assign) { this.env[assign[1]] = this.tokenize(assign[2])[0]?.v ?? ''; return { out: '', err: '', code: 0 } }
    let argv = this.tokenize(s).flatMap((t) => (t.quoted ? [t.v] : this.glob(t.v)))
    if (!argv.length) return { out: '', err: '', code: 0 }
    let sudo = false
    if (argv[0] === 'sudo') { sudo = true; argv = argv.slice(1); if (!argv.length) return { out: '', err: 'usage: sudo <buyruq>\n', code: 1 } }
    if (argv[0] === 'll') argv = ['ls', '-la', ...argv.slice(1)]
    const fn = this.cmds[argv[0]]
    if (!fn) {
      if (argv[0].includes('/')) { const n = this.node(argv[0]); if (!n) return { out: '', err: `bash: ${argv[0]}: Bunday fayl yoki katalog yo'q\n`, code: 127 }; if (!this.can(n, 1) || !(n.mode & 0o111)) return { out: '', err: `bash: ${argv[0]}: Ruxsat berilmagan\n`, code: 126 }; return { out: (n.content ?? '').split('\n').filter((l) => l.startsWith('echo ')).map((l) => this.tokenize(l.slice(5)).join(' ')).join('\n') + '\n', err: '', code: 0 } }
      return { out: '', err: `${argv[0]}: buyruq topilmadi (qo'llab-quvvatlanadigan buyruqlar: help)\n`, code: 127 }
    }
    const prev = this.user; if (sudo) this.user = 'root'
    try { const r = fn(argv.slice(1), stdin); return { out: r.out ?? '', err: r.err ?? '', code: r.code ?? (r.err ? 1 : 0), clear: r.clear } }
    catch (e: any) { return { out: '', err: `${argv[0]}: ${e.message}\n`, code: 1 } }
    finally { if (sudo) this.user = prev }
  }

  private flags(args: string[], withValue = ''): { f: Set<string>; v: Record<string, string>; rest: string[] } {
    const f = new Set<string>(), v: Record<string, string> = {}, rest: string[] = []
    for (let i = 0; i < args.length; i++) { const a = args[i]; if (a.startsWith('--')) f.add(a.slice(2)); else if (/^-[a-zA-Z]/.test(a) && !/^-\d+$/.test(a)) { for (let k = 1; k < a.length; k++) { const c = a[k]; if (withValue.includes(c)) { v[c] = a.slice(k + 1) || args[++i] || ''; break } f.add(c) } } else rest.push(a) }
    return { f, v, rest }
  }
  private input(files: string[], stdin: string): string { return files.length ? files.map((p) => this.read(p)).join('') : stdin }
  private lines(s: string) { const l = s.split('\n'); if (l[l.length - 1] === '') l.pop(); return l }
  private walk(path: string, cb: (p: string, n: VNode) => void) { const n = this.node(path); if (!n) throw new Error(`'${path}': Bunday fayl yoki katalog yo'q`); const go = (p: string, x: VNode) => { cb(p, x); if (x.type === 'dir' && this.can(x, 4)) for (const k of Object.keys(x.children!).sort()) go(p.replace(/\/$/, '') + '/' + k, x.children![k]) }; go(path, n) }
  private size(n: VNode): number { return n.type === 'file' ? (n.content ?? '').length : 4096 + Object.values(n.children!).reduce((a, c) => a + this.size(c), 0) }

  cmds: Record<string, (a: string[], stdin: string) => Partial<Result>> = {
    help: () => ({ out: 'Virtual laboratoriya buyruqlari (haqiqiy tizimga tegmaydi):\n  Fayllar:   ls cd pwd cat head tail touch mkdir rm cp mv ln stat file tree\n  Matn:      echo grep sed awk cut sort uniq wc tr tee xargs\n  Qidiruv:   find which\n  Ruxsatlar: chmod chown id whoami sudo su\n  Jarayon:   ps top kill systemctl journalctl\n  Tizim:     df du free uname hostname date uptime env export history\n  Tarmoq:    ip ss ping curl\n  Boshqa:    man clear reset\nPipe (|), yo\'naltirish (> >> 2>&1), && || ; va $O\'ZGARUVCHI ishlaydi. Tab — to\'ldirish.\n' }),
    pwd: () => ({ out: this.cwd + '\n' }),
    whoami: () => ({ out: this.user + '\n' }),
    id: (a) => { const u = a[0] ?? this.user; const m: Record<string, string> = { root: 'uid=0(root) gid=0(root) groups=0(root)', talaba: 'uid=1000(talaba) gid=1000(talaba) groups=1000(talaba),27(sudo)', deploy: 'uid=1001(deploy) gid=1001(deploy) groups=1001(deploy)', 'www-data': 'uid=33(www-data) gid=33(www-data) groups=33(www-data)' }; return m[u] ? { out: m[u] + '\n' } : { err: `id: '${u}': bunday foydalanuvchi yo'q\n` } },
    su: (a) => { const u = a.filter((x) => x !== '-')[0] ?? 'root'; if (!['root', 'talaba', 'deploy'].includes(u)) return { err: `su: ${u} foydalanuvchisi mavjud emas\n` }; this.user = u; this.env.USER = u; return {} },
    hostname: () => ({ out: 'lab-server\n' }),
    uname: (a) => ({ out: a.includes('-a') ? 'Linux lab-server 6.8.0-45-generic #45-Ubuntu SMP x86_64 GNU/Linux\n' : a.includes('-r') ? '6.8.0-45-generic\n' : 'Linux\n' }),
    date: () => ({ out: new Date().toString().slice(0, 24) + '\n' }),
    uptime: () => ({ out: ' 09:12:44 up 12 days,  3:41,  1 user,  load average: 0.42, 0.31, 0.27\n' }),
    clear: () => ({ clear: true }),
    reset: () => { const h = this.history; Object.assign(this, new VShell()); this.history = h; return { clear: true, out: 'Fayl tizimi boshlang\'ich holatga qaytarildi.\n' } },
    history: () => ({ out: this.history.map((h, i) => `${pad(i + 1, 5)}  ${h}`).join('\n') + '\n' }),
    env: () => ({ out: Object.entries(this.env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n' }),
    export: (a) => { for (const x of a) { const m = /^(\w+)=(.*)$/.exec(x); if (m) this.env[m[1]] = m[2] } return {} },
    which: (a) => a[0] && this.cmds[a[0]] ? { out: `/usr/bin/${a[0]}\n` } : { code: 1 },
    echo: (a) => { const n = a[0] === '-n'; const e = a[0] === '-e'; let s = (n || e ? a.slice(1) : a).join(' '); if (e) s = s.replace(/\\n/g, '\n').replace(/\\t/g, '\t'); return { out: s + (n ? '' : '\n') } },
    cd: (a) => { const t = a[0] ?? this.env.HOME; const p = t === '-' ? this.env.OLDPWD ?? this.cwd : t.replace(/^~/, this.env.HOME); const n = this.node(p); if (!n) return { err: `bash: cd: ${t}: Bunday fayl yoki katalog yo'q\n` }; if (n.type !== 'dir') return { err: `bash: cd: ${t}: Katalog emas\n` }; if (!this.can(n, 1)) return { err: `bash: cd: ${t}: Ruxsat berilmagan\n` }; this.env.OLDPWD = this.cwd; this.cwd = this.abs(p); return {} },
    ls: (a) => {
      const { f, rest } = this.flags(a); const targets = rest.length ? rest : ['.']; let out = '', err = ''
      const fmtL = (name: string, n: VNode) => `${modeStr(n)} ${n.type === 'dir' ? pad(Object.keys(n.children!).length + 2, 2) : ' 1'} ${n.owner.padEnd(8)} ${n.group.padEnd(8)} ${pad(f.has('h') ? this.human(this.size(n)) : n.type === 'dir' ? 4096 : (n.content ?? '').length, 6)} Noy 10 09:00 ${name}${n.type === 'dir' && f.has('F') ? '/' : ''}`
      for (const t of targets) {
        const n = this.node(t.replace(/^~/, this.env.HOME)); if (!n) { err += `ls: '${t}' ga kirib bo'lmadi: Bunday fayl yoki katalog yo'q\n`; continue }
        if (n.type === 'file' || f.has('d')) { out += (f.has('l') ? fmtL(t, n) : t) + '\n'; continue }
        if (!this.can(n, 4)) { err += `ls: '${t}' katalogini ochib bo'lmadi: Ruxsat berilmagan\n`; continue }
        if (targets.length > 1) out += `${t}:\n`
        let names = Object.keys(n.children!).filter((x) => f.has('a') || f.has('A') || !x.startsWith('.')).sort()
        if (f.has('t')) names.sort((x, y) => n.children![y].mtime - n.children![x].mtime); if (f.has('S')) names.sort((x, y) => this.size(n.children![y]) - this.size(n.children![x])); if (f.has('r')) names.reverse()
        if (f.has('l')) out += `jami ${names.length}\n` + (f.has('a') ? [fmtL('.', n), fmtL('..', n)].join('\n') + '\n' : '') + names.map((x) => fmtL(x, n.children![x])).join('\n') + (names.length ? '\n' : '')
        else out += names.map((x) => x + (n.children![x].type === 'dir' ? '/' : '')).join('  ') + (names.length ? '\n' : '')
      }
      return { out, err }
    },
    tree: (a) => { let out = (a[0] ?? '.') + '\n'; const go = (n: VNode, pre: string) => { const k = Object.keys(n.children!).filter((x) => !x.startsWith('.')).sort(); k.forEach((x, i) => { const last = i === k.length - 1; out += `${pre}${last ? '└── ' : '├── '}${x}\n`; if (n.children![x].type === 'dir') go(n.children![x], pre + (last ? '    ' : '│   ')) }) }; const n = this.node(a[0] ?? '.'); if (!n || n.type !== 'dir') return { err: 'tree: katalog topilmadi\n' }; go(n, ''); return { out } },
    cat: (a, stdin) => { const { f, rest } = this.flags(a); const s = this.input(rest, stdin); return { out: f.has('n') ? this.lines(s).map((l, i) => `${pad(i + 1, 6)}\t${l}`).join('\n') + '\n' : s } },
    head: (a, stdin) => { const { v, rest } = this.flags(a.map((x) => (/^-\d+$/.test(x) ? `-n${x.slice(1)}` : x)), 'n'); return { out: this.lines(this.input(rest, stdin)).slice(0, +(v.n ?? 10)).join('\n') + '\n' } },
    tail: (a, stdin) => { const { v, rest } = this.flags(a.map((x) => (/^-\d+$/.test(x) ? `-n${x.slice(1)}` : x)), 'n'); const l = this.lines(this.input(rest, stdin)); return { out: l.slice(Math.max(0, l.length - +(v.n ?? 10))).join('\n') + (l.length ? '\n' : '') } },
    wc: (a, stdin) => { const { f, rest } = this.flags(a); const s = this.input(rest, stdin); const l = this.lines(s).length, w = s.split(/\s+/).filter(Boolean).length, c = s.length; const name = rest[0] ? ' ' + rest.join(' ') : ''; return { out: (f.has('l') ? `${l}` : f.has('w') ? `${w}` : f.has('c') ? `${c}` : `${pad(l, 4)} ${pad(w, 4)} ${pad(c, 5)}`) + name + '\n' } },
    touch: (a) => { for (const p of a) { const n = this.node(p); if (n) n.mtime = Date.now(); else this.write(p, '') } return {} },
    mkdir: (a) => { const { f, rest } = this.flags(a); for (const p of rest) { const parts = norm(p, this.cwd); let n = this.fs; parts.forEach((s, i) => { if (!n.children![s]) { if (i < parts.length - 1 && !f.has('p')) throw new Error(`'${p}' katalogini yaratib bo'lmadi: Bunday fayl yoki katalog yo'q`); if (!this.can(n, 2)) throw new Error(`'${p}' katalogini yaratib bo'lmadi: Ruxsat berilmagan`); n.children![s] = { type: 'dir', mode: 0o755, owner: this.user, group: this.user, mtime: Date.now(), children: {} } } else if (i === parts.length - 1 && !f.has('p')) throw new Error(`'${p}' katalogini yaratib bo'lmadi: Fayl mavjud`); n = n.children![s]; if (n.type !== 'dir') throw new Error(`'${p}': Katalog emas`) }) } return {} },
    rm: (a) => { const { f, rest } = this.flags(a); let err = ''; for (const p of rest) { if (this.abs(p) === '/') { err += 'rm: "/" ni o\'chirish xavfli — rad etildi\n'; continue } const { dir, name } = this.parent(p); const n = dir?.children?.[name]; if (!n) { if (!f.has('f')) err += `rm: '${p}' ni o'chirib bo'lmadi: Bunday fayl yoki katalog yo'q\n`; continue } if (this.abs(p) === '/' || !name) { err += 'rm: "/" ni o\'chirish xavfli — rad etildi (--no-preserve-root ham yordam bermaydi 🙂)\n'; continue } if (n.type === 'dir' && !f.has('r') && !f.has('R')) { err += `rm: '${p}' ni o'chirib bo'lmadi: Bu katalog (-r kerak)\n`; continue } if (!this.can(dir!, 2) || ((dir!.mode & 0o1000) && n.owner !== this.user && this.user !== 'root')) { err += `rm: '${p}' ni o'chirib bo'lmadi: Ruxsat berilmagan\n`; continue } delete dir!.children![name] } return { err } },
    cp: (a) => { const { f, rest } = this.flags(a); if (rest.length < 2) return { err: 'cp: manba va manzil kerak\n' }; const dst = rest[rest.length - 1]; const dn = this.node(dst); for (const s of rest.slice(0, -1)) { const sn = this.node(s); if (!sn) return { err: `cp: '${s}': Bunday fayl yoki katalog yo'q\n` }; if (sn.type === 'dir' && !f.has('r') && !f.has('R') && !f.has('a')) return { err: `cp: -r ko'rsatilmagan; '${s}' katalogi tashlab ketildi\n` }; const target = dn?.type === 'dir' ? dst.replace(/\/$/, '') + '/' + norm(s, this.cwd).pop() : dst; const { dir, name } = this.parent(target); if (!dir || dir.type !== 'dir') return { err: `cp: '${target}': Bunday fayl yoki katalog yo'q\n` }; if (!this.can(dir, 2)) return { err: `cp: '${target}': Ruxsat berilmagan\n` }; const cl = structuredClone(sn); if (!f.has('a') && !f.has('p')) { const own = (x: VNode) => { x.owner = x.group = this.user; if (x.children) Object.values(x.children).forEach(own) }; own(cl) } dir.children![name] = cl } return {} },
    mv: (a) => { if (a.length < 2) return { err: 'mv: manba va manzil kerak\n' }; const dst = a[a.length - 1]; const dn = this.node(dst); for (const s of a.slice(0, -1)) { const sp = this.parent(s); const sn = sp.dir?.children?.[sp.name]; if (!sn) return { err: `mv: '${s}': Bunday fayl yoki katalog yo'q\n` }; const target = dn?.type === 'dir' ? dst.replace(/\/$/, '') + '/' + sp.name : dst; const tp = this.parent(target); if (!tp.dir || tp.dir.type !== 'dir') return { err: `mv: '${target}': Bunday fayl yoki katalog yo'q\n` }; if (!this.can(sp.dir!, 2) || !this.can(tp.dir, 2)) return { err: `mv: '${s}': Ruxsat berilmagan\n` }; delete sp.dir!.children![sp.name]; tp.dir.children![tp.name] = sn } return {} },
    ln: (a) => { const { f, rest } = this.flags(a); if (rest.length < 2) return { err: 'ln: manba va nom kerak\n' }; const sn = this.node(rest[0]); if (!f.has('s') && !sn) return { err: `ln: '${rest[0]}': Bunday fayl yoki katalog yo'q\n` }; const { dir, name } = this.parent(rest[1]); if (!dir) return { err: 'ln: manzil topilmadi\n' }; dir.children![name] = f.has('s') ? { type: 'file', mode: 0o777, owner: this.user, group: this.user, mtime: Date.now(), content: sn?.content ?? '' } : sn!; return {} },
    stat: (a) => { const n = this.node(a[0] ?? ''); if (!n) return { err: `stat: '${a[0]}': Bunday fayl yoki katalog yo'q\n` }; return { out: `  Fayl: ${a[0]}\n  Hajm: ${this.size(n)}\tTur: ${n.type === 'dir' ? 'katalog' : 'oddiy fayl'}\nRuxsat: (${(n.mode & 0o7777).toString(8).padStart(4, '0')}/${modeStr(n)})  Uid: ${n.owner}  Gid: ${n.group}\n` } },
    file: (a) => { const n = this.node(a[0] ?? ''); if (!n) return { err: `${a[0]}: topilmadi\n` }; return { out: `${a[0]}: ${n.type === 'dir' ? 'directory' : (n.content ?? '').startsWith('#!') ? 'Bourne-Again shell script, ASCII text executable' : n.content ? 'ASCII text' : 'empty'}\n` } },
    chmod: (a) => {
      const { f, rest } = this.flags(a.filter((x) => !/^-[rwxXst]+$/.test(x)).concat(), ''); const spec = a.find((x) => /^[0-7]{3,4}$/.test(x) || /^[ugoa]*[+\-=][rwxXst]+(,[ugoa]*[+\-=][rwxXst]+)*$/.test(x)); if (!spec) return { err: 'chmod: rejim noto\'g\'ri (masalan: 755 yoki u+x)\n' }
      const files = a.filter((x) => x !== spec && x !== '-R'); if (!files.length) return { err: 'chmod: fayl ko\'rsatilmagan\n' }
      const apply = (n: VNode, p: string) => { if (n.owner !== this.user && this.user !== 'root') throw new Error(`'${p}' ruxsatlarini o'zgartirib bo'lmadi: Amalga ruxsat yo'q`); if (/^[0-7]+$/.test(spec)) n.mode = parseInt(spec, 8); else for (const c of spec.split(',')) { const m = /^([ugoa]*)([+\-=])([rwxXst]+)$/.exec(c)!; const who = m[1] && m[1] !== 'a' ? m[1] : 'ugo'; let bits = 0; for (const w of who) { const sh = { u: 6, g: 3, o: 0 }[w as 'u']; for (const b of m[3]) { if (b === 'r') bits |= 4 << sh; if (b === 'w') bits |= 2 << sh; if (b === 'x' || (b === 'X' && n.type === 'dir')) bits |= 1 << sh; if (b === 's' && w !== 'o') bits |= w === 'u' ? 0o4000 : 0o2000; if (b === 't') bits |= 0o1000 } } if (m[2] === '+') n.mode |= bits; else if (m[2] === '-') n.mode &= ~bits; else { let mask = 0; for (const w of who) mask |= 7 << { u: 6, g: 3, o: 0 }[w as 'u']; n.mode = (n.mode & ~mask) | bits } } }
      for (const p of files) { if (f.has('R') || a.includes('-R')) this.walk(p, (pp, n) => apply(n, pp)); else { const n = this.node(p); if (!n) return { err: `chmod: '${p}': Bunday fayl yoki katalog yo'q\n` }; apply(n, p) } }
      void rest; return {}
    },
    chown: (a) => { const R = a.includes('-R'); const [spec, ...files] = a.filter((x) => x !== '-R'); if (!spec || !files.length) return { err: 'chown: egasi va fayl kerak\n' }; if (this.user !== 'root') return { err: `chown: '${files[0]}' egasini o'zgartirib bo'lmadi: Amalga ruxsat yo'q (sudo kerak)\n` }; const [u, g] = spec.split(':'); const ap = (n: VNode) => { if (u) n.owner = u; if (g) n.group = g }; for (const p of files) { if (R) this.walk(p, (_, n) => ap(n)); else { const n = this.node(p); if (!n) return { err: `chown: '${p}': Bunday fayl yoki katalog yo'q\n` }; ap(n) } } return {} },
    grep: (a, stdin) => {
      const { f, v, rest } = this.flags(a, 'ABCe'); const pat = v.e ?? rest.shift(); if (pat === undefined) return { err: 'Foydalanish: grep [-invcrEo] ANDOZA [FAYL...]\n', code: 2 }
      let re: RegExp; try { re = new RegExp(f.has('E') || f.has('P') ? pat : pat.replace(/\\\|/g, '|').replace(/(?<!\\)[+?(){}]/g, '\\$&'), f.has('i') ? 'gi' : 'g') } catch { return { err: 'grep: noto\'g\'ri regex\n', code: 2 } }
      const srcs: [string, string][] = []
      if (f.has('r') || f.has('R')) for (const p of rest.length ? rest : ['.']) this.walk(p, (pp, n) => { if (n.type === 'file' && this.can(n, 4)) srcs.push([pp.replace(/^\.\//, ''), n.content ?? '']) }); else if (rest.length) for (const p of rest) srcs.push([p, this.read(p)]); else srcs.push(['', stdin])
      const multi = srcs.length > 1; let out = '', any = false
      for (const [name, text] of srcs) { let c = 0; this.lines(text).forEach((l, i) => { re.lastIndex = 0; const hit = re.test(l) !== f.has('v'); if (!hit) return; any = true; c++; if (f.has('c') || f.has('l') || f.has('q')) return; const pre = (multi ? name + ':' : '') + (f.has('n') ? i + 1 + ':' : ''); if (f.has('o')) { re.lastIndex = 0; for (const m of l.matchAll(re)) out += pre + m[0] + '\n' } else out += pre + l + '\n' }); if (f.has('c')) out += (multi ? name + ':' : '') + c + '\n'; if (f.has('l') && c) out += name + '\n' }
      return { out, code: any ? 0 : 1 }
    },
    sed: (a, stdin) => { const { f, v, rest } = this.flags(a, 'e'); const script = v.e ?? rest.shift() ?? ''; const text = this.input(rest, stdin); const m = /^(\d+|\$)?(?:,(\d+|\$))?s(.)(.*?)\3(.*?)\3([gi]*)$/.exec(script); const del = /^(?:(\d+)|\/(.+)\/)d$/.exec(script); const pr = /^(\d+),(\d+)p$/.exec(script); let lines = this.lines(text); if (m) { const re = new RegExp(m[4].replace(/\\\(/g, '(').replace(/\\\)/g, ')'), m[6].includes('g') ? 'g' + (m[6].includes('i') ? 'i' : '') : m[6].includes('i') ? 'i' : ''); const from = m[1] ? (m[1] === '$' ? lines.length : +m[1]) : 1, to = m[2] ? (m[2] === '$' ? lines.length : +m[2]) : m[1] ? from : lines.length; lines = lines.map((l, i) => (i + 1 >= from && i + 1 <= to ? l.replace(re, m[5].replace(/\\(\d)/g, '$$$1').replace(/&/g, '$$&')) : l)) } else if (del) lines = lines.filter((l, i) => (del[1] ? i + 1 !== +del[1] : !new RegExp(del[2]).test(l))); else if (pr && f.has('n')) lines = lines.slice(+pr[1] - 1, +pr[2]); else return { err: `sed: qo'llab-quvvatlanmaydigan ifoda: ${script} (s/a/b/g, Nd, /re/d, -n 'A,Bp')\n` }; const res = lines.join('\n') + '\n'; if (f.has('i') && rest[0]) { this.write(rest[0], res); return {} } return { out: res } },
    awk: (a, stdin) => { const { v, rest } = this.flags(a, 'F'); const prog = rest.shift() ?? ''; const m = /^(?:\/(.+?)\/\s*|\$(\d+)\s*(==|!=|>=|<=|>|<)\s*"?([^"{]+?)"?\s*|NR\s*(==|>|<)\s*(\d+)\s*)?\{\s*print\s*(.*?)\s*\}$/.exec(prog.trim()); if (!m) return { err: 'awk: faqat sodda shakl: awk [-F:] \'[/re/ | $N==x | NR>1] {print $1, $3}\'\n' }; const sep = v.F ? new RegExp(v.F.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) : /\s+/; const cmp = (x: string, op: string, y: string) => { const nx = +x, ny = +y, num = !isNaN(nx) && !isNaN(ny); return op === '==' ? x === y : op === '!=' ? x !== y : num && (op === '>' ? nx > ny : op === '<' ? nx < ny : op === '>=' ? nx >= ny : nx <= ny) }; const out = this.lines(this.input(rest, stdin)).map((l, i) => { const fl = (v.F ? l : l.trim()).split(sep); if (m[1] && !new RegExp(m[1]).test(l)) return null; if (m[2] && !cmp(fl[+m[2] - 1] ?? '', m[3], m[4].trim())) return null; if (m[5] && !cmp(String(i + 1), m[5], m[6])) return null; if (!m[7]) return l; return m[7].split(/\s*,\s*/).map((e) => e.trim().split(/\s+(?=\$|")|(?<=")\s+/).map((t) => (t === '$0' ? l : t === 'NR' ? String(i + 1) : t === 'NF' ? String(fl.length) : t === '$NF' ? fl[fl.length - 1] : /^\$\d+$/.test(t) ? fl[+t.slice(1) - 1] ?? '' : t.replace(/^"|"$/g, ''))).join('')).join(' ') }).filter((x) => x !== null); return { out: out.join('\n') + (out.length ? '\n' : '') } },
    cut: (a, stdin) => { const { v, rest } = this.flags(a, 'dfc'); const pick = (arr: string[], spec: string) => spec.split(',').flatMap((s) => { const [x, y] = s.split('-'); return y === undefined ? [arr[+x - 1]] : arr.slice(+x - 1, y ? +y : undefined) }).filter((x) => x !== undefined); return { out: this.lines(this.input(rest, stdin)).map((l) => (v.c ? pick(l.split(''), v.c).join('') : pick(l.split(v.d ?? '\t'), v.f ?? '1').join(v.d ?? '\t'))).join('\n') + '\n' } },
    sort: (a, stdin) => { const { f, v, rest } = this.flags(a, 'kt'); let l = this.lines(this.input(rest, stdin)); const key = (s: string) => (v.k ? s.split(v.t ?? /\s+/)[+v.k.split(',')[0] - 1] ?? '' : s); l.sort((x, y) => (f.has('n') || f.has('h') ? (parseFloat(key(x)) || 0) - (parseFloat(key(y)) || 0) : key(x) < key(y) ? -1 : key(x) > key(y) ? 1 : 0)); if (f.has('r')) l.reverse(); if (f.has('u')) l = [...new Set(l)]; return { out: l.join('\n') + (l.length ? '\n' : '') } },
    uniq: (a, stdin) => { const { f, rest } = this.flags(a); const out: [string, number][] = []; for (const l of this.lines(this.input(rest, stdin))) { if (out.length && out[out.length - 1][0] === l) out[out.length - 1][1]++; else out.push([l, 1]) } return { out: out.filter(([, c]) => !f.has('d') || c > 1).map(([l, c]) => (f.has('c') ? `${pad(c, 7)} ${l}` : l)).join('\n') + (out.length ? '\n' : '') } },
    tr: (a, stdin) => { if (a[0] === '-d') return { out: stdin.split('').filter((c) => !a[1].includes(c)).join('') }; const ex = (s: string) => s.replace(/(\w)-(\w)/g, (_, x, y) => { let r = ''; for (let c = x.charCodeAt(0); c <= y.charCodeAt(0); c++) r += String.fromCharCode(c); return r }).replace(/\\n/g, '\n'); const [x, y] = [ex(a[0] ?? ''), ex(a[1] ?? '')]; return { out: stdin.split('').map((c) => { const i = x.indexOf(c); return i >= 0 ? y[Math.min(i, y.length - 1)] ?? c : c }).join('') } },
    tee: (a, stdin) => { const ap = a.includes('-a'); for (const p of a.filter((x) => x !== '-a')) this.write(p, stdin, ap); return { out: stdin } },
    xargs: (a, stdin) => { const items = stdin.split(/\s+/).filter(Boolean); if (!items.length) return {}; const r = this.exec([...(a.length ? a : ['echo']), ...items].map((x) => (/[\s"']/.test(x) ? `'${x}'` : x)).join(' '), ''); return r },
    find: (a) => {
      const paths: string[] = []; let i = 0; while (i < a.length && !a[i].startsWith('-')) paths.push(a[i++]); const tests: ((p: string, n: VNode) => boolean)[] = []; let del = false, maxd = Infinity
      for (; i < a.length; i++) { const k = a[i], val = a[i + 1]; if (k === '-name' || k === '-iname') { const re = new RegExp('^' + val.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', k === '-iname' ? 'i' : ''); tests.push((p) => re.test(p.split('/').pop()!)); i++ } else if (k === '-type') { tests.push((_, n) => (val === 'd' ? n.type === 'dir' : n.type === 'file')); i++ } else if (k === '-user') { tests.push((_, n) => n.owner === val); i++ } else if (k === '-perm') { const m = parseInt(val.replace(/^[-/]/, ''), 8); tests.push((_, n) => (val.startsWith('-') ? (n.mode & m) === m : val.startsWith('/') ? !!(n.mode & m) : (n.mode & 0o7777) === m)); i++ } else if (k === '-size') { const m = /^([+-]?)(\d+)([ckM]?)$/.exec(val); if (m) { const b = +m[2] * ({ c: 1, k: 1024, M: 1048576, '': 512 }[m[3]] ?? 1); tests.push((_, n) => n.type === 'file' && (m[1] === '+' ? (n.content ?? '').length > b : m[1] === '-' ? (n.content ?? '').length < b : (n.content ?? '').length === b)) } i++ } else if (k === '-maxdepth') { maxd = +val; i++ } else if (k === '-delete') del = true; else if (k === '-print' || k === '-o') continue; else if (k === '-mtime' || k === '-newer') i++; else if (k === '-exec') { return { err: 'find: -exec bu sandboxda yo\'q — o\'rniga: find ... | xargs BUYRUQ\n' } } else return { err: `find: noma'lum predikat '${k}'\n` } }
      let out = ''; const hits: string[] = []
      for (const p of paths.length ? paths : ['.']) { const base = p.split('/').filter(Boolean).length; this.walk(p, (pp, n) => { if (pp.split('/').filter(Boolean).length - base <= maxd && tests.every((t) => t(pp, n))) { hits.push(pp); out += pp + '\n' } }) }
      if (del) { for (const h of hits.reverse()) this.cmds.rm(['-rf', h], ''); return {} }
      return { out }
    },
    du: (a) => { const { f, rest } = this.flags(a); const p = rest[0] ?? '.'; const n = this.node(p); if (!n) return { err: `du: '${p}': topilmadi\n` }; const sz = (x: VNode) => (f.has('h') ? this.human(this.size(x)) : String(Math.ceil(this.size(x) / 1024))); if (f.has('s') || n.type === 'file') return { out: `${sz(n)}\t${p}\n` }; return { out: Object.keys(n.children!).sort().map((k) => `${sz(n.children![k])}\t${p.replace(/\/$/, '')}/${k}`).join('\n') + `\n${sz(n)}\t${p}\n` } },
    df: (a) => ({ out: a.includes('-i') ? 'Fayl tizimi    Inodelar  Band   Bo\'sh  Band% Ulangan joy\n/dev/vda1      2560000  412044 2147956  17% /\n/dev/vdb1       655360  655360       0 100% /data\n' : a.some((x) => x.includes('h')) ? 'Fayl tizimi    Hajm  Band  Bo\'sh Band% Ulangan joy\n/dev/vda1       40G   31G  7.1G  82% /\ntmpfs          2.0G     0  2.0G   0% /dev/shm\n/dev/vdb1      100G   41G   54G  44% /data\n' : 'Fayl tizimi    1K-bloklar     Band    Bo\'sh Band% Ulangan joy\n/dev/vda1        41152736 32505856  7437824  82% /\n/dev/vdb1       103081248 42991616 56620032  44% /data\n' }),
    free: (a) => ({ out: a.some((x) => x.includes('h')) ? '               jami        band        bo\'sh     umumiy  buf/kesh   mavjud\nXotira:        3.8Gi       2.9Gi       212Mi       18Mi       742Mi       652Mi\nSwap:             0B          0B          0B\n' : '               jami        band        bo\'sh     umumiy  buf/kesh   mavjud\nXotira:      4028508     3051220      217332       18904      759956      668120\nSwap:              0           0           0\n' }),
    ps: (a) => { const all = a.some((x) => /a|e|x/.test(x)); const ps = this.procs.filter((p) => all || p.user === this.user); return { out: 'USER       PID %CPU %MEM COMMAND\n' + ps.map((p) => `${p.user.padEnd(9)}${pad(p.pid, 5)} ${pad(p.cpu.toFixed(1), 4)} ${pad(p.mem.toFixed(1), 4)} ${p.cmd}`).join('\n') + '\n' } },
    top: () => ({ out: 'top - 09:12:44 up 12 days, load average: 0.42, 0.31, 0.27\nVazifalar: ' + this.procs.length + ' jami\n%Cpu(s): ' + this.procs.reduce((s, p) => s + p.cpu, 0).toFixed(1) + ' us\n\n  PID USER      %CPU %MEM COMMAND\n' + [...this.procs].sort((x, y) => y.cpu - x.cpu).map((p) => `${pad(p.pid, 5)} ${p.user.padEnd(9)}${pad(p.cpu.toFixed(1), 5)} ${pad(p.mem.toFixed(1), 4)} ${p.cmd}`).join('\n') + '\n' }),
    kill: (a) => { const sig = a.find((x) => x.startsWith('-')) ?? '-15'; if (sig === '-l') return { out: ' 1) SIGHUP   2) SIGINT   9) SIGKILL  15) SIGTERM  18) SIGCONT  19) SIGSTOP\n' }; let err = ''; for (const x of a.filter((y) => !y.startsWith('-'))) { const p = this.procs.find((q) => q.pid === +x); if (!p) { err += `bash: kill: (${x}) - Bunday jarayon yo'q\n`; continue } if (p.user !== this.user && this.user !== 'root') { err += `bash: kill: (${x}) - Amalga ruxsat yo'q\n`; continue } if (p.pid === 1) { err += 'kill: PID 1 (init) signallarni e\'tiborsiz qoldiradi\n'; continue } this.procs = this.procs.filter((q) => q !== p); const u = this.units.find((k) => k.pid === p.pid); if (u) { u.active = false; u.pid = undefined; u.log.push(`${u.name}.service: Main process exited, code=killed, status=${sig.replace('-', '') === '9' || sig === '-KILL' ? '9/KILL' : '15/TERM'}`) } } return { err } },
    systemctl: (a) => {
      const [act, raw] = a.filter((x) => !x.startsWith('-')); const name = raw?.replace(/\.service$/, ''); const u = this.units.find((x) => x.name === name)
      if (act === 'list-units' || !act) return { out: 'UNIT            LOAD   ACTIVE   SUB     DESCRIPTION\n' + this.units.map((x) => `${(x.name + '.service').padEnd(16)}loaded ${x.active ? 'active   running' : 'inactive dead   '} ${x.desc}`).join('\n') + '\n' }
      if (act === 'daemon-reload') return this.user === 'root' ? {} : { err: 'Failed to reload daemon: Access denied (sudo kerak)\n' }
      if (!u) return { err: `Unit ${raw ?? ''}.service could not be found.\n`, code: 4 }
      if (act === 'status') return { out: `${u.active ? '●' : '○'} ${u.name}.service - ${u.desc}\n     Loaded: loaded (/etc/systemd/system/${u.name}.service; ${u.enabled ? 'enabled' : 'disabled'})\n     Active: ${u.active ? 'active (running)' : u.log.some((l) => l.includes('FAILURE')) && !u.log[u.log.length - 1].startsWith('Stopped') ? 'failed (Result: exit-code)' : 'inactive (dead)'}\n${u.pid ? `   Main PID: ${u.pid}\n` : ''}\n${u.log.slice(-4).map((l) => `Noy 10 09:02:31 lab-server ${l}`).join('\n')}\n`, code: u.active ? 0 : 3 }
      if (act === 'is-active') return { out: (u.active ? 'active' : 'inactive') + '\n', code: u.active ? 0 : 3 }
      if (act === 'is-enabled') return { out: (u.enabled ? 'enabled' : 'disabled') + '\n', code: u.enabled ? 0 : 1 }
      if (this.user !== 'root') return { err: `Failed to ${act} ${u.name}.service: Interactive authentication required. (sudo kerak)\n` }
      const stop = () => { if (u.pid) this.procs = this.procs.filter((p) => p.pid !== u.pid); u.active = false; u.pid = undefined; u.log.push(`Stopped ${u.name}.service - ${u.desc}.`) }
      const start = (): Partial<Result> => { if (u.active) return {}; if (u.name === 'myapp' && !this.node('/opt/myapp/app.py')) { u.log.push(`${u.name}.service: Changing to the requested working directory failed: No such file or directory`, `${u.name}.service: Failed at step CHDIR spawning /usr/bin/python3: No such file or directory`, `${u.name}.service: Main process exited, code=exited, status=200/CHDIR`); return { err: `Job for ${u.name}.service failed because the control process exited with error code.\nSee "systemctl status ${u.name}.service" and "journalctl -xeu ${u.name}.service" for details.\n` } } u.active = true; u.pid = this.nextPid++; this.procs.push({ pid: u.pid, user: u.name === 'myapp' ? 'deploy' : 'root', cmd: u.name === 'myapp' ? '/usr/bin/python3 /opt/myapp/app.py' : u.name, cpu: 0.1, mem: 0.5 }); u.log.push(`Started ${u.name}.service - ${u.desc}.`); return {} }
      if (act === 'start') return start(); if (act === 'stop') { stop(); return {} } if (act === 'restart' || act === 'reload') { if (u.active) stop(); return start() }
      if (act === 'enable') { u.enabled = true; return { out: `Created symlink /etc/systemd/system/multi-user.target.wants/${u.name}.service → /etc/systemd/system/${u.name}.service.\n` } } if (act === 'disable') { u.enabled = false; return { out: `Removed "/etc/systemd/system/multi-user.target.wants/${u.name}.service".\n` } }
      return { err: `Unknown command verb ${act}.\n` }
    },
    journalctl: (a) => { const { v } = this.flags(a, 'un'); const us = v.u ? this.units.filter((x) => x.name === v.u.replace(/\.service$/, '')) : this.units; if (v.u && !us.length) return { out: '-- No entries --\n' }; const l = us.flatMap((u) => u.log.map((x) => `Noy 10 09:02:31 lab-server ${u.name === 'myapp' ? 'myapp[3920]' : 'systemd[1]'}: ${x}`)); return { out: l.slice(-(+(v.n ?? 50))).join('\n') + '\n' } },
    ip: (a) => { const o = a.find((x) => !x.startsWith('-')) ?? ''; if (/^a/.test(o)) return { out: '1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536\n    inet 127.0.0.1/8 scope host lo\n2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500\n    link/ether 52:54:00:a1:b2:c3 brd ff:ff:ff:ff:ff:ff\n    inet 10.0.0.12/24 brd 10.0.0.255 scope global eth0\n' }; if (/^r/.test(o)) return { out: 'default via 10.0.0.1 dev eth0 proto dhcp metric 100\n10.0.0.0/24 dev eth0 proto kernel scope link src 10.0.0.12\n' }; if (/^l/.test(o)) return { out: '1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 state UNKNOWN\n2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 state UP\n' }; if (/^n/.test(o)) return { out: '10.0.0.1 dev eth0 lladdr 52:54:00:00:00:01 REACHABLE\n10.0.0.5 dev eth0 lladdr 52:54:00:00:00:05 STALE\n' }; return { err: 'Foydalanish: ip { addr | route | link | neigh }\n' } },
    ss: () => ({ out: 'Netid State  Local Address:Port  Process\ntcp   LISTEN 0.0.0.0:22          users:(("sshd",pid=411))\n' + (this.units[0].active ? 'tcp   LISTEN 0.0.0.0:80          users:(("nginx",pid=800))\n' : '') + (this.units[2].active ? 'tcp   LISTEN 127.0.0.1:8000      users:(("python3"))\n' : '') }),
    ping: (a) => { const h = a.filter((x) => !x.startsWith('-') && !/^\d+$/.test(x))[0]; if (!h) return { err: 'ping: manzil kerak\n' }; const known: Record<string, string> = { localhost: '127.0.0.1', 'db.internal': '10.0.0.5', '10.0.0.1': '10.0.0.1', '10.0.0.5': '10.0.0.5', '8.8.8.8': '8.8.8.8', '127.0.0.1': '127.0.0.1' }; if (!known[h]) return { err: `ping: ${h}: Nom yoki xizmat noma'lum (sandboxda internet yo'q)\n`, code: 2 }; return { out: `PING ${h} (${known[h]}) 56(84) bytes of data.\n` + [1, 2, 3].map((i) => `64 bytes from ${known[h]}: icmp_seq=${i} ttl=64 time=0.${3 + i}1 ms`).join('\n') + `\n\n--- ${h} ping statistics ---\n3 packets transmitted, 3 received, 0% packet loss\n` } },
    curl: (a) => { const u = a.find((x) => !x.startsWith('-')) ?? ''; const head = a.includes('-I'); if (/localhost(:80)?\/?$|127\.0\.0\.1(:80)?\/?$/.test(u)) return this.units[0].active ? { out: head ? 'HTTP/1.1 200 OK\nServer: nginx/1.24.0 (Ubuntu)\nContent-Type: text/html\n' : this.read('/var/www/html/index.html') } : { err: 'curl: (7) Failed to connect to localhost port 80: Connection refused\n', code: 7 }; if (/:8000/.test(u)) return this.units[2].active ? { out: '{"status":"ok"}\n' } : { err: 'curl: (7) Failed to connect to localhost port 8000: Connection refused\n', code: 7 }; return { err: `curl: (6) Could not resolve host (sandboxda tashqi tarmoq yo'q)\n`, code: 6 } },
    man: (a) => { const M: Record<string, string> = { ls: 'ls — katalog mazmunini ko\'rsatish\n  -l uzun format  -a yashirin fayllar  -h o\'qishga qulay hajm  -t vaqt bo\'yicha  -r teskari  -S hajm bo\'yicha', grep: 'grep — andoza bo\'yicha satrlarni qidirish\n  -i registrsiz  -v teskari  -n qator raqami  -c sanash  -r rekursiv  -E kengaytirilgan regex  -o faqat mos qism  -l faqat fayl nomlari', chmod: 'chmod — ruxsatlarni o\'zgartirish\n  chmod 755 fayl | chmod u+x fayl | chmod -R g-w katalog\n  r=4 w=2 x=1; u=egasi g=guruh o=boshqalar', find: 'find — fayllarni qidirish\n  find YO\'L -name "*.log" -type f -size +1k -user root -perm 644 -maxdepth 2 [-delete]', systemctl: 'systemctl — systemd servislarini boshqarish\n  status|start|stop|restart|enable|disable|is-active NOM', sed: 'sed — oqim muharriri\n  sed \'s/eski/yangi/g\' fayl | sed -i ... (faylni o\'zgartiradi) | sed \'3d\' | sed -n \'2,5p\'', awk: 'awk — maydonlar bilan ishlash\n  awk \'{print $1}\' | awk -F: \'{print $1, $7}\' /etc/passwd | awk \'$9 == 500 {print $7}\'' }; return a[0] && M[a[0]] ? { out: M[a[0]] + '\n' } : { err: a[0] ? `${a[0]} uchun qo'llanma yo'q. Mavjud: ${Object.keys(M).join(', ')}\n` : 'Qaysi qo\'llanma kerak? Masalan: man grep\n' } },
    true: () => ({ code: 0 }), false: () => ({ code: 1 }), sleep: () => ({}), exit: () => ({ out: 'Bu virtual terminal — chiqish shart emas 🙂\n' })
  }
  private human(n: number) { return n < 1024 ? `${n}` : n < 1048576 ? `${(n / 1024).toFixed(1)}K` : `${(n / 1048576).toFixed(1)}M` }
}

export interface ShellTask { id: string; title: string; goal: string; hint: string; check: (sh: VShell, last: { line: string; out: string }) => boolean }
export const SHELL_TASKS: ShellTask[] = [
  { id: 't1', title: 'Atrofni o\'rganish', goal: 'Uy katalogidagi BARCHA fayllarni (yashirinlarini ham) uzun formatda ko\'rsating.', hint: 'ls ning ikki bayrog\'i kerak: biri uzun format, biri yashirin fayllar uchun.', check: (_, l) => /^(sudo )?(ls|ll)\b/.test(l.line) && l.out.includes('.bashrc') && /^[-d]rw/m.test(l.out) },
  { id: 't2', title: 'Katalog yaratish', goal: '~/loyiha/config/prod katalogini bitta buyruq bilan yarating (config hali mavjud emas).', hint: 'mkdir oraliq kataloglarni ham yaratishi uchun -p kerak.', check: (sh) => sh.node('/home/talaba/loyiha/config/prod')?.type === 'dir' },
  { id: 't3', title: 'Xatolarni sanash', goal: '~/loyiha/logs/app.log faylida "ERROR" so\'zi bor qatorlar sonini chiqaring.', hint: 'grep -c yoki grep ... | wc -l', check: (_, l) => /grep/.test(l.line) && l.out.trim().split(/\s+/)[0] === '2' },
  { id: 't4', title: 'Skriptni ishga tushirish', goal: '~/loyiha/deploy.sh ga bajarish ruxsatini bering va ./deploy.sh bilan ishga tushiring.', hint: 'chmod +x (yoki u+x), keyin ./deploy.sh', check: (sh, l) => !!((sh.node('/home/talaba/loyiha/deploy.sh')?.mode ?? 0) & 0o100) && /deploy\.sh/.test(l.line) && l.out.includes('Deploy boshlandi') },
  { id: 't5', title: 'Maxfiy faylni himoyalash', goal: '~/loyiha/.env fayli hamma uchun ochiq (666). Uni faqat egasi o\'qiy va yoza oladigan qiling.', hint: 'Sakkizlik: egasi rw = 6, qolganlarga 0.', check: (sh) => ((sh.node('/home/talaba/loyiha/.env')?.mode ?? 0) & 0o777) === 0o600 },
  { id: 't6', title: 'Eng faol IP', goal: '/var/log/nginx/access.log dan eng ko\'p so\'rov yuborgan IP ni toping: natijaning BIRINCHI qatorida son va IP bo\'lsin. (Fayl egasi www-data — o\'qish uchun sudo kerak.)', hint: 'sudo cat ... | awk \'{print $1}\' | sort | uniq -c | sort -rn | head -1', check: (_, l) => /^\s*5\s+203\.0\.113\.7/.test(l.out) },
  { id: 't7', title: 'Konfiguratsiyani tahrirlash', goal: '/etc/ssh/sshd_config da "PermitRootLogin yes" ni "PermitRootLogin no" ga almashtiring (faylning o\'zida).', hint: 'sudo sed -i \'s/eski/yangi/\' fayl', check: (sh) => { try { const u = sh.user; sh.user = 'root'; const c = sh.read('/etc/ssh/sshd_config'); sh.user = u; return /PermitRootLogin no/.test(c) && !/PermitRootLogin yes/.test(c) } catch { return false } } },
  { id: 't8', title: 'Loglarni topish', goal: '/var ichidagi barcha *.log fayllarini toping (ruxsat xatolari ko\'rinmasin).', hint: 'find /var -name "*.log" 2>/dev/null — yoki sudo bilan.', check: (_, l) => /find/.test(l.line) && l.out.includes('/var/log/nginx/access.log') && l.out.includes('error.log') },
  { id: 't9', title: 'Yeb qo\'yuvchi jarayon', goal: 'CPU ni 97% band qilgan jarayonni toping va uni to\'xtating.', hint: 'ps aux yoki top; jarayon boshqa foydalanuvchiniki — sudo kill PID.', check: (sh) => !sh.procs.some((p) => p.pid === 3811) },
  { id: 't10', title: 'Servisni tiklash', goal: 'myapp servisi ishlamayapti. Sababini aniqlang (status/journalctl), tuzating va servis "active" bo\'lsin.', hint: 'Xato: WorkingDirectory mavjud emas. /opt/myapp katalogini va app.py ni yarating (masalan ~/loyiha/app.py dan nusxalang), so\'ng sudo systemctl start myapp.', check: (sh) => !!sh.units.find((u) => u.name === 'myapp')?.active },
  { id: 't11', title: 'Yo\'naltirish', goal: 'ls /etc /yoq buyrug\'ining ham chiqishi, ham xatosini bitta ~/natija.txt fayliga yozing.', hint: 'Avval > fayl, keyin 2>&1. Tartib muhim!', check: (sh) => { try { const c = sh.read('/home/talaba/natija.txt'); return c.includes('hostname') && /yo'q/.test(c) } catch { return false } } },
  { id: 't12', title: 'Tizim foydalanuvchilari', goal: '/etc/passwd dan kirish qobig\'i /bin/bash bo\'lgan foydalanuvchilar nomlarini (faqat nom) chiqaring.', hint: 'grep bash /etc/passwd | cut -d: -f1 — yoki awk -F: bilan.', check: (_, l) => { const o = l.out.trim().split('\n').sort().join(','); return o === 'deploy,root,talaba' } }
]
