export const XP = { section: 10, lessonDone: 50, quizCorrect: 5, lab: 30, review: 3, project: 200, breakfix: 20 } as const

/** Daraja uchun kerakli jami XP: 0, 100, 250, 450, 700 ... (har daraja +50 qiyinroq) */
export function levelFromXp(xp: number): { level: number; cur: number; need: number; title: string } {
  let level = 1, need = 100, left = xp
  while (left >= need) { left -= need; level++; need += 50 }
  const titles = ['Yangi boshlovchi', 'Shogird', 'Junior DevOps', 'Operator', 'Muhandis', 'Middle DevOps', 'Avtomatlashtiruvchi', 'Senior DevOps', 'SRE', 'Platforma arxitektori', 'Ustoz']
  return { level, cur: left, need, title: titles[Math.min(titles.length - 1, Math.floor((level - 1) / 2))] }
}

export interface BadgeDef { id: string; name: string; desc: string; icon: string }
export const BADGES: BadgeDef[] = [
  { id: 'first-step', name: 'Birinchi qadam', desc: 'Birinchi bo\'limni o\'qib chiqdingiz', icon: '👣' },
  { id: 'linux-ninja', name: 'Linux Ninja', desc: '1-modul (Linux) to\'liq tugatildi', icon: '🥷' },
  { id: 'net-navigator', name: 'Tarmoq Navigatori', desc: '2-modul (Git va Networking) tugatildi', icon: '🧭' },
  { id: 'deploy-master', name: 'Deploy Ustasi', desc: '3-modul (Deployment) tugatildi', icon: '🚀' },
  { id: 'docker-captain', name: 'Docker Captain', desc: '4-modul (Docker) tugatildi', icon: '⚓' },
  { id: 'pipeline-pro', name: 'Pipeline Pro', desc: '5-modul (CI/CD) tugatildi', icon: '🔁' },
  { id: 'iac-architect', name: 'IaC Arxitektori', desc: '6-modul (Terraform va Ansible) tugatildi', icon: '🏗️' },
  { id: 'observer', name: 'Kuzatuvchi', desc: '7-modul (Observability) tugatildi', icon: '🔭' },
  { id: 'k8s-pilot', name: 'K8s Pilot', desc: '8-modul (Kubernetes asoslari) tugatildi', icon: '☸️' },
  { id: 'gitops-guru', name: 'GitOps Guru', desc: '9-modul (GitOps) tugatildi', icon: '🐙' },
  { id: 'vault-keeper', name: 'Sir Saqlovchi', desc: '10-modul (Vault va xavfsizlik) tugatildi', icon: '🔐' },
  { id: 'scaler', name: 'Masshtabchi', desc: '11-modul (Autoscaling va Helm) tugatildi', icon: '📈' },
  { id: 'net-builder', name: 'Tarmoq Quruvchi', desc: '12-modul (Private infra tarmog\'i) tugatildi', icon: '🧱' },
  { id: 'infra-lord', name: 'Infra Hukmdori', desc: '13-modul va butun kurs tugatildi', icon: '👑' },
  { id: 'streak-3', name: 'Uch kun ketma-ket', desc: '3 kunlik streak', icon: '🔥' },
  { id: 'streak-7', name: 'Haftalik olov', desc: '7 kunlik streak', icon: '🔥' },
  { id: 'streak-30', name: 'Temir intizom', desc: '30 kunlik streak', icon: '🏆' },
  { id: 'quiz-50', name: 'Savol ovchisi', desc: '50 ta test savoliga to\'g\'ri javob', icon: '🎯' },
  { id: 'quiz-250', name: 'Bilimdon', desc: '250 ta test savoliga to\'g\'ri javob', icon: '🧠' },
  { id: 'reviewer', name: 'Xotira ustasi', desc: '100 ta kartani takrorladingiz', icon: '♻️' },
  { id: 'breaker', name: 'Buzib tuzatuvchi', desc: '10 ta "Buzib o\'rgan" topshirig\'i yechildi', icon: '🛠️' },
  { id: 'night-owl', name: 'Tungi boyqush', desc: 'Yarim tundan keyin dars qildingiz', icon: '🦉' }
]
export const MODULE_BADGES = ['linux-ninja', 'net-navigator', 'deploy-master', 'docker-captain', 'pipeline-pro', 'iac-architect', 'observer', 'k8s-pilot', 'gitops-guru', 'vault-keeper', 'scaler', 'net-builder', 'infra-lord']
export const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

export function calcStreak(activity: Record<string, number>, now = Date.now()): number {
  let s = 0, t = now
  if (!activity[dayKey(t)]) t -= 86_400_000 // bugun hali o'qilmagan bo'lsa, kechagidan sanaymiz
  while (activity[dayKey(t)]) { s++; t -= 86_400_000 }
  return s
}
