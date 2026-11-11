// To'liq foydalanuvchi oqimi: birinchi ishga tushirish → onboarding → dars → bo'limlarni tugatish
// → XP va progress → ilovani qayta ochganda ma'lumot saqlanib qolgani.
// Premium dars (#2) ishlatiladi: u internetsiz va API kalitsiz ishlaydi.
import { test, expect, type Page } from '@playwright/test'
import { SECTION_IDS } from '../../src/shared/sections'
import { XP } from '../../src/shared/gamify'
import { launch } from './helpers'

const LESSON = 2
// Sarlavhadagi chip: "1-daraja · 0 XP" — har bir sahifada ko'rinadi
const xpChip = (page: Page) => page.locator('.chip', { hasText: /daraja · \d+ XP$/ }).first()
const xp = (n: number) => new RegExp(`· ${n} XP$`)
const goto = (page: Page, path: string) => page.evaluate((p) => { location.hash = p }, path)

test('onboarding → dars → bo\'limlar → XP/progress → qayta ochish', async () => {
  test.setTimeout(180_000)
  const { app, page, userData } = await launch()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

  // 1. Birinchi ishga tushirish: onboarding ko'rinadi, o'tkazib yuboriladi
  const onboarding = page.getByRole('dialog', { name: 'Xush kelibsiz' })
  await expect(onboarding).toBeVisible()
  await page.getByRole('button', { name: 'O\'tkazib yuborish' }).click()
  await expect(onboarding).toBeHidden()

  // 2. Boshlang'ich holat: 0 XP, 0 dars
  await expect(xpChip(page)).toHaveText(xp(0))
  await expect(page.getByText('0 / 73 dars tugatilgan')).toBeVisible()

  // 3. Darsni ochish: birinchi bo'lim
  await goto(page, `/lesson/${LESSON}`)
  const complete = page.getByTestId('complete')
  await expect(complete).toBeVisible()
  await expect(complete).toContainText('Bo\'limni tugatdim')

  // 4. Birinchi bo'limni tugatish → +10 XP, keyingi bo'limga o'tadi
  await complete.click()
  await expect(page).toHaveURL(new RegExp(`#/lesson/${LESSON}/${SECTION_IDS[1]}$`))
  await goto(page, '/')
  await expect(xpChip(page)).toHaveText(xp(XP.section))
  await expect(page.getByText('0 / 73 dars tugatilgan')).toBeVisible()

  // 5. Qolgan barcha bo'limlarni ketma-ket tugatish
  await goto(page, `/lesson/${LESSON}/${SECTION_IDS[1]}`)
  for (let i = 1; i < SECTION_IDS.length; i++) {
    await expect(page).toHaveURL(new RegExp(`#/lesson/${LESSON}/${SECTION_IDS[i]}$`))
    await expect(complete).toContainText('Bo\'limni tugatdim', { timeout: 20_000 })
    await complete.click()
  }
  // Oxirgi bo'limdan keyin keyingi darsga o'tadi
  await expect(page).toHaveURL(new RegExp(`#/lesson/${LESSON + 1}`))

  // 6. Dashboard: dars tugatilgan, XP = 13 bo'lim + dars bonusi
  const expectedXp = SECTION_IDS.length * XP.section + XP.lessonDone
  await goto(page, '/')
  await expect(page.getByText('1 / 73 dars tugatilgan')).toBeVisible()
  await expect(xpChip(page)).toHaveText(xp(expectedXp))

  // 7. Qayta bosish XP ni ikki marta bermaydi
  await goto(page, `/lesson/${LESSON}/${SECTION_IDS[0]}`)
  await expect(complete).toContainText('Tugatilgan')
  await complete.click()
  await goto(page, '/')
  await expect(xpChip(page)).toHaveText(xp(expectedXp))

  expect(errors).toEqual([])
  await app.close()

  // 8. Qayta ochish: progress SQLite da saqlangan, onboarding qayta chiqmaydi
  const second = await launch({}, userData)
  await expect(second.page.getByText('1 / 73 dars tugatilgan')).toBeVisible()
  await expect(xpChip(second.page)).toHaveText(xp(expectedXp))
  await expect(second.page.getByRole('dialog', { name: 'Xush kelibsiz' })).toHaveCount(0)
  await second.app.close()
})
