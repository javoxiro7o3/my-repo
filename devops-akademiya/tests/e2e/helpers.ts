import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

export async function launch(env: Record<string, string> = {}, userData = mkdtempSync(join(tmpdir(), 'da-e2e-'))): Promise<{ app: ElectronApplication; page: Page; userData: string }> {
  const app = await electron.launch({ args: [resolve(__dirname, '../../out/main/index.js'), '--no-sandbox'], env: { ...process.env, DA_USER_DATA: userData, DA_NO_SPLASH: '1', ...env } as Record<string, string> })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  return { app, page, userData }
}
export async function skipOnboarding(page: Page) {
  await page.getByRole('button', { name: 'O\'tkazib yuborish' }).click()
  await page.getByRole('dialog', { name: 'Xush kelibsiz' }).waitFor({ state: 'detached' })
}
