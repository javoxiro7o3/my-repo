import { lazy, Suspense, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, Lightbulb, Sparkles, XCircle } from 'lucide-react'
import { lint } from '@shared/lint'
import { cn } from '@/lib/utils'
import { useApp } from '@/store/app'
import { Button, Segmented } from '@/components/ui'

const Monaco = lazy(() => import('@/components/Monaco'))
const SAMPLE: Record<string, string> = {
  dockerfile: 'FROM python\nMAINTAINER dev@example.uz\nCOPY . /app\nRUN cd /app\nRUN pip install -r /app/requirements.txt\nRUN apt-get install curl\nENV DB_PASSWORD=qwerty123\nEXPOSE 8000\nCMD python /app/main.py\n',
  compose: 'version: "3.8"\nservices:\n  web:\n    image: myapp\n    ports:\n      - "8000:8000"\n    environment:\n      - SECRET_KEY=abc123xyz\n    depends_on:\n      - db\n      - cache\n    volumes:\n      - /var/run/docker.sock:/var/run/docker.sock\n  db:\n    image: postgres:16.4\n    ports:\n      - "5432:5432"\n    volumes:\n      - pgdata:/var/lib/postgresql/data\n',
  k8s: 'apiVersion: apps/v1beta1\nkind: Deployment\nmetadata:\n  name: api\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: api\n  template:\n    metadata:\n      labels:\n        app: backend\n    spec:\n      containers:\n        - name: api\n          image: registry.example.uz/api:latest\n          env:\n            - name: DB_PASSWORD\n              value: supersecret\n          resources:\n            limits:\n              memory: 512m\n          ports:\n            - containerPort: 8000\n',
  hcl: 'provider "aws" {\n  region = "eu-central-1"\n}\n\nresource "aws_security_group" web {\n  name: "web-sg"\n\n  ingress {\n    from_port   = 22\n    to_port     = 22\n    protocol    = "tcp"\n    cidr_blocks = ["0.0.0.0/0"]\n  }\n}\n\nresource "aws_db_instance" "main" {\n  engine   = "postgres"\n  password = "Pa$$w0rd2026"\n  username = "${var.db_user}"\n\n'
}
const KINDS = [{ value: 'dockerfile', label: 'Dockerfile' }, { value: 'compose', label: 'Compose' }, { value: 'k8s', label: 'Kubernetes' }, { value: 'hcl', label: 'Terraform' }] as const
const langOf = (k: string) => (k === 'dockerfile' ? 'dockerfile' : k === 'hcl' ? 'hcl' : 'yaml')

const EXERCISES = [
  { kind: 'k8s', title: 'Pod lar yaratilmayapti', symptom: 'kubectl apply: The Deployment "web" is invalid: spec.template.metadata.labels: Invalid value: `selector` does not match template `labels`', code: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web\nspec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: web\n  template:\n    metadata:\n      labels:\n        app: web-app\n    spec:\n      containers:\n        - name: web\n          image: nginx:1.27\n', bad: 12, why: 'selector.matchLabels (app: web) Pod shabloni label iga (app: web-app) mos kelmaydi. Deployment o\'z Pod larini aynan shu selector orqali "taniydi".' },
  { kind: 'dockerfile', title: 'Build 5 daqiqa oladi', symptom: 'Kodda bitta qator o\'zgarsa ham "npm ci" har safar qaytadan ishlaydi.', code: 'FROM node:22-alpine\nWORKDIR /app\nCOPY . .\nRUN npm ci\nRUN npm run build\nUSER node\nCMD ["node", "dist/main.js"]\n', bad: 3, why: '"COPY . ." butun kodni nusxalaydi — istalgan fayl o\'zgarsa shu qatlam va undan keyingi "npm ci" keshi buziladi. Avval: COPY package*.json ./ → RUN npm ci → keyin COPY . .' },
  { kind: 'compose', title: 'Ilova DB ga ulana olmayapti', symptom: 'web_1 | psycopg.OperationalError: connection to server at "localhost" (127.0.0.1), port 5432 failed: Connection refused', code: 'services:\n  web:\n    image: myapp:1.4.2\n    environment:\n      DATABASE_URL: postgres://app:${DB_PASS}@localhost:5432/app\n    depends_on:\n      - db\n  db:\n    image: postgres:16.4\n', bad: 5, why: 'Konteyner ichida "localhost" — shu konteynerning o\'zi. Compose tarmog\'ida servislar bir-birini SERVIS NOMI bilan topadi: @db:5432.' },
  { kind: 'k8s', title: 'Pod darhol OOMKilled', symptom: 'kubectl get pods: api-xxx  0/1  OOMKilled  3 restarts. Ilova odatda 300 MB ishlatadi.', code: 'apiVersion: v1\nkind: Pod\nmetadata:\n  name: api\nspec:\n  containers:\n    - name: api\n      image: registry.example.uz/api:2.3.1\n      resources:\n        requests:\n          cpu: 200m\n          memory: 256Mi\n        limits:\n          cpu: "1"\n          memory: 512m\n', bad: 15, why: '"512m" — 512 MILLI-bayt, ya\'ni ~0.5 bayt! To\'g\'risi "512Mi". CPU da "m" — millicore, xotirada esa bu deyarli nol degani.' },
  { kind: 'dockerfile', title: 'docker stop 10 soniya kutadi', symptom: 'Konteyner SIGTERM ga javob bermaydi, 10 s dan keyin SIGKILL bilan o\'ldiriladi; ochiq so\'rovlar uziladi.', code: 'FROM python:3.12-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY . .\nUSER 10001\nCMD gunicorn app:app --bind 0.0.0.0:8000\n', bad: 7, why: 'Shell form: PID 1 — "/bin/sh -c", gunicorn uning bolasi. sh signalni bolaga uzatmaydi. Exec form kerak: CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:8000"].' },
  { kind: 'hcl', title: 'terraform plan sintaksis xatosi', symptom: 'Error: Invalid argument name / Argument or block definition required', code: 'resource "digitalocean_droplet" "web" {\n  name   = "web-1"\n  region = "fra1"\n  size:    "s-1vcpu-1gb"\n  image  = "ubuntu-24-04-x64"\n}\n', bad: 4, why: 'HCL da argumentga qiymat "=" bilan beriladi. ":" — YAML/JSON odati.' },
  { kind: 'k8s', title: 'Service orqali ulanib bo\'lmayapti', symptom: 'curl http://web → Connection refused. Pod lar Running va Ready, ilova 8080-portda tinglaydi.', code: 'apiVersion: v1\nkind: Service\nmetadata:\n  name: web\nspec:\n  selector:\n    app: web\n  ports:\n    - port: 80\n      targetPort: 80\n', bad: 10, why: 'targetPort — Pod ICHIDAGI port. Ilova 8080 da tinglaydi, Service esa 80 ga yuboryapti. targetPort: 8080 bo\'lishi kerak (port: 80 — Service ning o\'z porti).' }
]

function FindBug() {
  const [i, setI] = useState(0)
  const [pick, setPick] = useState<number | null>(null)
  const [score, setScore] = useState({ ok: 0, all: 0 })
  const ex = EXERCISES[i]
  const choose = (n: number) => { if (pick !== null) return; setPick(n); setScore((s) => ({ ok: s.ok + (n === ex.bad ? 1 : 0), all: s.all + 1 })) }
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">{EXERCISES.map((e, k) => <button key={k} onClick={() => { setI(k); setPick(null) }} className={cn('chip hover:border-accent hover:text-fg', k === i && '!border-accent !text-fg')}>{k + 1}</button>)}<span className="chip ml-auto tabular-nums">{score.ok} / {score.all}</span></div>
      <div className="card p-5">
        <div className="label">{KINDS.find((k) => k.value === ex.kind)?.label}</div><h3 className="mt-1 text-lg font-semibold">{ex.title}</h3>
        <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-bad/30 bg-bad/[.07] px-3 py-2 font-mono text-[12px] text-bad">{ex.symptom}</pre>
        <p className="mt-3 text-sm text-muted">Xato qaysi qatorda? Qatorni bosing.</p>
        <div className="mt-2 overflow-hidden rounded-xl border bg-panel font-mono text-[13px]" role="listbox" aria-label="Kod qatorlari">
          {ex.code.trimEnd().split('\n').map((l, k) => { const n = k + 1, st = pick === null ? '' : n === ex.bad ? 'ok' : n === pick ? 'bad' : ''; return (
            <button key={k} role="option" aria-selected={pick === n} onClick={() => choose(n)} disabled={pick !== null} className={cn('flex w-full gap-3 px-3 py-0.5 text-left transition', pick === null && 'hover:bg-accent/10', st === 'ok' && 'bg-ok/15', st === 'bad' && 'bg-bad/15')}><span className="w-6 select-none text-right text-faint">{n}</span><span className="whitespace-pre">{l || ' '}</span>{st === 'ok' && <CheckCircle2 size={14} className="ml-auto mt-1 shrink-0 text-ok" />}{st === 'bad' && <XCircle size={14} className="ml-auto mt-1 shrink-0 text-bad" />}</button>
          ) })}
        </div>
        {pick !== null && <div className={cn('mt-4 rounded-lg border-l-[3px] px-4 py-3 text-[13.5px] leading-relaxed', pick === ex.bad ? 'border-ok bg-ok/[.08]' : 'border-bad bg-bad/[.08]')} role="status"><b className={pick === ex.bad ? 'text-ok' : 'text-bad'}>{pick === ex.bad ? 'To\'g\'ri!' : `Yo'q — xato ${ex.bad}-qatorda.`}</b> {ex.why}{i < EXERCISES.length - 1 && <div className="mt-3"><Button size="sm" variant="primary" onClick={() => { setI(i + 1); setPick(null) }}>Keyingi mashq →</Button></div>}</div>}
      </div>
    </div>
  )
}

export default function Validator() {
  const [tab, setTab] = useState<'lint' | 'bug'>('lint')
  const [kind, setKind] = useState<(typeof KINDS)[number]['value']>('dockerfile')
  const [code, setCode] = useState(SAMPLE.dockerfile)
  const askAi = useApp((s) => s.askAi)
  const findings = useMemo(() => lint(langOf(kind), code), [kind, code])
  const cnt = (s: string) => findings.filter((f) => f.severity === s).length
  const IC = { error: <XCircle size={14} className="text-bad" />, warning: <AlertTriangle size={14} className="text-warn" />, info: <Info size={14} className="text-info" /> }
  return (
    <div className="space-y-5">
      <Segmented label="Rejim" value={tab} onChange={setTab} options={[{ value: 'lint', label: 'Validator' }, { value: 'bug', label: '"Xatoni top" mashqlari' }]} />
      {tab === 'bug' ? <FindBug /> : (
        <div className="grid gap-5 @5xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2"><Segmented label="Fayl turi" value={kind} onChange={(k) => { setKind(k); setCode(SAMPLE[k]) }} options={KINDS as any} /><Button size="sm" variant="ghost" onClick={() => setCode('')}>Tozalash</Button><Button size="sm" variant="ghost" onClick={() => setCode(SAMPLE[kind])}>Namuna</Button></div>
            <Suspense fallback={<div className="skeleton h-[480px] rounded-xl" />}><Monaco value={code} onChange={setCode} language={langOf(kind)} height="min(64vh, 620px)" markers={findings} /></Suspense>
          </div>
          <div className="space-y-3">
            <div className="card flex items-center gap-4 px-4 py-3 text-sm"><span className="flex items-center gap-1.5">{IC.error} <b>{cnt('error')}</b> xato</span><span className="flex items-center gap-1.5">{IC.warning} <b>{cnt('warning')}</b> ogohlantirish</span><span className="flex items-center gap-1.5">{IC.info} <b>{cnt('info')}</b> maslahat</span>
              <Button size="sm" className="ml-auto" disabled={!code.trim()} onClick={() => askAi(`Shu ${KINDS.find((k) => k.value === kind)?.label} faylini review qil: xavfsizlik, ishonchlilik va best-practice bo'yicha. Tuzatilgan to'liq variantni ber.`, code)}><Sparkles size={13} /> AI review</Button></div>
            {!code.trim() ? <div className="card p-8 text-center text-sm text-muted">Konfiguratsiyani yozing yoki joylashtiring.</div> : !findings.length ? <div className="card flex items-center gap-3 border-ok/40 p-5 text-sm"><CheckCircle2 className="text-ok" /> Muammo topilmadi. Bu statik tekshiruv — mantiqiy xatolar uchun AI review ni ham sinab ko'ring.</div> : (
              <ol className="card max-h-[min(58vh,560px)] divide-y overflow-y-auto">{findings.map((f, k) => <li key={k} className="flex gap-3 px-4 py-2.5"><span className="mt-0.5 shrink-0">{IC[f.severity]}</span><div className="min-w-0"><div className="flex items-center gap-2 text-[11px]"><span className="font-mono text-faint">{f.line}-qator</span><span className="rounded bg-elev px-1.5 py-px text-muted">{f.rule}</span></div><p className="mt-0.5 text-[13px] leading-relaxed">{f.message}</p></div></li>)}</ol>
            )}
            <p className="flex items-start gap-2 text-xs leading-relaxed text-faint"><Lightbulb size={13} className="mt-0.5 shrink-0" /> Tekshiruv to'liq oflayn ishlaydi: YAML sintaksisi, Compose va Kubernetes sxemasining asosiy qoidalari, Dockerfile va HCL uchun best-practice qoidalari.</p>
          </div>
        </div>
      )}
    </div>
  )
}
