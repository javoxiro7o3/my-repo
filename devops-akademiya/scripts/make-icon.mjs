// build/icon.svg → build/icon.png (512) va build/icon.ico (16…256, PNG kadrlar)
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
const require = createRequire(import.meta.url)
let chromium
try { ({ chromium } = require('playwright')) } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')) }
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(resolve(root, 'build/icon.svg'), 'utf8')
const sysChrome = process.env.CHROME_PATH || '/opt/pw-browsers/chromium'
const browser = await chromium.launch(existsSync(sysChrome) ? { executablePath: sysChrome } : {})
const render = async (size) => {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`)
  const buf = await page.screenshot({ omitBackground: true, type: 'png' })
  await page.close(); return buf
}
writeFileSync(resolve(root, 'build/icon.png'), await render(512))
const sizes = [16, 24, 32, 48, 64, 128, 256]
const pngs = []; for (const s of sizes) pngs.push(await render(s))
await browser.close()
const header = Buffer.alloc(6); header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4)
const dir = Buffer.alloc(16 * sizes.length); let offset = 6 + dir.length
sizes.forEach((s, i) => { const o = i * 16; dir.writeUInt8(s === 256 ? 0 : s, o); dir.writeUInt8(s === 256 ? 0 : s, o + 1); dir.writeUInt16LE(1, o + 4); dir.writeUInt16LE(32, o + 6); dir.writeUInt32LE(pngs[i].length, o + 8); dir.writeUInt32LE(offset, o + 12); offset += pngs[i].length })
writeFileSync(resolve(root, 'build/icon.ico'), Buffer.concat([header, dir, ...pngs]))
console.log('icon.png, icon.ico tayyor:', sizes.join(', '))
