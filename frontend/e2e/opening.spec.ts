import { expect, test, type Page } from '@playwright/test'
import { continueGame, startOpening, finishStarterGuidance } from './helpers/opening'

async function state(page: Page, name = 'WorldScene') {
  return page.evaluate(async name => {
    const { game } = await import('/src/main.ts')
    const scene = game.scene.getScene(name)
    if (!game.scene.isActive(name) || !scene.player || scene.choosing) return null
    return { x: scene.player.x as number, y: scene.player.y as number, texture: scene.player.texture.key as string }
  }, name)
}

for (const phone of [false, true]) {
  test.describe(phone ? 'phone opening' : 'desktop opening', () => {
    test.use({ viewport: phone ? { width: 844, height: 390 } : { width: 960, height: 540 },
      screen: phone ? { width: 844, height: 390 } : { width: 960, height: 540 }, hasTouch: phone, isMobile: phone })
    test('graduation, starter, fixed coach, continue and new journey', async ({ page }, testInfo) => {
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      await page.goto('/')
      await expect(page.getByRole('heading', { name: 'Rua 5', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'CONTINUAR', exact: true })).toBeDisabled()
      await expect(page.getByRole('button', { name: 'OPÇÕES', exact: true })).toBeDisabled()
      await page.screenshot({ path: testInfo.outputPath('rua5-menu.png') })
      await startOpening(page, 'Ana da Rua')
      await expect(page.getByText('Miguel: Ana da Rua, como devem ser as cores do seu time?')).toBeVisible()
      await page.getByLabel('Cor principal', { exact: true }).fill('#2266aa')
      await page.getByLabel('Cor secundária', { exact: true }).fill('#dd3344')
      await page.getByRole('button', { name: 'Confirmar cores' }).click()
      await expect(page.getByRole('button', { name: /^Escolher / })).toHaveCount(3)
      await page.getByRole('button', { name: 'Escolher Loraco' }).click()
      await finishStarterGuidance(page)
      await expect.poll(() => state(page)).toMatchObject({ texture: 'coach' })
      const profile = await (await page.request.get('/api/v1/profile')).json()
      expect(profile).toMatchObject({ displayName: 'Ana da Rua', primaryColor: '#2266aa', secondaryColor: '#dd3344' })
      const roster = await (await page.request.get('/api/v1/roster')).json()
      expect(roster).toHaveLength(1)
      expect(roster[0].playerDefinitionId).toBe('starter_rafa')
      if (phone) {
        await expect(page.getByRole('button', { name: 'Mover para a esquerda' })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Mover para a esquerda' })).toBeEnabled()
      }
      await page.keyboard.down('ArrowLeft')
      await expect.poll(async () => (await state(page))?.x).toBeLessThan(430)
      await page.keyboard.up('ArrowLeft')
      const before = (await state(page))!
      await page.waitForTimeout(600)
      await page.reload()
      await expect(page.getByRole('button', { name: 'CONTINUAR', exact: true })).toBeEnabled()
      expect(await state(page)).toBeNull()
      await continueGame(page)
      await expect.poll(() => state(page)).toMatchObject(before)
      expect((await (await page.request.get('/api/v1/roster')).json())[0].id).toBe(roster[0].id)
      await page.screenshot({ path: testInfo.outputPath('rua5-coach.png') })
      await page.reload()
      await startOpening(page, 'Nova jornada')
      await page.getByRole('button', { name: 'Confirmar cores' }).click()
      await page.getByRole('button', { name: 'Escolher Aderlou' }).click()
      await finishStarterGuidance(page)
      const restarted = await (await page.request.get('/api/v1/profile')).json()
      expect(restarted.id).not.toBe(profile.id)
      expect(restarted.displayName).toBe('Nova jornada')
      expect(await (await page.request.get('/api/v1/roster')).json()).toHaveLength(1)
      expect(errors).toEqual([])
    })
  })
}

test('continue restores the interior and Dimas refuses an incomplete roster', async ({ page }, testInfo) => {
  await page.request.post('/api/v1/profiles', { data: { displayName: 'Retomada' } })
  const starter = await (await page.request.post('/api/v1/profile/starter', { data: { playerDefinitionId: 'starter_leo' } })).json()
  await page.goto('/')
  await continueGame(page)
  await expect.poll(() => state(page)).not.toBeNull()
  await page.evaluate(async () => {
    const { game } = await import('/src/main.ts')
    const world = game.scene.getScene('WorldScene')
    world.player.setPosition(world.stadiumPoint.x, world.stadiumPoint.y - 24)
  })
  await page.keyboard.press('e', { delay: 80 })
  await expect.poll(() => state(page, 'InteriorScene')).not.toBeNull()
  await page.keyboard.down('ArrowLeft')
  await expect.poll(async () => (await state(page, 'InteriorScene'))?.x).toBeLessThan(450)
  await page.keyboard.up('ArrowLeft')
  const before = (await state(page, 'InteriorScene'))!
  await page.waitForTimeout(600)
  await page.reload()
  await continueGame(page)
  await expect.poll(() => state(page, 'InteriorScene')).toMatchObject(before)
  await page.evaluate(async () => {
    const { game } = await import('/src/main.ts')
    game.scene.getScene('InteriorScene').player.setPosition(720, 307)
  })
  await page.keyboard.press('e', { delay: 80 })
  await expect.poll(() => page.evaluate(async () => {
    const { game } = await import('/src/main.ts')
    return game.scene.getScene('InteriorScene').dialogue?.list[1]?.text as string
  })).toContain('Você precisa ter pelo menos 5 jogadores')
  await page.screenshot({ path: testInfo.outputPath('dimas-five-required.png') })
  await page.keyboard.press('Enter', { delay: 80 })
  expect(await state(page, 'InteriorScene')).not.toBeNull()
  await expect(page.getByRole('region', { name: 'Estádio', exact: true })).toHaveCount(0)
  const refusal = await page.request.post('/api/v1/stadiums/benfica_stadium/matches', {
    headers: { 'Idempotency-Key': crypto.randomUUID() }, data: { ownedPlayerId: starter.id, seriesId: null, roundNumber: 1 },
  })
  expect(refusal.status()).toBe(409)
  expect((await refusal.json()).code).toBe('STADIUM_ROSTER_INCOMPLETE')
})
