# O'zgarishlar tarixi

Format: [Keep a Changelog](https://keepachangelog.com/) · Versiyalash: [SemVer](https://semver.org/)

## [1.0.2] — 2026-11-11

### Tuzatildi
- **AI umuman ishlamas edi (yangi kalitlarda).** Google `gemini-2.5-flash` va `gemini-2.5-pro` modellarini yangi foydalanuvchilar uchun yopgan (404 "no longer available to new users"). Standart model endi `gemini-3.5-flash`. Murakkab vazifalar uchun `gemini-pro-latest`, u billing talab qiladi; bo'lmasa avtomatik flash modelga o'tiladi.
- **Avtomatik zaxira modellar.** Model yopilgan (404), bepul limiti 0 yoki band (429/503) bo'lsa, navbatdagi model sinaladi: `gemini-3.5-flash → gemini-3.5-flash-lite → gemini-flash-lite-latest → gemini-3.8-flash → gemini-flash-latest`. Doimiy muammoda ishlagan model sozlamalarga yoziladi.
- Saqlangan eski model nomlari (`gemini-2.5-*`, `1.x`, `2.0`) avtomatik yangisiga almashtiriladi.
- "Tekshirish" qaysi model ishlaganini ko'rsatadi. Fikrlovchi modellar uchun test limiti 16 → 512 token.
- **Xavfsizlik:** yangi formatdagi `AQ.…` kalitlar ham loglar va xato matnlaridan yashiriladi (avval faqat `AIza…` yashirilardi).

## [1.0.1] — 2026-11-11

### Tuzatildi
- **API kalit xatolari tushunarsiz edi.** Google qaytargan asl sabab endi ilovada ko'rsatiladi (kalit matndan yashiriladi). Quyidagi holatlar alohida aniqlanadi:
  hudud qo'llab-quvvatlanmaydi (`region`), "Generative Language API" yoqilmagan (`disabled`), noto'g'ri kalit 400 bilan kelgan holat (`key`).
- **429 `limit: 0`** (bu model yoki hudud uchun bepul tarif yo'q) holatida ilova avval "kalit to'g'ri" deb, keyin abadiy qayta urinardi. Endi darhol `quota` xatosi beradi va boshqa model tanlashni maslahat qiladi.
- Xato matnlari bir necha qatorli bo'lishi va nusxa olinishi mumkin.

### Qo'shildi
- `tests/e2e/keyerrors.spec.ts`: soxta Gemini server orqali xato xabarlarini UI da tekshirish. 5 ta yangi birlik test (jami 148).

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
