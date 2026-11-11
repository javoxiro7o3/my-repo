# DevOps Akademiya

O'zbek tilida DevOps o'rgatadigan Windows desktop ilova: Linux'dan Kubernetes va private infratuzilmagacha.
Darslar Google Gemini AI-ustoz bilan to'ldiriladi, interaktiv simulyatorlar va oraliqli takrorlash (SM-2) bilan mustahkamlanadi.

> **Pedagogik tamoyil.** Har bir mavzu bir xil zanjir bo'yicha tushuntiriladi:
> **NEGA kerak** → **ICHIDA QANDAY ISHLAYDI** (kernel/protokol darajasida) → **QANDAY ISHLATILADI** (qator-qator tahlil) → **QANDAY BUZILADI VA TUZATILADI**.

---

## Imkoniyatlar

| | |
|---|---|
| **73 dars, 13 modul** | Linux → Git/Networking → Docker → CI/CD → IaC → Observability → Kubernetes → GitOps → Xavfsizlik → Helm/Autoscaling → Private Infra |
| **13 bo'limli shablon** | Maqsad · Nega kerak · Nazariya · Ichki mexanizm · Buyruqlar tahlili · Laboratoriya · Break/Fix · Xatolar · Production · Test · Intervyu · Cheatsheet · Bog'liq mavzular |
| **10 ta premium dars** | Qo'lda yozilgan, **internetsiz ishlaydi** (02, 03, 04, 06, 07, 11, 12, 38, 39, 41). Har biri 830–1090 qator |
| **AI-ustoz (Gemini)** | Bo'limlarni generatsiya qilish, chat, kod review, intervyu simulyatsiyasi, incident mashqi, adaptiv test (AI Lab — 6 rejim) |
| **15 ta interaktiv vosita** | Virtual Linux terminal (50+ buyruq, 12 topshiriq), ruxsatlar, Git vizualizatori, subnet kalkulyatori (IPv4/IPv6/VLSM), OSI, NAT, Docker qatlamlari, Dockerfile/YAML/K8s/HCL validator, Raft, Patroni, K8s xaritasi, Scheduler, HPA, PromQL, OIDC oqimi |
| **Takrorlash** | SM-2 algoritmi bo'yicha kartochkalar |
| **Gamifikatsiya** | XP, darajalar, streak, 22 ta nishon, faollik heatmap'i |
| **Qidiruv** | SQLite FTS5 to'liq matnli qidiruv + AI javob |
| **Boshqalar** | Eslatmalar, xatcho'plar, PDF/Markdown eksport, zaxira/tiklash, 3 mavzu (qorong'i/yorug'/terminal), `Ctrl+K` buyruqlar palitrasi |

---

## O'rnatish (foydalanuvchi uchun)

Ilova ikki xil ko'rinishda tarqatiladi. Ikkalasi ham **Windows 10/11 x64** uchun.

| Fayl | Qachon tanlash kerak |
|---|---|
| `DevOps Akademiya-Setup-1.0.0.exe` | Odatiy o'rnatish: o'rnatish papkasini tanlash, ish stoli va Start menyu yorliqlari, "Programs and Features" orqali o'chirish |
| `DevOps Akademiya-Portable-1.0.0.exe` | O'rnatmasdan ishga tushirish (masalan, fleshkadan). Birinchi ochilishi biroz sekinroq, chunki har safar vaqtinchalik papkaga ochiladi |

> ⚠️ **SmartScreen ogohlantirishi.** Ilova kod imzosi (code signing sertifikati) bilan imzolanmagan.
> Shuning uchun Windows "Windows protected your PC" deb ogohlantirishi mumkin.
> **More info → Run anyway** ni bosing.

### Gemini API kalitini olish (bepul)

AI funksiyalari uchun shaxsiy Gemini kaliti kerak. Premium darslar va barcha 15 ta vosita kalitsiz ham ishlaydi.

1. [aistudio.google.com](https://aistudio.google.com/) ga Google akkaunt bilan kiring.
2. **Get API key → Create API key** ni bosing va kalitni nusxalang.
3. Ilovada **Sozlamalar → Gemini API kaliti** bo'limiga qo'ying va **Tekshirish**ni bosing.
4. Model tanlang. `gemini-2.5-flash` tez va arzon (standart), `gemini-2.5-pro` esa chuqurroq tushuntiradi.

**Kalit xavfsizligi:**
- Kalit Windows'ning DPAPI tizimi bilan shifrlanib, faqat sizning kompyuteringizda saqlanadi (Electron `safeStorage`).
- Kalit faqat ilovaning main process qismida ishlatiladi. Interfeys kodiga hech qachon o'tmaydi, loglardan esa avtomatik tozalanadi.
- So'rovlar to'g'ridan-to'g'ri Google'ga yuboriladi. Oraliq server yo'q.

### Oflayn rejim

| Internetsiz ishlaydi | Internet + kalit kerak |
|---|---|
| 10 ta premium dars (barcha bo'limlari bilan) | Qolgan 63 dars bo'limlarini generatsiya qilish |
| 15 ta interaktiv vosita | AI chat, review, intervyu, incident, adaptiv test |
| Takrorlash, progress, eslatmalar, qidiruv | Qidiruvdagi AI javob |
| **Avval generatsiya qilingan barcha AI kontent** (keshdan) | |

AI javoblari keshlanadi. Bir marta generatsiya qilingan bo'lim keyin internetsiz ham ochiladi va kalit limitini qayta sarflamaydi.

### Ma'lumotlar qayerda saqlanadi

Barcha progress, eslatmalar va AI keshi bitta SQLite faylida turadi:

```
%APPDATA%\DevOps Akademiya\akademiya.db
```

Uni **Sozlamalar** sahifasidagi **Eksport** / **Tiklash** tugmalari bilan zaxiralash va qayta tiklash mumkin. Ilovani o'chirib qayta o'rnatsangiz ham bu fayl o'chmaydi.

---

## Dasturchi uchun

### Talablar
- Node.js 22+
- (faqat NSIS installer'ni Linux'da yasash uchun) `wine` + `wine32` — pastga qarang

### Buyruqlar

```bash
npm ci                 # bog'liqliklarni o'rnatish
npm run dev            # ishlab chiqish rejimi (HMR)
npm run build          # curriculum.json + electron-vite build → out/
npm run typecheck      # tsc --noEmit
npm test               # birlik testlar (vitest)
npm run e2e            # E2E testlar (Playwright + Electron). Linux'da: xvfb-run -a npm run e2e
npm run icon           # build/icon.svg → icon.png + icon.ico
```

### Windows paketini yasash

```bash
npm run dist:win       # NSIS installer + portable  → dist/
npm run dist:portable  # faqat portable .exe
npm run dist:dir       # faqat ochilgan papka (dist/win-unpacked) — eng tez, tekshirish uchun
```

Har bir `dist:*` buyrug'i 3 ish qiladi:
1. `npm run build`
2. `scripts/fetch-native.mjs win32 x64`: `better-sqlite3` ning Windows prebuild'ini `native/` papkasiga ko'chiradi
3. `electron-builder`

**Nega `fetch-native` kerak?** `better-sqlite3` native modul (`.node` = DLL). Linux'da `npm ci` qilinganda Linux uchun binary tanlanadi, lekin Windows paketiga Windows DLL kerak. Paket barcha platformalar prebuild'larini o'zi bilan olib keladi. Skript kerakli bittasini `native/` ga oladi, electron-builder esa uni `resources/native/` ga joylaydi. `src/main/index.ts` paketlangan holatda aynan shu yo'ldan yuklaydi:

```ts
const nativeBinding = app.isPackaged
  ? join(process.resourcesPath, 'native', `${process.platform}-${process.arch}.node`)
  : undefined
```

Shu sababli `npmRebuild: false`. Kross-kompilyatsiya yo'q, faqat tayyor binary nusxalanadi.

**Linux'da NSIS installer yasash.** electron-builder uninstaller'ni yaratish uchun NSIS stub'ini ishga tushiradi. Bu `wine` (32-bit qo'llab-quvvatlash bilan) talab qiladi:

```bash
sudo dpkg --add-architecture i386 && sudo apt-get update
```

```bash
sudo apt-get install -y --no-install-recommends wine64 wine wine32:i386
```

Wine bo'lmasa, `npm run dist:portable` va `npm run dist:dir` baribir ishlaydi. Windows'da esa wine umuman kerak emas.

**Paketni tekshirish.** `tests/e2e/packaged.spec.ts` paketlangan ilovani (`app.isPackaged === true`) ishga tushirib, SQLite native modul `resources/native/` dan yuklanishini va baza yaratilishini tekshiradi:

```bash
npm run build && node scripts/fetch-native.mjs linux x64
```

```bash
npx electron-builder --linux dir --x64 --publish never -c.directories.output=dist-linux
```

```bash
DA_PACKAGED_EXE=dist-linux/linux-unpacked/devops-akademiya xvfb-run -a npx playwright test packaged --trace off
```

### Loyiha tuzilishi

```
src/
  shared/      Sof mantiq: Electron/React importi yo'q, shuning uchun to'g'ridan-to'g'ri testlanadi
               vshell (virtual shell), geminiCore (SSE, backoff), lint, subnet, promql, sm2, cron, gamify
  main/        Electron main: store.ts (SQLite + FTS5), ai.ts (safeStorage + streaming), ipc.ts (whitelist)
  preload/     contextBridge: faqat whitelist'dagi kanallar
  renderer/    React UI: 11 sahifa, 15 vosita, Radix asosidagi dizayn tizimi
  content/     curriculum/*.mjs → curriculum.json (73 dars), premium/NN.md + NN.quiz.json
scripts/       build-curriculum, make-icon, fetch-native
tests/unit/    143 birlik test
tests/e2e/     smoke, to'liq foydalanuvchi oqimi, paketlangan ilova testi
```

### Texnologiya tanlovlari va ularning sababi

| Tanlov | Sabab |
|---|---|
| **Electron** | Monaco, xterm.js, Mermaid kabi tayyor web komponentlar; bitta kod bazasi. Narxi: paket hajmi (~115–125 MB) |
| **electron-vite + React + TS (strict)** | Tez HMR; main/preload/renderer uchun alohida build; qat'iy tiplar katta kod bazasida xatolarni erta ushlaydi |
| **SQLite (better-sqlite3)** | Sinxron va tez API, tranzaksiyalar, FTS5 qidiruv. Bitta fayl bo'lgani uchun zaxiralash oson |
| **API kalit faqat main process'da** | Renderer'dagi XSS zaifligi kalitni o'g'irlay olmaydi. `contextIsolation`, IPC whitelist va qat'iy CSP ham shu maqsadda |
| **Kesh kaliti `kind\|lesson\|section\|model\|promptVersion`** | Model yoki prompt o'zgarsa, eski kontent avtomatik eskiradi va qayta generatsiya qilinadi |
| **Virtual shell (haqiqiy shell emas)** | Xavfsizlik: o'quvchi tizimni buzolmaydi. Natija ham deterministik, shuning uchun topshiriqlarni avtomatik tekshirish mumkin |
| **Premium darslar Markdown'da** | Internetsiz to'liq tajriba; `<!-- @section: x -->` belgilari bilan bo'limlarga ajratiladi |
| **HSL CSS o'zgaruvchilari bilan mavzular** | 3 mavzu bitta Tailwind konfiguratsiyasidan; tizim mavzusiga moslashadi |
| **Container queries** | AI paneli ochiq yoki yopiqligidan qat'i nazar kontent to'g'ri joylashadi |

### Ma'lum cheklovlar

- Kod imzosi yo'q, shuning uchun SmartScreen ogohlantiradi (yuqoriga qarang).
- Hozircha faqat Windows x64 paketi sozlangan. Kod macOS/Linux'da ham ishlaydi (`npm run dev`), lekin ular uchun installer konfiguratsiyasi yo'q.
- Monaco muharriri bundle'i katta (~5 MB). U faqat kerak bo'lganda (lazy) yuklanadi.

---

## Litsenziya

MIT. Shriftlar: Inter va JetBrains Mono (SIL Open Font License).
