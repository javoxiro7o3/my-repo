import { describe, expect, it } from 'vitest'
import { lint, lintDockerfile, lintHcl, lintYaml } from '@shared/lint'

const rules = (f: ReturnType<typeof lintDockerfile>) => f.map((x) => x.rule)
const msgs = (f: ReturnType<typeof lintDockerfile>) => f.map((x) => x.message).join(' | ')

describe('Dockerfile linter', () => {
  it('toza Dockerfile da xato yo\'q', () => {
    const f = lintDockerfile(`FROM python:3.12.7-slim-bookworm
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
USER 10001
HEALTHCHECK CMD ["python", "-c", "print(1)"]
CMD ["gunicorn", "app:app"]`)
    expect(f.filter((x) => x.severity === 'error')).toHaveLength(0)
  })
  it('latest tegi va tegsiz image haqida ogohlantiradi', () => {
    expect(rules(lintDockerfile('FROM node:latest\nCMD ["node"]'))).toContain('versiya')
    expect(rules(lintDockerfile('FROM ubuntu\nCMD ["sh"]'))).toContain('versiya')
  })
  it('sirlarni ENV/ARG da topadi', () => {
    const f = lintDockerfile('FROM alpine:3.20\nENV DB_PASSWORD=qwerty123\nCMD ["sh"]')
    expect(f.some((x) => x.rule === 'xavfsizlik' && x.severity === 'error')).toBe(true)
  })
  it('apt-get update alohida RUN da — kesh ogohlantirishi', () => {
    expect(msgs(lintDockerfile('FROM ubuntu:24.04\nRUN apt-get update\nRUN apt-get install -y curl\nCMD ["sh"]'))).toMatch(/bitta RUN/)
  })
  it('apt-get install -y siz — build xatosi', () => {
    expect(lintDockerfile('FROM ubuntu:24.04\nRUN apt-get update && apt-get install curl\nCMD ["sh"]').some((x) => x.rule === 'build' && x.severity === 'error')).toBe(true)
  })
  it('shell form CMD — signal ogohlantirishi', () => {
    expect(msgs(lintDockerfile('FROM alpine:3.20\nUSER 1000\nCMD python app.py'))).toMatch(/SIGTERM/)
  })
  it('exec form da bittalik qo\'shtirnoq — sintaksis xatosi', () => {
    expect(lintDockerfile("FROM alpine:3.20\nCMD ['sh', '-c', 'x']").some((x) => x.rule === 'sintaksis')).toBe(true)
  })
  it('USER yo\'q — root ogohlantirishi; bor — yo\'q', () => {
    expect(msgs(lintDockerfile('FROM alpine:3.20\nCMD ["sh"]'))).toMatch(/root/)
    expect(msgs(lintDockerfile('FROM alpine:3.20\nUSER app\nCMD ["sh"]'))).not.toMatch(/root sifatida/)
  })
  it('COPY . . dan keyin npm ci — kesh ogohlantirishi', () => {
    expect(msgs(lintDockerfile('FROM node:22-alpine\nWORKDIR /app\nCOPY . .\nRUN npm ci\nCMD ["node","x"]'))).toMatch(/kesh buziladi/)
  })
  it('RUN cd — WORKDIR tavsiyasi; chmod 777 — xavfsizlik', () => {
    expect(msgs(lintDockerfile('FROM alpine:3.20\nRUN cd /app\nRUN chmod -R 777 /app\nCMD ["sh"]'))).toMatch(/WORKDIR/)
    expect(rules(lintDockerfile('FROM alpine:3.20\nRUN chmod 777 /app\nCMD ["sh"]'))).toContain('xavfsizlik')
  })
  it('FROM dan oldingi instruksiya va noma\'lum instruksiya — xato', () => {
    expect(lintDockerfile('RUN echo x\nFROM alpine:3.20').some((x) => x.severity === 'error')).toBe(true)
    expect(lintDockerfile('FROM alpine:3.20\nRUNN echo x').some((x) => x.message.includes("Noma'lum"))).toBe(true)
  })
  it('multi-stage: faqat yakuniy bosqich uchun USER tekshiriladi', () => {
    const f = lintDockerfile(`FROM golang:1.23 AS build
WORKDIR /src
RUN go build -o /app
FROM gcr.io/distroless/static:nonroot
COPY --from=build /app /app
USER nonroot
ENTRYPOINT ["/app"]`)
    expect(f.filter((x) => x.severity === 'error')).toHaveLength(0)
    expect(msgs(f)).not.toMatch(/root sifatida/)
  })
  it("ADD o'rniga COPY tavsiyasi va MAINTAINER eskirgani", () => {
    expect(msgs(lintDockerfile('FROM alpine:3.20\nMAINTAINER x@y.z\nADD app.py /app.py\nUSER 1\nCMD ["sh"]'))).toMatch(/COPY ishlating/)
    expect(rules(lintDockerfile('FROM alpine:3.20\nMAINTAINER x\nUSER 1\nCMD ["sh"]'))).toContain('eskirgan')
  })
})

describe('YAML / Compose linter', () => {
  it('TAB belgisini topadi', () => {
    expect(lintYaml('services:\n\tweb:\n\t\timage: nginx:1.27').some((x) => x.message.includes('TAB'))).toBe(true)
  })
  it('sintaksis xatosini topadi', () => {
    expect(lintYaml('services:\n  web:\n   image: [unclosed').some((x) => x.rule === 'sintaksis')).toBe(true)
  })
  it('compose: version eskirgan, image yo\'q, latest, sirlar, privileged', () => {
    const f = lintYaml(`version: "3.8"
services:
  web:
    image: myapp
    environment:
      - SECRET_KEY=abc123xyz
    privileged: true
  broken: {}
  db:
    image: postgres:16.4
    ports:
      - "5432:5432"`)
    const m = msgs(f)
    expect(m).toMatch(/eskirgan/); expect(m).toMatch(/qotirilmagan/); expect(m).toMatch(/sir/)
    expect(f.some((x) => x.message.includes('privileged'))).toBe(true)
    expect(f.some((x) => x.message.includes('"broken"'))).toBe(true)
    expect(m).toMatch(/ma'lumotlar bazasi porti/)
  })
  it('compose: docker.sock va e\'lon qilinmagan volume — xato', () => {
    const f = lintYaml(`services:
  web:
    image: x:1
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - pgdata:/data`)
    expect(f.filter((x) => x.severity === 'error').length).toBeGreaterThanOrEqual(2)
  })
  it('compose: depends_on da mavjud bo\'lmagan servis', () => {
    expect(msgs(lintYaml('services:\n  web:\n    image: x:1\n    depends_on:\n      - cache'))).toMatch(/mavjud emas/)
  })
})

describe('Kubernetes linter', () => {
  it('eskirgan apiVersion', () => {
    expect(msgs(lintYaml('apiVersion: apps/v1beta1\nkind: Deployment\nmetadata:\n  name: x\nspec:\n  selector:\n    matchLabels:\n      app: x\n  template:\n    metadata:\n      labels:\n        app: x\n    spec:\n      containers:\n        - name: c\n          image: nginx:1.27'))).toMatch(/apps\/v1/)
  })
  it('selector Pod label lariga mos emas', () => {
    expect(msgs(lintYaml('apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: x\nspec:\n  selector:\n    matchLabels:\n      app: web\n  template:\n    metadata:\n      labels:\n        app: backend\n    spec:\n      containers:\n        - name: c\n          image: nginx:1.27'))).toMatch(/mos kelmaydi/)
  })
  it('memory: 512m (millibayt) — mantiqiy xato', () => {
    const f = lintYaml(`apiVersion: v1
kind: Pod
metadata:
  name: p
spec:
  containers:
    - name: c
      image: nginx:1.27
      resources:
        limits:
          memory: 512m`)
    expect(f.some((x) => x.rule === 'mantiq' && x.message.includes('MILLI'))).toBe(true)
  })
  it('requests > limits — xato', () => {
    expect(msgs(lintYaml(`apiVersion: v1
kind: Pod
metadata: { name: p }
spec:
  containers:
    - name: c
      image: nginx:1.27
      resources:
        requests: { memory: 1Gi }
        limits: { memory: 256Mi }`))).toMatch(/dan katta/)
  })
  it('sir env da ochiq, latest teg, privileged', () => {
    const m = msgs(lintYaml(`apiVersion: v1
kind: Pod
metadata: { name: p }
spec:
  containers:
    - name: c
      image: app:latest
      env:
        - name: DB_PASSWORD
          value: secret123
      securityContext:
        privileged: true`))
    expect(m).toMatch(/secretKeyRef/); expect(m).toMatch(/qotirilmagan/); expect(m).toMatch(/privileged/)
  })
  it('Service: nodePort oralig\'i va selector yo\'qligi', () => {
    const m = msgs(lintYaml('apiVersion: v1\nkind: Service\nmetadata:\n  name: s\nspec:\n  type: NodePort\n  ports:\n    - port: 80\n      nodePort: 8080'))
    expect(m).toMatch(/30000/); expect(m).toMatch(/selector yo'q/)
  })
  it('to\'g\'ri Deployment da xato yo\'q', () => {
    const f = lintYaml(`apiVersion: apps/v1
kind: Deployment
metadata: { name: web }
spec:
  replicas: 3
  selector: { matchLabels: { app: web } }
  template:
    metadata: { labels: { app: web } }
    spec:
      containers:
        - name: web
          image: nginx:1.27.2-alpine
          resources:
            requests: { cpu: 100m, memory: 64Mi }
            limits: { memory: 128Mi }
          readinessProbe: { httpGet: { path: /, port: 80 } }
          securityContext: { runAsNonRoot: true, allowPrivilegeEscalation: false }`)
    expect(f.filter((x) => x.severity === 'error')).toHaveLength(0)
  })
})

describe('HCL linter', () => {
  it('toza konfiguratsiyada sintaksis xatosi yo\'q', () => {
    const f = lintHcl(`terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

provider "aws" {
  region = var.region
}

resource "aws_instance" "web" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = "t3.micro"
}`)
    expect(f.filter((x) => x.severity === 'error')).toHaveLength(0)
  })
  it('":" o\'rniga "=" kerakligini topadi', () => {
    expect(msgs(lintHcl('resource "x" "y" {\n  name: "z"\n}'))).toMatch(/"=" bilan/)
  })
  it('yopilmagan qavs va qo\'shtirnoq', () => {
    expect(lintHcl('resource "a" "b" {\n  x = 1\n').some((x) => x.message.includes('yopilmagan'))).toBe(true)
    expect(lintHcl('resource "a" "b" {\n  x = "yopilmagan\n}').some((x) => x.rule === 'sintaksis')).toBe(true)
  })
  it('resource sarlavhasi formati', () => {
    expect(msgs(lintHcl('resource aws_instance "web" {\n  x = 1\n}'))).toMatch(/resource "TUR" "NOM"/)
  })
  it('sir kodda ochiq va 0.0.0.0/0 ingress', () => {
    expect(lintHcl('resource "a" "b" {\n  password = "Pa55w0rd!"\n}').some((x) => x.rule === 'xavfsizlik')).toBe(true)
    const sg = lintHcl(`resource "aws_security_group" "web" {
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}`)
    expect(sg.some((x) => x.rule === 'xavfsizlik' && x.severity === 'error')).toBe(true)
  })
  it('izohlar va heredoc e\'tiborga olinmaydi', () => {
    const f = lintHcl(`# izoh: name: qiymat
resource "a" "b" {
  script = <<-EOT
    bu yerda name: qiymat bo'lishi mumkin
  EOT
  x = 1
}`)
    expect(f.filter((x) => x.severity === 'error')).toHaveLength(0)
  })
  it('modul versiyasi qotirilmagan', () => {
    expect(msgs(lintHcl('module "vpc" {\n  source = "git::https://github.com/x/y.git"\n}'))).toMatch(/ref=/)
  })
})

describe('lint() dispetcheri', () => {
  it('tilga qarab to\'g\'ri linterni chaqiradi', () => {
    expect(lint('dockerfile', 'FROM alpine').length).toBeGreaterThan(0)
    expect(lint('yaml', 'services:\n  a: {}').length).toBeGreaterThan(0)
    expect(lint('hcl', 'resource "a" "b" {').length).toBeGreaterThan(0)
  })
})
