// Paketlangan ilovani sinash (electron-builder --dir natijasi).
// Ishga tushirish: DA_PACKAGED_EXE=dist-linux-test/linux-unpacked/devops-akademiya npm run e2e -- packaged
// Maqsad: app.isPackaged=true holatida better-sqlite3 resources/native/ dan yuklanishini tekshirish.
import { test, expect, _electron as electron } from '@playwright/test'
import { existsSync, mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const exe = process.env.DA_PACKAGED_EXE
test.skip(!exe, 'DA_PACKAGED_EXE berilmagan')

test('paketlangan ilova: SQLite native modul yuklanadi, ma\'lumot saqlanadi', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'da-pkg-'))
  const app = await electron.launch({ executablePath: resolve(exe!), args: ['--no-sandbox'], env: { ...process.env, DA_USER_DATA: userData, DA_NO_SPLASH: '1' } as Record<string, string> })
  const errors: string[] = []
  app.process().stderr?.on('data', (d) => { const s = String(d); if (/Error|better_sqlite3|\.node/.test(s)) errors.push(s) })
  const page = await app.firstWindow()
  expect(await app.evaluate(({ app }) => app.isPackaged)).toBe(true)
  await page.getByRole('button', { name: 'O\'tkazib yuborish' }).click()
  await expect(page.getByRole('dialog', { name: 'Xush kelibsiz' })).toBeHidden()
  await app.close()
  const db = join(userData, 'akademiya.db')
  expect(existsSync(db)).toBe(true)
  expect(statSync(db).size).toBeGreaterThan(0)
  expect(errors).toEqual([])
})
