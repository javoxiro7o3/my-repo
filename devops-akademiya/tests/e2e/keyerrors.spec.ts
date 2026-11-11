// API kalit xatolari: Google ning asl sababi foydalanuvchiga ko'rinishi kerak.
// Haqiqiy Google o'rniga mahalliy soxta server (DA_GEMINI_BASE) ishlatiladi.
import { test, expect } from '@playwright/test'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { launch, skipOnboarding } from './helpers'

const CASES = [
  { name: 'hudud', status: 400, error: { status: 'FAILED_PRECONDITION', message: 'User location is not supported for the API use.' }, expect: /hududingizda[\s\S]*Google javobi: FAILED_PRECONDITION: User location is not supported/ },
  { name: 'noto\'g\'ri kalit', status: 400, error: { status: 'INVALID_ARGUMENT', message: 'API key not valid. Please pass a valid API key.' }, expect: /API kalit noto'g'ri[\s\S]*API key not valid/ },
  { name: 'limit 0', status: 429, error: { status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded for metric: generate_content_free_tier_requests, limit: 0' }, expect: /bepul limit yo'q \(limit: 0\)/ }
]

let server: Server
let current = CASES[0]
test.beforeAll(async () => {
  server = createServer((_req, res) => { res.writeHead(current.status, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: { code: current.status, ...current.error } })) })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
})
test.afterAll(() => server.close())

test('Sozlamalar: kalitni tekshirishda Google sababi ko\'rsatiladi', async () => {
  const { app, page } = await launch({ DA_GEMINI_BASE: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1beta` })
  await skipOnboarding(page)
  await page.evaluate(() => { location.hash = '/settings' })
  const input = page.locator('#apikey')
  for (const c of CASES) {
    current = c
    await input.fill('AIzaSyTEST_' + 'x'.repeat(28))
    await page.getByRole('button', { name: 'Tekshirish' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Google javobi' })).toHaveText(c.expect, { timeout: 15_000 })
    await expect(page.getByRole('status').filter({ hasText: 'Google javobi' })).not.toContainText('AIzaSyTEST')
  }
  await app.close()
})
