# O'zgarishlar tarixi

Format: [Keep a Changelog](https://keepachangelog.com/) · Versiyalash: [SemVer](https://semver.org/)

## [1.0.0] — 2026-11-11

Birinchi chiqarilgan versiya.

### Qo'shildi
- **O'quv dasturi:** 13 modul, 73 dars; har bir dars 13 bo'limli shablon bo'yicha.
- **10 ta premium dars**, internetsiz ishlaydi: 02, 03, 04 (Linux), 06, 07 (Networking), 11, 12 (Docker), 38, 39, 41 (Kubernetes).
- **Gemini AI-ustoz:** bo'lim generatsiyasi (SSE streaming), chat, kod review, intervyu, incident mashqi, adaptiv test. Kesh, 429 backoff, bekor qilish imkoniyati bor.
- **15 ta interaktiv vosita:** virtual Linux terminal (50+ buyruq, 12 topshiriq), Perms, GitViz, Subnet, OSI, NAT, Layers, Validator, Raft, Patroni, K8sMap, Scheduler, HPA, PromQL, OIDC.
- **SM-2** oraliqli takrorlash, **gamifikatsiya** (XP, daraja, streak, 22 nishon), FTS5 qidiruv, eslatmalar, xatcho'plar, PDF/Markdown eksport, zaxira/tiklash.
- 3 mavzu (qorong'i/yorug'/terminal), `Ctrl+K` palitrasi, onboarding, splash ekran, ikonka.
- **Windows paketlash:** electron-builder bilan NSIS installer va portable `.exe` (x64).
- `scripts/fetch-native.mjs`: `better-sqlite3` ning kerakli platforma prebuild'ini `native/` ga oladi. Linux'da Windows paketini yasash shu skript tufayli mumkin.
- Testlar: 143 birlik test, smoke E2E, to'liq foydalanuvchi oqimi E2E (`flow.spec.ts`), paketlangan ilova testi (`packaged.spec.ts`).
- `README.md` (o'zbekcha).

### O'zgartirildi
- Faqat runtime'da kerak bo'lgan `better-sqlite3` `dependencies`'da qoldi. Vite bundle'ga kiradigan barcha kutubxonalar `devDependencies`'ga ko'chirildi, shuning uchun `app.asar` hajmi ~21 MB.

### Tuzatildi
- Virtual shell: `~` kengaytmasi, redirect tartibi (`2>&1 > f` va `> f 2>&1`), qo'shtirnoq ichidagi glob, `rm -rf /` himoyasi.
- Cron mantig'i React komponentidan `shared/cron.ts` ga ko'chirildi va testlandi.

### Xavfsizlik
- API kalit `safeStorage` (Windows DPAPI) bilan shifrlanadi va faqat main process'da ishlatiladi; loglarda `redact()` bilan yashiriladi.
- `contextIsolation`, IPC whitelist, sender tekshiruvi, qat'iy production CSP, navigatsiya cheklovi, barcha ruxsat so'rovlari rad etiladi.
