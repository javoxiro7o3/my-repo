import { useEffect, useState } from 'react'
import { Database, Download, KeyRound, Palette, RotateCcw, Settings as Cog, Trash2, Upload, Cpu, Activity } from 'lucide-react'
import type { Usage } from '@shared/types'
import { invoke } from '@/lib/api'
import { fmt } from '@/lib/utils'
import { useApp } from '@/store/app'
import { Button, Modal, PageHeader, Segmented, Switch } from '@/components/ui'
import { KeyForm } from '@/components/Overlays'

const Row = ({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-6 py-3.5"><div className="min-w-0"><div className="text-sm font-medium">{title}</div>{desc && <div className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{desc}</div>}</div><div className="shrink-0">{children}</div></div>
)
const Card = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <section className="card mb-5 p-6"><h2 className="mb-2 flex items-center gap-2 text-[15px] font-semibold"><span className="text-accent">{icon}</span>{title}</h2><div className="divide-y">{children}</div></section>
)

export default function Settings() {
  const { settings, setSettings, set, toast, load } = useApp()
  const [usage, setUsage] = useState<Usage | null>(null)
  const [confirm, setConfirm] = useState<'reset' | 'cache' | 'key' | null>(null)
  const [model, setModel] = useState(settings?.model ?? '')
  const [pro, setPro] = useState(settings?.proModel ?? '')
  // Kalit tekshirilganda model avtomatik almashtirilishi mumkin — maydonlarni sinxronlaymiz
  useEffect(() => { setModel(settings?.model ?? ''); setPro(settings?.proModel ?? '') }, [settings?.model, settings?.proModel])
  const refresh = () => invoke<Usage>('usage:get').then(setUsage)
  useEffect(() => { void refresh() }, [])
  if (!settings) return null
  const doConfirm = async () => {
    if (confirm === 'reset') { await invoke('progress:reset'); await load(); toast({ kind: 'ok', title: 'Progress tozalandi' }) }
    if (confirm === 'cache') { await invoke('cache:clear'); void refresh(); toast({ kind: 'ok', title: 'AI kesh tozalandi' }) }
    if (confirm === 'key') { set({ settings: await invoke('key:clear') }); toast({ kind: 'ok', title: 'Kalit o\'chirildi' }) }
    setConfirm(null)
  }
  return (
    <div className="h-full overflow-y-auto"><div className="mx-auto max-w-3xl p-8">
      <PageHeader icon={<Cog size={22} />} title="Sozlamalar" />
      <Card icon={<KeyRound size={17} />} title="Gemini API kaliti">
        <div className="py-3"><div className="mb-3 flex items-center gap-2 text-sm">Holat: {settings.hasKey ? <span className="chip !border-ok/40 !text-ok">✓ Kalit saqlangan (shifrlangan)</span> : <span className="chip !border-warn/40 !text-warn">Kalit kiritilmagan</span>}{settings.hasKey && <Button variant="ghost" size="sm" onClick={() => setConfirm('key')}><Trash2 size={13} /> O'chirish</Button>}</div><KeyForm /></div>
      </Card>
      <Card icon={<Cpu size={17} />} title="Model">
        <Row title="Asosiy model" desc="Darslar, chat va tushuntirishlar uchun. Tez va arzon model tavsiya etiladi."><input value={model} onChange={(e) => setModel(e.target.value)} onBlur={() => model.trim() && setSettings({ model: model.trim() })} className="input w-56 font-mono text-[13px]" aria-label="Asosiy model nomi" list="models" /></Row>
        <Row title="Murakkab mavzular uchun model" desc="Loyiha baholash kabi chuqur tahlil talab qiladigan vazifalar uchun."><input value={pro} onChange={(e) => setPro(e.target.value)} onBlur={() => pro.trim() && setSettings({ proModel: pro.trim() })} className="input w-56 font-mono text-[13px]" aria-label="Murakkab model nomi" list="models" /></Row>
        <datalist id="models">{['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-pro-latest'].map((m) => <option key={m} value={m} />)}</datalist>
        <p className="py-3 text-[12.5px] leading-relaxed text-muted">Model nomlari vaqt o'tishi bilan o'zgaradi — shuning uchun maydon erkin tahrirlanadi. Tanlangan model ishlamasa (Google yopgan, limit 0 yoki band), ilova avtomatik ravishda ishlaydigan modelga o'tadi. Model almashtirilsa, kesh kaliti ham o'zgaradi (eski javoblar saqlanib qoladi).</p>
      </Card>
      <Card icon={<Palette size={17} />} title="Ko'rinish">
        <Row title="Mavzu"><Segmented label="Mavzu" value={settings.theme} onChange={(theme) => setSettings({ theme })} options={[{ value: 'dark', label: 'Tungi' }, { value: 'light', label: 'Kunduzgi' }, { value: 'terminal', label: 'Terminal' }, { value: 'system', label: 'Tizim' }]} /></Row>
        <Row title="O'qish shrifti o'lchami" desc="Ctrl + va Ctrl − bilan ham o'zgartirish mumkin"><div className="flex items-center gap-3"><input type="range" min={13} max={22} value={settings.fontSize} onChange={(e) => setSettings({ fontSize: +e.target.value })} className="w-40 accent-[hsl(var(--accent))]" aria-label="Shrift o'lchami" /><span className="w-10 text-right font-mono text-sm tabular-nums">{settings.fontSize}px</span></div></Row>
        <Row title="Animatsiyalarni kamaytirish" desc="Tizimning prefers-reduced-motion sozlamasi ham avtomatik hisobga olinadi"><Switch label="Animatsiyalarni kamaytirish" checked={settings.reducedMotion} onCheckedChange={(reducedMotion) => setSettings({ reducedMotion })} /></Row>
        <Row title="Ismingiz"><input defaultValue={settings.name} onBlur={(e) => setSettings({ name: e.target.value.trim() })} maxLength={40} className="input w-56" aria-label="Ism" /></Row>
      </Card>
      <Card icon={<Activity size={17} />} title="Foydalanish hisoblagichi (taxminiy)">
        <div className="grid grid-cols-4 gap-3 py-4">{[['Bugun so\'rovlar', usage?.today.requests], ['Jami so\'rovlar', usage?.requests], ['Kirish tokenlari', usage?.inTokens], ['Chiqish tokenlari', usage?.outTokens]].map(([l, v]) => <div key={l as string} className="rounded-lg border bg-elev/50 p-3"><div className="text-xl font-semibold tabular-nums">{fmt(Number(v ?? 0))}</div><div className="text-[11.5px] text-muted">{l}</div></div>)}</div>
        <Row title={`AI kesh: ${fmt(usage?.cacheEntries ?? 0)} ta yozuv`} desc="Keshlangan javoblar internetsiz ochiladi va takroriy so'rov yuborilmaydi (kalit: dars + bo'lim + model + prompt versiyasi)"><Button variant="danger" size="sm" onClick={() => setConfirm('cache')}><Trash2 size={13} /> Keshni tozalash</Button></Row>
      </Card>
      <Card icon={<Database size={17} />} title="Ma'lumotlar">
        <Row title="Progress zaxira nusxasi" desc="Progress, eslatmalar, kartalar va chat tarixi JSON faylga. API kalit zaxiraga kirmaydi."><div className="flex gap-2"><Button size="sm" onClick={async () => { if (await invoke('backup:export')) toast({ kind: 'ok', title: 'Zaxira saqlandi' }) }}><Download size={13} /> Eksport</Button><Button size="sm" onClick={async () => { try { if (await invoke('backup:import')) { await load(); toast({ kind: 'ok', title: 'Zaxiradan tiklandi' }) } } catch (e: any) { toast({ kind: 'error', title: 'Tiklab bo\'lmadi', desc: e.message }) } }}><Upload size={13} /> Tiklash</Button></div></Row>
        <Row title="Progressni noldan boshlash" desc="XP, streak, tugatilgan bo'limlar, kartalar va eslatmalar o'chiriladi. Sozlamalar va AI kesh qoladi."><Button variant="danger" size="sm" onClick={() => setConfirm('reset')}><RotateCcw size={13} /> Tozalash</Button></Row>
        <Row title="Onboarding ni qayta ko'rsatish"><Button size="sm" onClick={() => setSettings({ onboarded: false })}>Ko'rsatish</Button></Row>
      </Card>
      <Modal open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)} title="Ishonchingiz komilmi?" desc={confirm === 'reset' ? 'Butun o\'quv progressi o\'chiriladi. Bu amalni ortga qaytarib bo\'lmaydi (avval zaxira oling).' : confirm === 'cache' ? 'Barcha keshlangan AI javoblari o\'chiriladi. AI yaratgan bo\'limlarni qayta generatsiya qilish kerak bo\'ladi.' : 'Saqlangan API kalit o\'chiriladi.'}>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setConfirm(null)}>Bekor qilish</Button><Button variant="danger" onClick={doConfirm}>Ha, o'chirish</Button></div>
      </Modal>
    </div></div>
  )
}
