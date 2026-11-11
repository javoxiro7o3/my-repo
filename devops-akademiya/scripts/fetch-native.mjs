#!/usr/bin/env node
// better-sqlite3 ning kerakli platforma uchun prebuild ini native/ papkasiga nusxalaydi.
//
// Nega kerak: Linux da `npm ci` qilinganda node_modules ichidagi .node fayl Linux uchun bo'ladi.
// Windows paketi esa win32-x64 DLL talab qiladi. better-sqlite3 barcha platformalar prebuild larini
// prebuilds/ papkasida olib keladi — biz keraklisini native/ ga olamiz, electron-builder esa uni
// extraResources orqali resources/native/ ga joylaydi. src/main/index.ts paketlangan holatda
// aynan shu yo'ldan o'qiydi: process.resourcesPath/native/<platform>-<arch>.node
//
// Ishlatish:
//   node scripts/fetch-native.mjs            # joriy platforma/arxitektura
//   node scripts/fetch-native.mjs win32      # win32-x64
//   node scripts/fetch-native.mjs win32 arm64
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const platform = process.argv[2] || process.platform
const arch = process.argv[3] || process.arch
const name = `${platform}-${arch}.node`

const require = createRequire(join(root, 'package.json'))
let pkgDir
try {
  pkgDir = dirname(require.resolve('better-sqlite3/package.json'))
} catch {
  console.error('✗ better-sqlite3 topilmadi. Avval `npm ci` ni ishga tushiring.')
  process.exit(1)
}

const src = join(pkgDir, 'prebuilds', name)
if (!existsSync(src)) {
  const have = existsSync(join(pkgDir, 'prebuilds')) ? readdirSync(join(pkgDir, 'prebuilds')).join(', ') : '(yo\'q)'
  console.error(`✗ ${name} prebuild topilmadi.\n  Mavjudlari: ${have}`)
  process.exit(1)
}

const outDir = join(root, 'native')
// Eski platformalar fayllari paketga tushib qolmasligi uchun papkani tozalaymiz
rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })
const dest = join(outDir, name)
copyFileSync(src, dest)

const kb = Math.round(statSync(dest).size / 1024)
console.log(`✓ ${name} (${kb} KB) → native/${name}`)
