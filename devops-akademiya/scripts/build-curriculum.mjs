// curriculum/*.mjs → src/content/curriculum.json (validatsiya bilan)
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const imp = async (f) => (await import(resolve(root, 'src/content/curriculum', f))).default
const lessons = [...(await imp('m01_04.mjs')), ...(await imp('m05_07.mjs')), ...(await imp('m08_10.mjs')), ...(await imp('m11_13.mjs'))]
const modules = await imp('modules.mjs')
const TOOLS = ['subnet', 'osi', 'nat', 'terminal', 'perms', 'git', 'layers', 'raft', 'k8smap', 'scheduler', 'hpa', 'promql', 'oidc', 'patroni', 'validator']
const errs = []
if (lessons.length !== 73) errs.push(`Darslar soni ${lessons.length}, 73 bo'lishi kerak`)
lessons.forEach((l, i) => {
  if (l.id !== i + 1) errs.push(`Tartib: ${l.id}`)
  if (l.depth.length < 6) errs.push(`#${l.id}: chuqurlik nuqtalari kam`)
  if (l.objectives.length < 2 || l.glossary.length < 3 || !l.labs.length) errs.push(`#${l.id}: to'liq emas`)
  l.related.forEach((r) => { if (r < 1 || r > 73 || r === l.id) errs.push(`#${l.id}: related ${r}`) })
  l.tools.forEach((t) => { if (!TOOLS.includes(t)) errs.push(`#${l.id}: tool ${t}`) })
  const m = modules.find((m) => m.lessons.includes(l.id))
  if (!m || m.id !== l.module) errs.push(`#${l.id}: modul mos emas`)
})
if (errs.length) { console.error(errs.join('\n')); process.exit(1) }
const out = { version: '1.0.0', modules, lessons }
writeFileSync(resolve(root, 'src/content/curriculum.json'), JSON.stringify(out, null, 1))
console.log(`curriculum.json: ${modules.length} modul, ${lessons.length} dars, ${lessons.filter((l) => l.premium).length} premium`)
