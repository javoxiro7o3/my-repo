# DevOps Akademiya — Loyiha Pasporti (Handover)

> **Sana:** 2026-11-11 · **Holat:** ~85% tayyor, ilova ishlaydi · **Qolgan asosiy ish:** `.exe` paketlash, README, E2E
> **Loyiha yo'li:** `/home/user/devops-akademiya`

---

## 1. Loyiha maqsadi va joriy holati

### Maqsad
O'zbek tilidagi **mukammal DevOps o'quv dasturi** — Windows uchun `.exe` desktop ilova (Electron).
73 ta dars, har biri 13 bo'limli shablon bo'yicha; Google Gemini API bilan integratsiyalangan AI-ustoz; 15 ta interaktiv simulyator; SM-2 oraliqli takrorlash; gamifikatsiya.

**Pedagogik tamoyil (butun kontentda qat'iy amal qilingan):**
`NEGA kerak` → `ICHIDA QANDAY ISHLAYDI` (kernel/protokol darajasida) → `QANDAY ISHLATILADI` (qator-qator tahlil) → `QANDAY BUZILADI VA TUZATILADI`.

### Hozir qaysi bosqichdamiz

| # | Bosqich | Holat |
|---|---|---|
| 1 | Arxitektura, skelet (Electron + Vite + React + TS) | ✅ Tugadi |
| 2 | SQLite saqlash qatlami (progress, kesh, SM-2, FTS5) | ✅ Tugadi |
| 3 | Gemini moduli (safeStorage, SSE streaming, kesh, backoff) | ✅ Tugadi |
| 4 | Dars o'quvchi + kontent pipeline (Markdown/Mermaid/Monaco) | ✅ Tugadi |
| 5 | `curriculum.json` — 73 dars metama'lumoti | ✅ Tugadi |
| 6 | Dashboard / Roadmap / gamifikatsiya / SM-2 | ✅ Tugadi |
| 7 | AI funksiyalari (chat, review, intervyu, incident, adaptiv test) | ✅ Tugadi |
| 8 | 15 ta interaktiv vosita | ✅ Tugadi |
| 9 | 10 ta premium (qo'lda yozilgan, oflayn) dars | ✅ Tugadi |
| 10 | Sayqal: ikonka, splash, a11y, animatsiyalar | 🟡 ~80% |
| 11 | **Paketlash: NSIS `.exe` + portable `.exe`** | ❌ **BOSHLANMAGAN** |
| 12 | README, CHANGELOG, yakuniy tekshiruv | ❌ **BOSHLANMAGAN** |

### Sinovdan o'tgan holat (dalillar)

```
✅ npx tsc --noEmit        → xatosiz
✅ npx vitest run          → 143 test, 6 fayl, hammasi o'tdi
✅ npx electron-vite build → muvaffaqiyatli (out/main, out/preload, out/renderer)
✅ E2E smoke (xvfb)        → 11 sahifa + 15 vosita + 10 premium dars: konsol xatosiz
```

**Jami kod:** ~25 300 qator (`src`, `tests`, `scripts`).

---

## 2. Fayllar va funksiyalar strukturasi

### 2.1. Konfiguratsiya (ildiz)

| Fayl | Vazifasi |
|---|---|
| `package.json` | Skriptlar. ⚠️ `build` (electron-builder) bo'limi **hali yo'q** |
| `electron.vite.config.ts` | 3 ta build: main / preload / renderer; alias (`@shared`, `@content`, `@`); production CSP plagini |
| `tsconfig.json` | Strict TS, path alias lar |
| `tailwind.config.cjs` | HSL CSS o'zgaruvchilar orqali 3 mavzu; container queries |
| `vitest.config.ts` · `playwright.config.ts` | Birlik va E2E testlar |

### 2.2. `src/shared/` — umumiy, sof mantiq (Electron ga bog'liq emas, testlangan)

| Fayl | Asosiy eksportlar | Vazifasi |
|---|---|---|
| `types.ts` | `Lesson`, `CourseModule`, `AiRequest`, `AiEvent`, `Stats`, `Settings`, `QuizQuestion` | Barcha turlar |
| `sections.ts` | `SECTIONS` (13 ta), `sectionMeta()` | Dars shabloni |
| `curriculum.ts` | `LESSONS`, `MODULES`, `lessonById()` | `curriculum.json` ni yuklaydi |
| `premium.ts` | `premiumSection()`, `premiumQuiz()`, `splitSections()` | `premium/*.md` ni `<!-- @section: x -->` bo'yicha bo'ladi |
| `prompts.ts` | `SYSTEM_PROMPT`, `PROMPT_VERSION`, `buildRequest()`, `sectionPrompt()` | AI promptlari (10 ta funksiya uchun) |
| `geminiCore.ts` | `streamGemini()`, `parseSse()`, `backoffMs()`, `redact()`, `extractJson()`, `cacheKeyParts()` | SSE streaming, 429 backoff, xato kodlari |
| `sm2.ts` | `sm2()`, `nextDue()` | SuperMemo-2 algoritmi |
| `gamify.ts` | `XP`, `BADGES` (22 ta), `levelFromXp()`, `calcStreak()` | Gamifikatsiya |
| `subnet.ts` | `v4info()`, `vlsm()`, `split()`, `v6info()`, `compressV6()` | IPv4/IPv6 hisob-kitoblari |
| `lint.ts` | `lintDockerfile()`, `lintYaml()` (+K8s), `lintHcl()`, `lint()` | Oflayn validator qoidalari |
| `vshell.ts` | `VShell` klassi, `SHELL_TASKS` (12 ta) | **Virtual Linux shell:** 50+ buyruq, pipe, redirect, glob, cgroup siz — to'liq simulyatsiya |
| `promql.ts` | `parse()`, `evaluate()`, `sampleData()` | Mini PromQL dvigateli |
| `cron.ts` | `expandField()`, `nextRuns()`, `describe()` | Cron ifodalari |
| `ipc.ts` | `INVOKE_CHANNELS`, `EVENT_CHANNELS`, `EXTERNAL_HOSTS` | IPC whitelist |

### 2.3. `src/main/` — Electron main process

| Fayl | Vazifasi |
|---|---|
| `index.ts` | Oyna yaratish, splash ekran (inline SVG), FTS5 indeksini qurish, `contextIsolation: true`, navigatsiya cheklovi, single instance |
| `store.ts` | **`Store` klassi** — SQLite (better-sqlite3): sozlamalar, AI kesh, progress/XP/badge, SM-2 kartalar, eslatmalar, chat, FTS5 qidiruv, zaxira/tiklash |
| `ai.ts` | Kalitni `safeStorage` bilan shifrlash, `startAi()` (streaming + kesh), `testKey()`, `cancelAi()` |
| `ipc.ts` | 30+ IPC handler (whitelist bo'yicha), PDF/Markdown eksport, sender tekshiruvi |

### 2.4. `src/preload/index.ts`
`contextBridge` orqali faqat whitelist dagi kanallarni ochadi. **API kalit renderer ga hech qachon o'tmaydi.**

### 2.5. `src/renderer/src/` — React interfeys

**Sahifalar** (`pages/`): `Dashboard` (streak, heatmap, zaif mavzular), `Lesson` (335 qator — 13 bo'lim, streaming, tanlov paneli, eslatma), `Roadmap`, `Review` (SM-2), `Search` (FTS5 + AI), `Notes`, `Project`, `Settings`, `About`, `AiLab` (6 rejim), `Tools`.

**Komponentlar** (`components/`): `Markdown` (XSS sanitize, glossary tooltip, `tahlil`/`breakfix` bloklari), `Mermaid`, `Monaco`, `Quiz` (4 savol turi), `AiPanel`+`ChatView`, `BreakFix`, `Layout`, `Overlays` (Ctrl+K palitra, onboarding, toast), `ui/` (Radix asosidagi dizayn tizimi).

**Vositalar** (`tools/`, 15 ta): `Terminal` (xterm.js + VShell), `Perms`, `GitViz`, `Subnet`, `Osi`, `Nat`, `Layers`, `Validator`, `Raft`, `Patroni`, `K8sMap`, `Scheduler`, `Hpa`, `PromQL`, `Oidc` (+ umumiy `SequencePlayer`).

### 2.6. `src/content/`

- `curriculum/*.mjs` → `scripts/build-curriculum.mjs` → **`curriculum.json`** (13 modul, 73 dars, validatsiya bilan)
- `premium/NN.md` + `NN.quiz.json` — **10 ta to'liq dars** (har biri 830–1090 qator):
  **02** Linux buyruqlar · **03** jarayonlar/systemd/ruxsatlar · **04** foydalanuvchi/apt/LVM · **06** Networking/subnetting · **07** Routing/NAT/firewall · **11** Docker ichki tuzilishi · **12** Dockerfile/Compose · **38** Kubernetes arxitekturasi · **39** Deployment/rolling update · **41** Services

### 2.7. `tests/`

| Fayl | Testlar |
|---|---|
| `unit/sm2.test.ts` | SM-2 + gamifikatsiya (13) |
| `unit/subnet.test.ts` | IPv4/IPv6/VLSM (16) |
| `unit/gemini.test.ts` | SSE, backoff, xatolar, kalit sizib chiqmasligi, promptlar (19) |
| `unit/lint.test.ts` | Dockerfile/YAML/K8s/HCL linterlari (33) |
| `unit/store.test.ts` | SQLite: progress, kesh, SM-2, FTS5, zaxira (28) |
| `unit/vshell.test.ts` | Virtual shell + 12 topshiriq + cron (34) |
| `e2e/_smoke.spec.ts` | Barcha sahifalar/vositalar/premium darslar |

---

## 3. Hozirgi holat: qayerda to'xtadik

**Oxirgi bajarilgan ish:** birlik testlari to'liq yozildi (143 ta) va ular orqali **virtual shell dagi 5 ta haqiqiy xato topilib tuzatildi**:
1. `~` (tilde) kengaytmasi ishlamasdi — `mkdir ~/x` va `> ~/fayl` buzilgan edi
2. Redirect **tartibi** hisobga olinmasdi (`2>&1 > f` va `> f 2>&1` bir xil ishlardi)
3. Qo'shtirnoq ichidagi glob ochilib ketardi (`echo "*.log"`)
4. `rm -rf /` himoyasi ishlamasdi
5. Cron mantig'i React komponenti ichida edi → `shared/cron.ts` ga ko'chirildi

**Shuningdek:** `tsc` xatolari tuzatildi, ikonka yaratildi (`build/icon.svg` → `icon.png` + 7 o'lchamli `icon.ico`).

### ❗ Muammo yo'q, lekin BAJARILMAGAN ishlar

| # | Ish | Tafsilot |
|---|---|---|
| **1** | `package.json` da **`build` bo'limi yo'q** | electron-builder konfiguratsiyasi (NSIS + portable, ikonka, fayllar, `asarUnpack`) yozilmagan |
| **2** | **`scripts/fetch-native.mjs` fayli YO'Q** | `package.json` da `npm run native` / `dist:win` unga havola qiladi, lekin fayl yaratilmagan. Vazifasi: `better-sqlite3` ning **win32-x64** prebuild ini olib, `native/` ga joylash (chunki Linux da yig'ilgan `.node` Windows da ishlamaydi) |
| **3** | `README.md` va `CHANGELOG.md` yo'q | O'zbekcha: o'rnatish, Gemini kalitini olish, ishlatish, texnologiya tanlovlari sabablari |
| **4** | To'liq E2E testlar | Hozir faqat smoke bor; onboarding → dars → test → progress oqimi yozilmagan |
| **5** | Performance o'lchovi | "Ishga tushish < 3 s" talabi o'lchanmagan (Monaco chunk 4.9 MB — lazy yuklanadi) |

### ⚠️ Muhim texnik cheklov (yangi sessiya uchun)

Bu muhitda **wine yo'q**, shuning uchun:
- `electron-builder --win` Linux da NSIS installer yasash uchun odatda `wine` talab qiladi;
- **portable `.exe`** va `--dir` (unpacked) esa wine siz ham yasalishi mumkin;
- `electron-builder` Windows Electron binarini (`~110 MB`) va NSIS vositalarini internetdan yuklaydi — proksi orqali (`HTTPS_PROXY` o'rnatilgan, ilgari `release-assets.githubusercontent.com` dan yuklashda bir marta uzilish bo'lgan, qayta urinish yordam bergan).

**better-sqlite3 muhim nuqtasi:** `node_modules/better-sqlite3/prebuilds/win32-x64.node` mavjud — uni `native/win32-x64.node` ga nusxalab, `extraResources` orqali paketga qo'shish kerak. `src/main/index.ts` da buni o'qish mantiqi **allaqachon yozilgan**:
```ts
const nativeBinding = app.isPackaged
  ? join(process.resourcesPath, 'native', `${process.platform}-${process.arch}.node`)
  : undefined
```

---

## 4. Next Steps — yangi chatda birinchi nima yozish kerak

### Birinchi xabar uchun tayyor matn (nusxa oling):

```
Loyiha: /home/user/devops-akademiya — DevOps Akademiya (Electron + React + TS).
HANDOVER.md ni o'qib chiq. Loyiha ~85% tayyor: 143 birlik test o'tadi,
build ishlaydi, 10 ta premium dars va 15 vosita tayyor.

Qolgan ishni shu tartibda davom ettir:
1. scripts/fetch-native.mjs yoz (better-sqlite3 win32-x64 prebuild → native/)
2. package.json ga electron-builder "build" bo'limini qo'sh:
   NSIS installer + portable, ikonka build/icon.ico, extraResources: native/
3. npm run dist:win bilan .exe yasashga urin.
   Eslatma: wine yo'q — avval portable va --dir variantini sina, NSIS ishlamasa halol ayt.
4. README.md (o'zbekcha) va CHANGELOG.md yoz.
5. To'liq E2E test: onboarding → dars ochish → bo'limni tugatish → XP/progress tekshiruvi.
6. Yakunda: nima tayyor, nima qolgani haqida halol hisobot.
```

### Batafsil ketma-ketlik

**1-qadam — `scripts/fetch-native.mjs`**
```js
// Vazifasi: better-sqlite3 ning platformaga mos prebuild ini native/ ga nusxalash
// node_modules/better-sqlite3/prebuilds/win32-x64.node → native/win32-x64.node
// Argument: process.argv[2] (masalan "win32"), standart — joriy platforma
```

**2-qadam — `package.json` → `build`**
```jsonc
"build": {
  "appId": "uz.devops.akademiya",
  "productName": "DevOps Akademiya",
  "directories": { "output": "dist", "buildResources": "build" },
  "files": ["out/**/*", "package.json"],
  "extraResources": [{ "from": "native", "to": "native" }],
  "asarUnpack": [],
  "win": {
    "icon": "build/icon.ico",
    "target": [
      { "target": "nsis", "arch": ["x64"] },
      { "target": "portable", "arch": ["x64"] }
    ]
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "shortcutName": "DevOps Akademiya"
  }
}
```

**3-qadam — paketlash va tekshirish**
```bash
npm run dist:win          # yoki: npx electron-builder --win portable --x64
ls -la dist/              # natijani tekshirish
```
NSIS wine talab qilsa — portable va `--dir` bilan cheklanib, buni README da va yakuniy hisobotda **aniq yozish**.

**4-qadam — hujjatlar**
`README.md`: ilova nima, skrinshotlar, o'rnatish, Gemini kalitini olish (aistudio.google.com), oflayn rejim, texnologiya tanlovlari sabablari, dasturchi uchun (`npm run dev`, `test`, `dist:win`).

**5-qadam — E2E**
`tests/e2e/flow.spec.ts`: onboarding o'tkazib yuborish → `/lesson/2` → "Bo'limni tugatdim" → XP +10 → Dashboard da progress.

---

## 5. Tezkor ma'lumotnoma

### Buyruqlar
```bash
npm run dev            # ishlab chiqish rejimi
npm run build          # curriculum.json + electron-vite build
npm test               # 143 birlik test
npm run typecheck      # tsc --noEmit
npm run icon           # SVG → PNG + ICO
xvfb-run -a -s "-screen 0 1600x1000x24" npx playwright test --trace off   # E2E
```

### Muhim qarorlar (nega shunday)
| Qaror | Sabab |
|---|---|
| Kalit faqat main process da, `safeStorage` bilan | Renderer ga hech qachon o'tmaydi; `redact()` loglardan tozalaydi |
| Kesh kaliti: `kind\|lessonId\|section\|model\|promptVersion` | Model yoki prompt o'zgarsa — kontent qayta generatsiya qilinadi |
| `shared/` da React/Electron importi yo'q | Birlik testlari to'g'ridan-to'g'ri ishlaydi |
| Virtual shell to'liq simulyatsiya | Haqiqiy shell ochilmaydi — xavfsizlik talabi |
| Mavzular HSL CSS o'zgaruvchilari orqali | 3 mavzu (dark/light/terminal) + tizimga moslashuv |
| Container queries (`@5xl:` va h.k.) | AI paneli ochiq/yopiq holatida kontent to'g'ri joylashadi |

### Ma'lumotlar bazasi (SQLite, `userData/akademiya.db`)
`settings`, `progress`, `lesson_done`, `ai_cache`, `chat_messages`, `notes`, `bookmarks`, `quiz_attempts`, `srs_cards`, `xp_events`, `activity`, `badges`, `usage`, `project_tasks`, `counters`, `search` (FTS5)

### Premium dars formati
```markdown
<!-- @section: why -->       → "Nega bu kerak?"
<!-- @section: theory -->    → Nazariya + atamalar jadvali
<!-- @section: internals --> → Ichki mexanizm (Mermaid diagrammalar)
<!-- @section: commands -->  → Qator-qator tahlil + ```tahlil JSON bloklari
<!-- @section: lab -->       → Laboratoriya + <details> yechim
<!-- @section: breakfix -->  → ```breakfix JSON bloklari
<!-- @section: errors -->    → Xatolar jadvali + debug diagrammasi
<!-- @section: production -->→ Production maslahatlari
<!-- @section: interview --> → 10 intervyu savoli
<!-- @section: cheatsheet -->→ Bir sahifalik xulosa
```
(`goal` va `related` bo'limlari koddan avtomatik generatsiya qilinadi; `quiz` — `NN.quiz.json` dan)
