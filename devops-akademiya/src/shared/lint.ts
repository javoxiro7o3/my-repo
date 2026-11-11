import { parseAllDocuments } from 'yaml'

export interface Finding { line: number; severity: 'error' | 'warning' | 'info'; rule: string; message: string }
const F = (line: number, severity: Finding['severity'], rule: string, message: string): Finding => ({ line, severity, rule, message })
const lineOf = (src: string, re: RegExp, from = 0) => { const l = src.split('\n'); for (let i = from; i < l.length; i++) if (re.test(l[i])) return i + 1; return 1 }

export function lintDockerfile(src: string): Finding[] {
  const out: Finding[] = [], lines = src.split('\n')
  const VALID = ['FROM', 'RUN', 'CMD', 'LABEL', 'EXPOSE', 'ENV', 'ADD', 'COPY', 'ENTRYPOINT', 'VOLUME', 'USER', 'WORKDIR', 'ARG', 'ONBUILD', 'STOPSIGNAL', 'HEALTHCHECK', 'SHELL', 'MAINTAINER']
  let seenFrom = false, user = '', hasHealth = false, lastFrom = 0, cont = false, cmdCount = 0, copyAllLine = 0
  lines.forEach((raw, i) => {
    const n = i + 1, line = raw.trim()
    const wasCont = cont; cont = /\\\s*$/.test(line)
    if (!line || line.startsWith('#') || wasCont) return
    const [ins0, ...rest] = line.split(/\s+/); const ins = ins0.toUpperCase(), arg = rest.join(' ')
    if (!VALID.includes(ins)) return void out.push(F(n, 'error', 'sintaksis', `Noma'lum instruksiya: "${ins0}"`))
    if (ins0 !== ins) out.push(F(n, 'info', 'uslub', 'Instruksiyalarni KATTA harflar bilan yozish qabul qilingan'))
    if (!seenFrom && ins !== 'FROM' && ins !== 'ARG') out.push(F(n, 'error', 'sintaksis', 'Dockerfile FROM bilan boshlanishi kerak (undan oldin faqat ARG mumkin)'))
    if (!arg && ins !== 'HEALTHCHECK') out.push(F(n, 'error', 'sintaksis', `${ins} argument talab qiladi`))
    if (ins === 'FROM') { seenFrom = true; lastFrom = n; user = ''; hasHealth = false; cmdCount = 0; copyAllLine = 0; const img = rest[0] ?? ''; if (img !== 'scratch' && !img.includes('$')) { if (/:latest$/.test(img)) out.push(F(n, 'warning', 'versiya', '":latest" tegi takrorlanuvchan build ni buzadi — aniq versiyani qotiring (masalan node:22.11-alpine)')); else if (!/[:@]/.test(img) && !rest.includes('AS') || (!/[:@]/.test(img) && rest.includes('AS') && !/^\w+$/.test(img) === false && !lines.some((l) => new RegExp(`AS\\s+${img}\\b`, 'i').test(l)))) out.push(F(n, 'warning', 'versiya', `Image tegi ko'rsatilmagan — "${img}" aslida "${img}:latest" degani`)) } }
    if (ins === 'MAINTAINER') out.push(F(n, 'warning', 'eskirgan', 'MAINTAINER eskirgan — LABEL org.opencontainers.image.authors="..." ishlating'))
    if (ins === 'ADD' && !/https?:\/\/|\.tar|\.tgz|\.gz|\.xz/.test(arg)) out.push(F(n, 'warning', 'best-practice', 'Oddiy nusxalash uchun COPY ishlating; ADD faqat arxivni ochish yoki URL uchun'))
    if ((ins === 'COPY' || ins === 'ADD') && /^(--\S+\s+)*\.\/?\s+\S+/.test(arg) && !/--from=/.test(arg)) copyAllLine = n
    if (ins === 'RUN') {
      if (copyAllLine && /(npm (ci|install|i)\b|pip3? install|yarn install|pnpm install|go mod download|bundle install|composer install)/.test(arg)) out.push(F(n, 'warning', 'kesh', `Bog'liqliklar "COPY . ." (${copyAllLine}-qator) dan keyin o'rnatilmoqda — har kod o'zgarishida kesh buziladi. Avval faqat manifest fayllarni (package.json, requirements.txt) nusxalang`))
      if (/apt-get install/.test(arg) && !/apt-get update/.test(arg)) out.push(F(n, 'warning', 'kesh', '"apt-get update" va "install" bitta RUN da bo\'lishi kerak — aks holda eskirgan indeks keshlanadi'))
      if (/apt-get install/.test(arg) && !/-y\b|--yes|-qq/.test(arg)) out.push(F(n, 'error', 'build', 'apt-get install uchun -y kerak — build interaktiv savolda osilib qoladi'))
      if (/apt-get install/.test(arg) && !/rm -rf \/var\/lib\/apt\/lists/.test(arg + lines.slice(i, i + 6).join(' '))) out.push(F(n, 'info', 'hajm', 'Qatlam hajmini kamaytirish: shu RUN oxirida "&& rm -rf /var/lib/apt/lists/*"; --no-install-recommends ni ham qo\'shing'))
      if (/\bsudo\b/.test(arg)) out.push(F(n, 'warning', 'best-practice', 'sudo kerak emas — build sukut bo\'yicha root; huquqni pasaytirish uchun USER ishlating'))
      if (/curl[^|]*\|\s*(ba)?sh/.test(arg)) out.push(F(n, 'warning', 'xavfsizlik', 'curl | sh — tekshirilmagan skriptni bajarish. Versiyani qotiring va checksum ni tekshiring'))
      if (/pip3? install/.test(arg) && !/--no-cache-dir/.test(arg)) out.push(F(n, 'info', 'hajm', 'pip install --no-cache-dir image hajmini kamaytiradi'))
      if (/\bcd\s+\S+/.test(arg) && !/&&/.test(arg)) out.push(F(n, 'warning', 'mantiq', '"RUN cd ..." keyingi instruksiyaga ta\'sir qilmaydi — WORKDIR ishlating'))
      if (/chmod\s+(-R\s+)?777/.test(arg)) out.push(F(n, 'warning', 'xavfsizlik', 'chmod 777 — hamma yoza oladi. Aniq egalik (COPY --chown) va minimal ruxsat bering'))
    }
    if ((ins === 'ENV' || ins === 'ARG') && /(PASSWORD|SECRET|TOKEN|API_?KEY|PRIVATE_KEY)\w*\s*[= ]\s*\S+/i.test(arg) && !/=\s*("")?$/.test(arg)) out.push(F(n, 'error', 'xavfsizlik', `Sir ${ins} da qoladi: "docker history" va image ichida ochiq ko'rinadi. Runtime da (-e, secrets) yoki RUN --mount=type=secret orqali bering`))
    if (ins === 'USER') user = arg
    if (ins === 'HEALTHCHECK') hasHealth = true
    if (ins === 'CMD' || ins === 'ENTRYPOINT') { if (ins === 'CMD') cmdCount++; if (!/^\[/.test(arg)) out.push(F(n, 'warning', 'signallar', `${ins} shell form da: jarayon "/bin/sh -c" ostida ishlaydi va SIGTERM ni olmaydi (docker stop 10 s kutib SIGKILL qiladi). Exec form: ${ins} ["dastur", "arg"]`)); else { try { const j = JSON.parse(arg); if (!Array.isArray(j)) throw 0 } catch { out.push(F(n, 'error', 'sintaksis', 'Exec form to\'g\'ri JSON massiv bo\'lishi kerak — qo\'shtirnoq (") ishlating, bittalik (\') emas')) } } if (ins === 'CMD' && cmdCount > 1) out.push(F(n, 'warning', 'mantiq', 'Bir bosqichda bir nechta CMD — faqat oxirgisi ishlaydi')) }
    if (ins === 'EXPOSE') for (const p of rest) if (!/^\d+(\/(tcp|udp))?$/.test(p) && !p.includes('$')) out.push(F(n, 'error', 'sintaksis', `Noto'g'ri port: "${p}"`)); else if (parseInt(p) > 65535) out.push(F(n, 'error', 'sintaksis', `Port 65535 dan katta bo'lolmaydi: ${p}`))
    if (ins === 'WORKDIR' && !/^[/$]|^[A-Za-z]:/.test(arg)) out.push(F(n, 'warning', 'best-practice', 'WORKDIR uchun absolyut yo\'l ishlating'))
  })
  if (!seenFrom) out.push(F(1, 'error', 'sintaksis', 'FROM instruksiyasi yo\'q'))
  else {
    if (!user || /^(root|0)(:|$)/.test(user)) out.push(F(lastFrom, 'warning', 'xavfsizlik', 'Konteyner root sifatida ishlaydi. Yakuniy bosqichga USER qo\'shing (masalan USER node yoki USER 10001)'))
    if (!hasHealth) out.push(F(lastFrom, 'info', 'ishonchlilik', 'HEALTHCHECK yo\'q — Docker/Swarm ilova sog\'lig\'ini bila olmaydi (Kubernetes da probe lar ishlatiladi)'))
  }
  return out.sort((a, b) => a.line - b.line)
}

export function lintYaml(src: string): Finding[] {
  const out: Finding[] = []
  src.split('\n').forEach((l, i) => { if (/^\s*\t/.test(l)) out.push(F(i + 1, 'error', 'sintaksis', 'YAML da chekinish uchun TAB ishlatib bo\'lmaydi — faqat bo\'sh joy (probel)') ) })
  let docs
  try { docs = parseAllDocuments(src, { prettyErrors: true }) } catch (e: any) { return [...out, F(1, 'error', 'sintaksis', String(e.message))] }
  for (const d of docs) {
    for (const e of d.errors) out.push(F(e.linePos?.[0].line ?? 1, 'error', 'sintaksis', e.message.split('\n')[0].replace(/ at line \d+, column \d+:?/, '')))
    for (const w of d.warnings) out.push(F(w.linePos?.[0].line ?? 1, 'warning', 'sintaksis', w.message.split('\n')[0]))
    if (d.errors.length) continue
    const o: any = d.toJS()
    if (!o || typeof o !== 'object') continue
    const L = (re: RegExp) => lineOf(src, re)
    if (o.apiVersion && o.kind) lintK8s(o, src, out)
    else if (o.services && typeof o.services === 'object') {
      if (o.version) out.push(F(L(/^version:/), 'info', 'eskirgan', 'Compose v2 da "version:" maydoni e\'tiborga olinmaydi (eskirgan) — olib tashlash mumkin'))
      for (const [name, s] of Object.entries<any>(o.services)) {
        const at = L(new RegExp(`^\\s{2}${name}:`))
        if (!s || typeof s !== 'object') { out.push(F(at, 'error', 'sxema', `"${name}" servisi bo'sh`)); continue }
        if (!s.image && !s.build) out.push(F(at, 'error', 'sxema', `"${name}": image yoki build ko'rsatilishi shart`))
        if (typeof s.image === 'string' && (/:latest$/.test(s.image) || !/[:@]/.test(s.image))) out.push(F(lineOf(src, /image:/, at - 1), 'warning', 'versiya', `"${name}": image versiyasi qotirilmagan (${s.image})`))
        if (s.privileged) out.push(F(lineOf(src, /privileged:/, at - 1), 'error', 'xavfsizlik', `"${name}": privileged: true — konteyner xost yadrosiga deyarli to'liq kirish oladi`))
        if (s.network_mode === 'host') out.push(F(lineOf(src, /network_mode:/, at - 1), 'warning', 'xavfsizlik', `"${name}": network_mode: host — tarmoq izolyatsiyasi yo'q`))
        if (!s.restart && !s.deploy) out.push(F(at, 'info', 'ishonchlilik', `"${name}": restart siyosati yo'q (masalan restart: unless-stopped)`))
        for (const p of Array.isArray(s.ports) ? s.ports : []) if (typeof p === 'string' && /^(0\.0\.0\.0:)?(5432|3306|6379|27017|9200|2379):/.test(p)) out.push(F(lineOf(src, new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), at - 1), 'warning', 'xavfsizlik', `"${name}": ma'lumotlar bazasi porti (${p}) barcha interfeyslarga ochilgan. "127.0.0.1:${p}" qiling yoki umuman publish qilmang — konteynerlar ichki tarmoq orqali ulanadi`))
        const env = Array.isArray(s.environment) ? s.environment.map(String) : Object.entries(s.environment ?? {}).map(([k, v]) => `${k}=${v}`)
        for (const e of env) if (/(PASSWORD|SECRET|TOKEN|API_?KEY)\w*=(?!\$\{?)(.+)/i.test(e)) out.push(F(lineOf(src, new RegExp(e.split('=')[0]), at - 1), 'warning', 'xavfsizlik', `"${name}": sir fayl ichida ochiq yozilgan (${e.split('=')[0]}). env_file, \${O'ZGARUVCHI} yoki secrets ishlating`))
        const deps = Array.isArray(s.depends_on) ? s.depends_on : Object.keys(s.depends_on ?? {})
        for (const dep of deps) { if (!o.services[dep]) out.push(F(lineOf(src, /depends_on:/, at - 1), 'error', 'sxema', `"${name}": depends_on dagi "${dep}" servisi mavjud emas`)); else if (Array.isArray(s.depends_on) && !o.services[dep].healthcheck) out.push(F(lineOf(src, /depends_on:/, at - 1), 'info', 'ishonchlilik', `"${name}": depends_on faqat ISHGA TUSHISH tartibini beradi, "${dep}" tayyorligini kutmaydi. healthcheck + condition: service_healthy qo'shing`)) }
        for (const v of Array.isArray(s.volumes) ? s.volumes : []) if (typeof v === 'string') { const [h] = v.split(':'); if (h === '/var/run/docker.sock') out.push(F(lineOf(src, /docker\.sock/), 'error', 'xavfsizlik', `"${name}": docker.sock ulangan — bu xostda root huquqiga teng`)); else if (!/^[./~$]/.test(h) && v.includes(':') && !(o.volumes && h in o.volumes)) out.push(F(lineOf(src, new RegExp(h + ':'), at - 1), 'error', 'sxema', `"${name}": "${h}" nomli volume yuqori darajadagi "volumes:" da e'lon qilinmagan`)) }
      }
    }
  }
  return out.sort((a, b) => a.line - b.line)
}

function lintK8s(o: any, src: string, out: Finding[]) {
  const L = (re: RegExp, from = 0) => lineOf(src, re, from)
  if (!o.metadata?.name) out.push(F(L(/metadata:/), 'error', 'sxema', 'metadata.name majburiy'))
  const API: Record<string, string> = { Deployment: 'apps/v1', StatefulSet: 'apps/v1', DaemonSet: 'apps/v1', ReplicaSet: 'apps/v1', Ingress: 'networking.k8s.io/v1', CronJob: 'batch/v1', Job: 'batch/v1', Service: 'v1', Pod: 'v1', ConfigMap: 'v1', Secret: 'v1', NetworkPolicy: 'networking.k8s.io/v1', HorizontalPodAutoscaler: 'autoscaling/v2', PodDisruptionBudget: 'policy/v1' }
  if (API[o.kind] && o.apiVersion !== API[o.kind]) out.push(F(L(/apiVersion:/), 'error', 'sxema', `${o.kind} uchun apiVersion "${API[o.kind]}" bo'lishi kerak ("${o.apiVersion}" ${/beta/.test(o.apiVersion) ? 'eskirgan/olib tashlangan' : 'noto\'g\'ri'})`))
  const tpl = o.kind === 'Pod' ? o : o.kind === 'CronJob' ? o.spec?.jobTemplate?.spec?.template : o.spec?.template
  if (['Deployment', 'StatefulSet', 'DaemonSet', 'ReplicaSet'].includes(o.kind)) {
    const sel = o.spec?.selector?.matchLabels, lab = tpl?.metadata?.labels
    if (!sel) out.push(F(L(/spec:/), 'error', 'sxema', 'spec.selector.matchLabels majburiy'))
    else if (!lab || !Object.entries(sel).every(([k, v]) => lab[k] === v)) out.push(F(L(/matchLabels:/), 'error', 'mantiq', `selector (${JSON.stringify(sel)}) Pod shabloni label lariga (${JSON.stringify(lab ?? {})}) mos kelmaydi — API buni rad etadi`))
    if (o.kind === 'Deployment' && (o.spec?.replicas ?? 1) < 2) out.push(F(L(/replicas:|spec:/), 'info', 'ishonchlilik', 'replicas < 2: bitta Pod — node yangilanishi yoki nosozlikda uzilish'))
  }
  if (o.kind === 'Service') { if (!o.spec?.selector && o.spec?.type !== 'ExternalName') out.push(F(L(/spec:/), 'warning', 'mantiq', 'Service da selector yo\'q — Endpoints qo\'lda yaratilmasa trafik hech qayerga bormaydi')); for (const p of o.spec?.ports ?? []) if (p.nodePort && (p.nodePort < 30000 || p.nodePort > 32767)) out.push(F(L(/nodePort:/), 'error', 'sxema', `nodePort ${p.nodePort} ruxsat etilgan oraliqdan tashqarida (30000–32767)`)) }
  if (o.kind === 'Secret' && o.stringData) out.push(F(L(/stringData:/), 'warning', 'xavfsizlik', 'Secret qiymatlari manifestda ochiq. Git ga qo\'ymang — Sealed Secrets / External Secrets / SOPS ishlating'))
  if (o.kind === 'Ingress' && !o.spec?.ingressClassName) out.push(F(L(/spec:/), 'warning', 'mantiq', 'ingressClassName ko\'rsatilmagan — default IngressClass bo\'lmasa hech bir controller bu Ingress ni olmaydi'))
  const spec = tpl?.spec
  if (!spec) return
  if (!Array.isArray(spec.containers) || !spec.containers.length) return void out.push(F(L(/spec:/), 'error', 'sxema', 'containers ro\'yxati bo\'sh yoki yo\'q'))
  if (spec.hostNetwork) out.push(F(L(/hostNetwork:/), 'warning', 'xavfsizlik', 'hostNetwork: true — Pod node ning tarmoq namespace ida ishlaydi'))
  for (const c of spec.containers) {
    const at = L(new RegExp(`name:\\s*["']?${c.name}["']?\\s*$`))
    if (!c.image) out.push(F(at, 'error', 'sxema', `"${c.name}": image majburiy`))
    else if (/:latest$/.test(c.image) || !/[:@]/.test(c.image)) out.push(F(L(/image:/, at - 1), 'warning', 'versiya', `"${c.name}": image tegi qotirilmagan (${c.image}) — rollback va takrorlanuvchanlik buziladi; imagePullPolicy ham Always bo'lib qoladi`))
    if (!c.resources?.requests) out.push(F(at, 'warning', 'resurslar', `"${c.name}": resources.requests yo'q — scheduler ko'r-ko'rona joylaydi, QoS = BestEffort (birinchi bo'lib evict qilinadi), HPA ishlamaydi`))
    if (!c.resources?.limits?.memory) out.push(F(at, 'warning', 'resurslar', `"${c.name}": memory limit yo'q — xotira oqishi butun node ni ishdan chiqarishi mumkin`))
    const mem = (s: any) => { const m = /^(\d+(?:\.\d+)?)(Ki|Mi|Gi|M|G|k|m)?$/.exec(String(s ?? '')); return m ? +m[1] * ({ Ki: 1024, Mi: 1048576, Gi: 1073741824, M: 1e6, G: 1e9, k: 1e3, m: 0.001 }[m[2] ?? ''] ?? 1) : NaN }
    if (c.resources?.limits?.memory && /^\d+m$/.test(String(c.resources.limits.memory))) out.push(F(L(/memory:/, at - 1), 'error', 'mantiq', `"${c.name}": memory: ${c.resources.limits.memory} — "m" bu MILLI-bayt! Mebibayt uchun "Mi" yozing (masalan 512Mi)`))
    else if (mem(c.resources?.requests?.memory) > mem(c.resources?.limits?.memory)) out.push(F(L(/requests:/, at - 1), 'error', 'mantiq', `"${c.name}": requests.memory limits.memory dan katta — API rad etadi`))
    if (['Deployment', 'StatefulSet', 'DaemonSet'].includes(o.kind)) { if (!c.readinessProbe) out.push(F(at, 'warning', 'ishonchlilik', `"${c.name}": readinessProbe yo'q — Pod tayyor bo'lmasdan trafik oladi, rolling update da 502 lar bo'ladi`)); if (!c.livenessProbe) out.push(F(at, 'info', 'ishonchlilik', `"${c.name}": livenessProbe yo'q — osilib qolgan jarayon avtomatik qayta ishga tushmaydi`)) }
    const sc = c.securityContext ?? {}
    if (sc.privileged) out.push(F(L(/privileged:/, at - 1), 'error', 'xavfsizlik', `"${c.name}": privileged: true — konteyner node ni to'liq egallashi mumkin`))
    if (sc.allowPrivilegeEscalation !== false && !sc.privileged) out.push(F(at, 'info', 'xavfsizlik', `"${c.name}": securityContext.allowPrivilegeEscalation: false qo'shing`))
    if (!(sc.runAsNonRoot ?? spec.securityContext?.runAsNonRoot) && !(sc.runAsUser ?? spec.securityContext?.runAsUser)) out.push(F(at, 'warning', 'xavfsizlik', `"${c.name}": runAsNonRoot: true (yoki runAsUser) yo'q — konteyner root bo'lib ishlashi mumkin`))
    for (const e of c.env ?? []) if (e.value && /(PASSWORD|SECRET|TOKEN|API_?KEY)/i.test(e.name ?? '')) out.push(F(L(new RegExp(`name:\\s*${e.name}`)), 'error', 'xavfsizlik', `"${c.name}": ${e.name} manifestda ochiq yozilgan — valueFrom.secretKeyRef ishlating`))
    for (const p of c.ports ?? []) if (typeof p.containerPort !== 'number') out.push(F(L(/containerPort:/, at - 1), 'error', 'sxema', `"${c.name}": containerPort son bo'lishi kerak`))
  }
}

export function lintHcl(src: string): Finding[] {
  const out: Finding[] = [], lines = src.split('\n'); const stack: { ch: string; line: number }[] = []
  let inStr = false, heredoc = ''
  lines.forEach((raw, i) => {
    const n = i + 1
    if (heredoc) { if (raw.trim() === heredoc) heredoc = ''; return }
    const hd = /<<-?(\w+)\s*$/.exec(raw); const line = raw.replace(/(#|\/\/).*$/, (m, _a, off) => ((raw.slice(0, off).match(/"/g)?.length ?? 0) % 2 ? m : ''))
    for (let k = 0; k < line.length; k++) { const c = line[k]; if (c === '"' && line[k - 1] !== '\\') inStr = !inStr; if (inStr) continue; if ('{[('.includes(c)) stack.push({ ch: c, line: n }); if ('}])'.includes(c)) { const t = stack.pop(); if (!t || '{[('.indexOf(t.ch) !== '}])'.indexOf(c)) out.push(F(n, 'error', 'sintaksis', `Mos kelmagan qavs "${c}"${t ? ` (${t.line}-qatordagi "${t.ch}" uchun)` : ''}`)) } }
    if (inStr) { out.push(F(n, 'error', 'sintaksis', 'Yopilmagan qo\'shtirnoq')); inStr = false }
    if (hd) heredoc = hd[1]
    const t = line.trim()
    if (/^(resource|data)\s/.test(t) && !/^(resource|data)\s+"[\w-]+"\s+"[\w-]+"\s*\{/.test(t)) out.push(F(n, 'error', 'sintaksis', 'Format: resource "TUR" "NOM" { — ikkala nom ham qo\'shtirnoqda'))
    if (/^(variable|output|module|provider)\s/.test(t) && !/^\w+\s+"[\w.-]+"\s*\{/.test(t)) out.push(F(n, 'error', 'sintaksis', `Format: ${t.split(/\s/)[0]} "NOM" {`))
    if (/^\w+\s*:\s*\S/.test(t) && !/[?]/.test(t) && stack.length && stack[stack.length - 1].ch === '{' && !/=\s*\{/.test(lines[stack[stack.length - 1].line - 1])) out.push(F(n, 'error', 'sintaksis', 'HCL da argument "=" bilan beriladi, ":" emas (bu YAML/JSON emas)'))
    if (/"\$\{[\w.\[\]"*]+\}"\s*$/.test(t)) out.push(F(n, 'info', 'uslub', 'Ortiqcha interpolyatsiya: "${var.x}" o\'rniga shunchaki var.x yozing (Terraform 0.12+)'))
    if (/(password|secret|token|access_key|private_key)\s*=\s*"[^"$]{4,}"/i.test(t)) out.push(F(n, 'error', 'xavfsizlik', 'Sir kodda ochiq yozilgan — u state va Git da qoladi. sensitive variable, muhit o\'zgaruvchisi (TF_VAR_) yoki Vault ishlating'))
    if (/cidr_blocks\s*=\s*\[\s*"0\.0\.0\.0\/0"/.test(t)) { const ctx = lines.slice(Math.max(0, i - 6), i + 3).join('\n'); if (/ingress/.test(ctx) && /(from_port\s*=\s*(22|3389|0|5432|3306)\b)/.test(ctx)) out.push(F(n, 'error', 'xavfsizlik', 'Boshqaruv/DB porti butun internetga (0.0.0.0/0) ochilgan — aniq manba manzillar bilan cheklang')) }
    if (/^source\s*=\s*"(git::|github\.com)/.test(t) && !/\?ref=/.test(t)) out.push(F(n, 'warning', 'versiya', 'Git moduli versiyasi qotirilmagan — ?ref=v1.2.3 qo\'shing'))
    if (/acl\s*=\s*"public-read/.test(t)) out.push(F(n, 'warning', 'xavfsizlik', 'Bucket ommaga ochiq (public-read)'))
  })
  for (const t of stack) out.push(F(t.line, 'error', 'sintaksis', `"${t.ch}" yopilmagan`))
  if (heredoc) out.push(F(lines.length, 'error', 'sintaksis', `Heredoc "${heredoc}" yopilmagan`))
  if (/^\s*provider\s+"/m.test(src) && !/required_providers/.test(src)) out.push(F(lineOf(src, /^\s*provider\s+"/), 'warning', 'versiya', 'required_providers bloki yo\'q — provider versiyasini qotiring (terraform { required_providers { ... } })'))
  if (/^\s*module\s+"/m.test(src) && /source\s*=\s*"[\w-]+\/[\w-]+\/[\w-]+"/.test(src) && !/^\s*version\s*=/m.test(src)) out.push(F(lineOf(src, /^\s*module\s+"/), 'warning', 'versiya', 'Registry moduli uchun version ko\'rsatilmagan'))
  return out.sort((a, b) => a.line - b.line)
}

export const lint = (lang: string, src: string): Finding[] => (lang === 'dockerfile' ? lintDockerfile(src) : lang === 'hcl' ? lintHcl(src) : lintYaml(src))
