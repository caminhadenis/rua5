import { startOpening, continueGame, finishStarterGuidance } from './helpers/opening'
import { expect, test } from '@playwright/test'

test('choose team colors before a starter and restore the uniform after reload', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await startOpening(page)
  await expect(page.getByRole('heading', { name: 'Escolha as cores do seu time' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Escolher / })).toHaveCount(0)
  await page.getByLabel('Cor principal', { exact: true }).fill('#2266aa')
  await page.getByLabel('Cor secundária', { exact: true }).fill('#dd3344')
  expect(decodeURIComponent(await page.getByRole('img', { name: 'Prévia do uniforme do time' }).evaluate(el => el.style.backgroundImage)))
    .toContain('#2266aa')
  await page.screenshot({ path: testInfo.outputPath('team-colors.png') })
  await page.getByRole('button', { name: 'Confirmar cores' }).click()
  await expect(page.getByRole('button', { name: /^Escolher / })).toHaveCount(3)
  const portraits = await page.getByRole('img', { name: /com o uniforme escolhido/ }).all()
  expect(portraits).toHaveLength(3)
  const uniforms = await Promise.all(portraits.map(portrait => portrait.evaluate(el => decodeURIComponent((el as HTMLElement).style.backgroundImage))))
  expect(new Set(uniforms).size).toBe(3)
  for (const uniform of uniforms) { expect(uniform).toContain('#2266aa'); expect(uniform).toContain('#dd3344') }
  await page.screenshot({ path: testInfo.outputPath('starter-choices.png') })
  const profile = await (await page.request.get('/api/v1/profile')).json()
  expect(profile).toMatchObject({ primaryColor: '#2266aa', secondaryColor: '#dd3344', starterSelected: false })
  await page.reload()
  await continueGame(page)
  await page.getByRole('button', { name: 'Escolher primeiro jogador' }).click()
  await page.getByRole('button', { name: 'Escolher Cabeleira' }).click()
  await finishStarterGuidance(page)
  await expect(page.getByRole('button', { name: 'Equipe · T' })).toBeVisible()
  const uniformPixels = () => page.evaluate(async () => {
    const entry = '/src/main.ts'
    const { game } = await import(entry)
    const sprite = game.scene.getScene('WorldScene').player
    const canvas = document.createElement('canvas')
    canvas.width = 128; canvas.height = 120
    const context = canvas.getContext('2d')!
    context.drawImage(sprite.texture.getSourceImage(), 0, 0)
    return [Array.from(context.getImageData(10, 20, 1, 1).data), Array.from(context.getImageData(10, 30, 1, 1).data)]
  })
  expect(await uniformPixels()).toEqual([[239, 241, 223, 255], [36, 53, 74, 255]])
  await page.reload()
  await continueGame(page)
  await expect(page.getByRole('button', { name: 'Equipe · T' })).toBeVisible()
  expect(await uniformPixels()).toEqual([[239, 241, 223, 255], [36, 53, 74, 255]])
  await page.getByRole('button', { name: 'Equipe · T' }).click()
  await expect(page.getByRole('radio')).toHaveCount(1)
  expect(decodeURIComponent(await page.locator('.player-card-sprite').evaluate(el => (el as HTMLElement).style.backgroundImage)))
    .toContain('#2266aa')
  expect(errors).toEqual([])
})
