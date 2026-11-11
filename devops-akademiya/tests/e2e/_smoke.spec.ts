import { test } from '@playwright/test'
import { launch, skipOnboarding } from './helpers'
const S = '/tmp/claude-0/-home-user/5aed6ae9-5a2d-5067-97a1-6a26dde840eb/scratchpad/'
const L = Number(process.env.L || 2)
test('lesson', async () => {
  test.setTimeout(240000)
  const { app, page } = await launch()
  const errs: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') errs.push(page.url().split('#')[1] + ' :: ' + m.text().slice(0, 300)) })
  page.on('pageerror', (e) => errs.push(page.url().split('#')[1] + ' :: PAGEERROR ' + e.message.slice(0, 300)))
  await skipOnboarding(page)
  await page.keyboard.press('Control+/'); await page.waitForTimeout(300)
  const bad: string[] = []
  for (const s of ['why', 'theory', 'internals', 'commands', 'lab', 'breakfix', 'errors', 'production', 'quiz', 'interview', 'cheatsheet']) {
    await page.evaluate((x) => { location.hash = x }, `/lesson/${L}/${s}`); await page.waitForTimeout(s === 'breakfix' ? 3500 : 2200)
    const n = await page.getByText('Diagrammani chizib bo\'lmadi').count(); if (n) bad.push(`${s}: ${n} mermaid xato`)
    const empty = await page.getByText('Bu bo\'lim hali yaratilmagan').count(); if (empty) bad.push(`${s}: BO'SH`)
    const raw = await page.locator('pre code:has-text("{\\"command\\"")').count(); if (raw) bad.push(`${s}: ${raw} tahlil JSON xato`)
    const rawbf = await page.locator('pre code:has-text("{\\"title\\"")').count(); if (rawbf) bad.push(`${s}: ${rawbf} breakfix JSON xato`)
    if (process.env.SHOT?.includes(s)) await page.screenshot({ path: S + `l${L}-${s}.png`, fullPage: false })
  }
  console.log('BAD', JSON.stringify(bad)); console.log('ERRS', JSON.stringify([...new Set(errs)], null, 1))
  await app.close()
})
