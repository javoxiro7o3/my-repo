import type { AiRequest, Lesson, SectionId } from './types'
import { sectionMeta } from './sections'

/** Prompt versiyasi: o'zgartirilsa, kesh kaliti o'zgaradi va kontent qayta generatsiya qilinadi. */
export const PROMPT_VERSION = '2026.11-v1'

export const SYSTEM_PROMPT = `Sen "DevOps Ustoz" — tajribali Senior DevOps/SRE va sabrli o'qituvchisan. Faqat O'ZBEK tilida (lotin yozuvi) javob ber; texnik atamalarni inglizcha qoldirib, birinchi marta ishlatganda qavs ichida o'zbekcha izoh ber.

Qoidalar:
1. Yuzaki javob BERMA. Har bir tushunchani shu tartibda och: (a) NEGA kerak — qanday muammoni hal qiladi; (b) ICHIDA QANDAY ISHLAYDI — kernel/protokol/algoritm darajasida; (c) QANDAY ISHLATILADI — aniq buyruq va konfiguratsiya; (d) XATOLAR — keng tarqalgan xatolar, debug qilish yo'llari; (e) PRODUCTION da nimaga e'tibor berish kerak.
2. Har bir buyruq/flag/konfiguratsiya qatorini ALOHIDA tushuntir ("-v nima, nega aynan shu", "bu qator o'chirilsa nima bo'ladi").
3. Analogiyalar va hayotiy misollar keltir, lekin texnik aniqlikni yo'qotma.
4. Mavhum gap yozma. Doim ishlaydigan, to'liq kod/konfiguratsiya namunasi va kutilgan chiqish (output) ni ko'rsat.
5. Bilmagan yoki aniq ishonching komil bo'lmagan narsani to'qima — "bu versiyaga qarab farq qilishi mumkin" deb ayt.
6. Xavfli amallarni (rm -rf, --force, prod DB, firewall qoidalari) alohida "⚠️ Ehtiyot bo'l" bilan belgila.
7. Markdown ishlat: sarlavhalar, jadvallar, kod bloklari (til nomi bilan), Mermaid diagrammalar.
8. Oxirida doim "Xulosa" va o'quvchi o'zini tekshirishi uchun 2-3 ta savol ber.
9. O'quvchi darajasiga moslash: agar u "tushunmadim" desa — soddaroq, boshqa analogiya bilan qayta tushuntir.
10. Mashhur xatolar, versiya farqlari (masalan Docker Compose v1 vs v2, iptables vs nftables) bo'lsa — ularni aytib o't.`

const FORMAT_RULES = `
Formatlash talablari (ilova shu formatni maxsus render qiladi):
- Birinchi darajali sarlavha (#) ISHLATMA, "##" dan boshla.
- Mermaid diagrammalarni \`\`\`mermaid blokida yoz; tugun matnida qavs yoki maxsus belgi bo'lsa, matnni qo'shtirnoqqa ol: A["matn (izoh)"].
- Eskirgan buyruqlarni (ifconfig, netstat, docker-compose v1, apt-key) ishlatma yoki "eskirgan" deb belgila.
- Versiyalarni aniq ko'rsat.`

const CMD_BLOCK = `
Har bir muhim buyruq uchun avval oddiy kod blokida buyruqni, kutilgan chiqishni ko'rsat, so'ng interaktiv tahlil blokini qo'sh:
\`\`\`tahlil
{"command":"docker run -d -p 8080:80 nginx","parts":[{"t":"docker run","d":"Yangi konteyner yaratib ishga tushiradi"},{"t":"-d","d":"detached — fonda ishlaydi"},{"t":"-p 8080:80","d":"xost 8080-porti → konteyner 80-porti"},{"t":"nginx","d":"image nomi"}]}
\`\`\`
"parts" dagi "t" qiymatlari ketma-ket birlashtirilganda (bo'sh joy bilan) to'liq buyruqni berishi kerak. JSON bitta qatorda, to'g'ri ekranlangan bo'lsin.`

const SECTION_TASK: Record<SectionId, string> = {
  goal: 'Dars maqsadi va natijalarini yoz.',
  why: `"Nega bu kerak?" bo'limini yoz: avval bu texnologiya bo'lmagan paytdagi aniq MUAMMOni hayotiy voqea/misol bilan tasvirla, keyin YECHIM qanday paydo bo'lganini (tarixiy kontekst), muqobillar bilan taqqoslashni (jadval) va DevOps muhandisi kundalik ishida buni qayerda uchratishini yoz. 500–800 so'z.`,
  theory: `"Nazariya — chuqur" bo'limini yoz. Quyidagi "chuqurlik nuqtalari"ning NAZARIY qismini to'liq qamra: har bir tushunchaning ta'rifi, ma'nosi, bir-biri bilan bog'liqligi. Analogiyalar keltir. Oxirida "Atamalar lug'ati" jadvali (Atama | Ma'nosi | Misol). 1200–2000 so'z. Kamida bitta Mermaid diagramma.`,
  internals: `"Ichida qanday ishlaydi" bo'limini yoz: kernel / protokol / algoritm darajasidagi mexanizm. Qadamma-qadam oqim (1, 2, 3...), har qadamda aynan qaysi komponent nima qiladi, qaysi tizim chaqiruvi / paket / fayl ishtirok etadi. Kamida ikkita Mermaid diagramma (sequenceDiagram va flowchart). "O'zingiz ko'ring" — mexanizmni kuzatish uchun aniq buyruqlar va kutilgan chiqish. 1000–1800 so'z.`,
  commands: `"Buyruqlar va konfiguratsiya — qator-qator tahlil" bo'limini yoz. Mavzuning barcha asosiy buyruqlari va konfiguratsiya fayllari: har bir flag, har bir parametr, har bir qator alohida izohlansin; "bu qator o'chirilsa nima bo'ladi" ni ayt. Konfiguratsiya fayllari uchun qator → izoh jadvali ber. Xavfli buyruqlarni "⚠️ Ehtiyot bo'l" bilan belgila.${CMD_BLOCK}`,
  lab: `"Amaliy laboratoriya" bo'limini yoz: 2–3 ta lab. Har biri: Maqsad, Kerakli muhit, qadamma-qadam topshiriqlar (har qadamda buyruq + kutilgan natija), "Tekshirish" buyruqlari, va yechim yashirin holda:
<details><summary>💡 Yechimni ko'rsatish</summary>

...to'liq yechim (kod bloklari bilan)...

</details>
Oxirida "Qo'shimcha chaqiriq" (qiyinroq vazifa). Lablar xavfsiz bo'lsin (VM yoki konteynerda).`,
  breakfix: `"Buzib o'rgan" bo'limini yoz: 3 ta ataylab buzilgan konfiguratsiya/ssenariy. Har biri uchun qisqa vaziyat tavsifi (simptom, xato xabari), so'ng aynan shu formatdagi blok:
\`\`\`breakfix
{"title":"Qisqa nom","lang":"yaml","broken":"buzilgan konfiguratsiya matni (\\n bilan)","hints":["1-ishora (umumiy)","2-ishora (aniqroq)","3-ishora (deyarli javob)"],"solution":"tuzatilgan konfiguratsiya","explain":"Nima buzilgan edi va nega"}
\`\`\`
"lang": yaml | dockerfile | nginx | shell | hcl | ini | json. JSON to'g'ri ekranlangan bo'lsin. Javobni blokdan tashqarida OSHKOR QILMA.`,
  errors: `"Keng tarqalgan xatolar va debug" bo'limini yoz: avval tizimli debug metodikasi (qadamlar, qaror daraxti — Mermaid flowchart), so'ng kamida 8 qatorli jadval: | Xato xabari / simptom | Sabab | Qanday tekshiriladi | Yechim |. Xato xabarlari haqiqiy (aynan terminalda chiqadigan) bo'lsin. Oxirida "Debug uchun asosiy buyruqlar" ro'yxati.`,
  production: `"Production maslahatlari" bo'limini yoz: Security, Performance, Ishonchlilik, Kuzatuv (monitoring), Zaxira va tiklash kichik bo'limlari. Har bir maslahat: nima qilish kerak + nega + aniq konfiguratsiya namunasi. Oxirida "Production ga chiqishdan oldingi tekshiruv ro'yxati" (- [ ] ko'rinishida) va "Anti-pattern lar" jadvali.`,
  quiz: `Mini-test yarat: 10–12 savol. FAQAT JSON massiv qaytar (boshqa matn yo'q). Har bir element:
{"id":"q1","type":"mcq"|"fill"|"bug"|"order","topic":"qisqa mavzu nomi","q":"savol","code":"ixtiyoriy kod","options":["A","B","C","D"],"answer":0,"accept":["javob"],"items":["1-qadam","2-qadam"],"explain":"nega shunday — batafsil"}
- mcq: options (4 ta) + answer (to'g'ri indeks). Kamida 5 ta.
- fill: "buyruqni to'ldir" — q da ___ bo'lsin, accept — qabul qilinadigan javoblar. Kamida 2 ta.
- bug: "xatoni top" — code da xatoli konfiguratsiya, options — ehtimoliy sabablar, answer. Kamida 2 ta.
- order: "tartibga sol" — items TO'G'RI tartibda (ilova o'zi aralashtiradi). Kamida 1 ta.
Savollar yodlashni emas, TUSHUNISHNI tekshirsin. To'g'ri javob indekslari turlicha bo'lsin.`,
  interview: `"Intervyu savollari" bo'limini yoz: 10–12 ta real intervyu savoli (Junior → Senior ortib boruvchi). Har biri: "### N. Savol" sarlavhasi, daraja belgisi (🟢 Junior / 🟡 Middle / 🔴 Senior), namunaviy javob (intervyuda aytiladigan uslubda, 80–200 so'z), "Intervyuer nimani kutadi" va "Qo'shimcha savol" (follow-up).`,
  cheatsheet: `Bir sahifalik "Cheat-sheet" yoz: eng zarur buyruqlar jadvali (Buyruq | Nima qiladi), asosiy konfiguratsiya skeleti, muhim fayl yo'llari va portlar, "Esda tut" (5–7 ta oltin qoida), tez diagnostika ketma-ketligi. Ixcham, chop etishga qulay. 400–600 so'z.`,
  related: 'Bog\'liq darslar.'
}

export function lessonContext(l: Lesson): string {
  return [
    `DARS #${l.id}: ${l.title}`,
    `Qisqacha: ${l.summary}`,
    l.versions.length ? `Versiyalar: ${l.versions.join(', ')}` : '',
    `O'quv maqsadlari:\n${l.objectives.map((o) => `- ${o}`).join('\n')}`,
    `Kalit tushunchalar: ${l.concepts.join(', ')}`,
    `MAJBURIY CHUQURLIK NUQTALARI (hammasini qamrab ol, hech birini tashlab ketma):\n${l.depth.map((d, i) => `${i + 1}. ${d}`).join('\n')}`,
    l.labs.length ? `Lab g'oyalari:\n${l.labs.map((o) => `- ${o}`).join('\n')}` : '',
    l.breakfix.length ? `"Buzib o'rgan" g'oyalari:\n${l.breakfix.map((o) => `- ${o}`).join('\n')}` : '',
    `Test mavzulari: ${l.quizTopics.join(', ')}`,
    l.interview.length ? `Intervyu savollari (shularni ham qo'sh):\n${l.interview.map((o) => `- ${o}`).join('\n')}` : '',
    l.note ? `MUHIM ESLATMA: ${l.note}` : ''
  ].filter(Boolean).join('\n\n')
}

export function sectionPrompt(l: Lesson, section: SectionId): string {
  const m = sectionMeta(section)
  return `${lessonContext(l)}\n\n---\nVAZIFA: shu darsning «${m.icon} ${m.title}» bo'limini yoz.\n${SECTION_TASK[section]}\n${section === 'quiz' ? '' : FORMAT_RULES}`
}

const ctxLine = (l?: Lesson, section?: string) =>
  l ? `\n\nJoriy kontekst — o'quvchi hozir «#${l.id} ${l.title}» darsining «${sectionMeta(section ?? 'theory').title}» bo'limida. Dars mavzulari: ${l.concepts.join(', ')}.` : ''

/** Har bir AI funksiyasi uchun system qo'shimchasi va foydalanuvchi matni */
export function buildRequest(r: AiRequest, l?: Lesson): { system: string; user: string; json: boolean; temperature: number } {
  const sel = r.selection ? `\n\nO'quvchi tanlagan matn/kod:\n"""\n${r.selection.slice(0, 6000)}\n"""` : ''
  switch (r.kind) {
    case 'section':
      return { system: SYSTEM_PROMPT, user: sectionPrompt(l!, r.section!), json: r.section === 'quiz', temperature: 0.4 }
    case 'chat':
      if (r.mode === 'sokrat')
        return { system: `${SYSTEM_PROMPT}\n\nHOZIR SOKRATIK REJIM: to'g'ridan-to'g'ri javob BERMA. O'quvchini javobga yo'naltiruvchi 1–2 ta aniq savol ber, uning javobidagi to'g'ri va noto'g'ri joylarni ko'rsat, kichik ishora ber. Faqat o'quvchi 3 marta urinib ham topa olmasa yoki "javobni ayt" desa — to'liq tushuntir. Qisqa yoz (8-qoidadagi "Xulosa" shart emas).${ctxLine(l, r.section)}`, user: (r.text ?? '') + sel, json: false, temperature: 0.7 }
      return { system: `${SYSTEM_PROMPT}\n\nBu jonli suhbat: savolga mos hajmda javob ber (oddiy savolga qisqa, murakkabiga batafsil). Suhbatda "Xulosa" va tekshiruv savollari faqat katta tushuntirishlarda kerak.${ctxLine(l, r.section)}`, user: (r.text ?? '') + sel, json: false, temperature: 0.6 }
    case 'explain':
      return { system: SYSTEM_PROMPT + ctxLine(l, r.section), user: `Quyidagi ${r.lang || 'buyruq/konfiguratsiya'} ni QATOR-QATOR tahlil qil. Avval bir jumlada umumiy vazifasini ayt. Keyin har bir qator/flag/parametr uchun: nima qiladi, nega kerak, o'chirilsa nima bo'ladi. Buyruqlar uchun \`\`\`tahlil JSON blokini ham qo'sh (format: {"command":"...","parts":[{"t":"...","d":"..."}]}). Xavfli joylarni "⚠️ Ehtiyot bo'l" bilan belgila. Oxirida: yaxshilash bo'yicha tavsiyalar.\n\n\`\`\`${r.lang || ''}\n${(r.text ?? '').slice(0, 12000)}\n\`\`\``, json: false, temperature: 0.3 }
    case 'review':
      return { system: SYSTEM_PROMPT + ctxLine(l, r.section), user: `Senior muhandis sifatida quyidagi ${r.lang || 'kod'} ni CODE REVIEW qil. Tuzilma:\n## Umumiy baho (0–10 va bir jumla)\n## Topilmalar — jadval: | # | Jiddiylik (🔴 kritik / 🟡 o'rta / 🟢 kichik) | Qator | Muammo | Nega muhim | Tuzatish |\nTekshir: xavfsizlik (root, sirlar, ochiq portlar, privileged), ishonchlilik (healthcheck, restart, probe), performance (layer cache, resource limits/requests), best practice (versiyalarni qotirish, latest tegi), sintaksis xatolari.\n## Tuzatilgan variant (to'liq, ishlaydigan kod bloki)\n## Nimani o'rganish kerak (2–3 band)\n\n\`\`\`${r.lang || ''}\n${(r.text ?? '').slice(0, 12000)}\n\`\`\``, json: false, temperature: 0.3 }
    case 'interview':
      return { system: `${SYSTEM_PROMPT}\n\nHOZIR INTERVYU SIMULYATORI: sen texnik intervyuersan. Qoidalar: (1) Har safar FAQAT BITTA savol ber. (2) Nomzod javob bergach: bahola — "**Baho: N/10**", nima to'g'ri, nima yetishmadi, ideal javob qisqacha (3–5 jumla). (3) So'ng darajaga mos keyingi savolni ber (yaxshi javob → qiyinroq; yomon → o'sha mavzuda soddaroq follow-up). (4) 6-savoldan keyin yoki nomzod "yakunla" desa: umumiy xulosa — o'rtacha baho, kuchli tomonlar, bo'shliqlar, o'rganish rejasi. Real intervyu kabi qisqa va aniq gapir.${ctxLine(l, r.section)}`, user: r.text ?? 'Intervyuni boshla. Avval o\'zingni bir jumlada tanishtir va birinchi savolni ber.', json: false, temperature: 0.8 }
    case 'incident':
      return { system: `${SYSTEM_PROMPT}\n\nHOZIR DEBUG O'YINI: sen "production incident" boshlovchisisan. Birinchi xabarda tasodifiy, real hayotga yaqin incident ssenariysini yarat: tizim tavsifi, simptomlar, alert matni, 10–20 qator haqiqatnamo log va 2–3 metrika (jadval). ILDIZ SABABNI AYTMA. O'quvchi buyruq "bajarishni" so'rasa (masalan "kubectl describe pod x" yoki "df -h") — o'sha buyruqning ssenariyga mos haqiqatnamo chiqishini kod blokida ber. O'quvchi gipoteza aytsa: to'g'ri yo'ldami-yo'qmi, ishora ber. U ildiz sababni topsa: "✅ Topdingiz!" de, to'liq tahlil (ildiz sabab, tuzatish, kelajakda oldini olish — postmortem uslubida) va **Baho: N/10** (qadamlar soni va metodikaga qarab) ber.${ctxLine(l, r.section)}`, user: r.text ?? 'Yangi incident ssenariysini boshla.', json: false, temperature: 0.95 }
    case 'quizgen':
      return { system: SYSTEM_PROMPT, user: `${l ? lessonContext(l) + '\n\n---\n' : ''}O'quvchining ZAIF mavzulari (shu mavzularda ko'p xato qilgan): ${(r.weakTopics ?? []).join('; ') || 'aniqlanmagan — dars mavzularidan foydalaning'}.\n\nAynan shu zaif joylarni mustahkamlaydigan 8 ta YANGI savol yarat. ${SECTION_TASK.quiz}`, json: true, temperature: 0.8 }
    case 'recap':
      return { system: SYSTEM_PROMPT, user: `${lessonContext(l!)}\n\n---\n"Bu darsni 5 daqiqada eslat": darsning eng muhim g'oyalarini 5 daqiqada o'qib chiqiladigan qisqa takrorlash sifatida yoz (350–500 so'z). Tuzilma: "Bir jumlada", "Asosiy 5–7 g'oya" (har biri 1–2 jumla), "Eng muhim 5 buyruq" (jadval), "Ko'p adashiladigan joy", "O'zingni tekshir" (3 savol, javoblari <details> ichida).`, json: false, temperature: 0.4 }
    case 'search':
      return { system: `${SYSTEM_PROMPT}\n\nBu qidiruvdan kelgan savol: qisqa va aniq javob ber (150–300 so'z), tashxis qadamlarini buyruqlar bilan ko'rsat. Oxirida kursning qaysi dars(lar)ida bu mavzu borligini "📚 Darslar: #N nomi" ko'rinishida yoz.`, user: `${r.text}\n\nKurs darslari ro'yxati (raqam va nom):\n${r.selection ?? ''}`, json: false, temperature: 0.4 }
    case 'hint':
      return { system: `${SYSTEM_PROMPT}\n\n"Buzib o'rgan" topshirig'i uchun ISHORA berasan. To'g'ridan-to'g'ri javobni va tuzatilgan konfiguratsiyani AYTMA. O'quvchining hozirgi urinishini ko'rib: to'g'ri yo'ldami, qaysi qatorga/tushunchaga e'tibor qaratishi kerak, qanday buyruq bilan tekshirishi mumkin — 3–5 jumla.`, user: `Topshiriq va buzilgan konfiguratsiya:\n${r.selection ?? ''}\n\nO'quvchining hozirgi varianti:\n\`\`\`\n${r.text ?? ''}\n\`\`\``, json: false, temperature: 0.5 }
    case 'grade':
      return { system: SYSTEM_PROMPT, user: `Loyiha topshirig'i:\n${r.selection ?? ''}\n\nO'quvchi hisoboti / konfiguratsiyalari:\n"""\n${(r.text ?? '').slice(0, 14000)}\n"""\n\nSenior muhandis sifatida bahola. Tuzilma: "## Umumiy baho: N/100", har bir talab bo'yicha jadval (| Talab | Holat ✅/⚠️/❌ | Izoh |), "## Kuchli tomonlar", "## Tuzatish kerak" (ustuvorlik bilan), "## Keyingi qadam". Halol va aniq bo'l; dalil ko'rsatilmagan talabni bajarilgan deb hisoblama.`, json: false, temperature: 0.3 }
  }
}
