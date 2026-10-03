import { expect, test } from '@playwright/test'

test('enter the training center, choose a sector and complete one five second drill', async ({ page }, testInfo) => {
  expect((await page.request.post('/api/v1/profiles', { data: { displayName: 'Treinador' } })).status()).toBe(201)
  expect((await page.request.post('/api/v1/profile/starter', { data: { playerDefinitionId: 'starter_leo' } })).ok()).toBe(true)
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible()
  await expect.poll(() => page.evaluate(async () => {
    const { game } = await import('/src/main.ts')
    return Boolean(game.scene.getScene('WorldScene')?.player?.body)
  })).toBe(true)
  await page.evaluate(async () => {
    const { game } = await import('/src/main.ts')
    const world = game.scene.getScene('WorldScene')
    const door = world.doors.find((place: { key: string }) => place.key === 'benfica.gym.entry')
    world.player.setPosition(door.x, door.y + 15)
  })
  await page.keyboard.press('e', { delay: 80 })
  await expect.poll(() => page.evaluate(async () => {
    const { game } = await import('/src/main.ts')
    return game.scene.isActive('InteriorScene')
  })).toBe(true)
  await page.keyboard.press('Escape', { delay: 80 })
  const openSector = async (focus: string) => {
    await page.evaluate(async selected => {
      const { game } = await import('/src/main.ts')
      const interior = game.scene.getScene('InteriorScene')
      const coach = interior.people.find((person: { focus?: string }) => person.focus === selected)
      interior.player.setPosition(coach.sprite.x - 34, coach.sprite.y)
    }, focus)
    await page.keyboard.press('e', { delay: 80 })
    const coachWords = await page.evaluate(async () => {
      const { game } = await import('/src/main.ts')
      return game.scene.getScene('InteriorScene').dialogue?.list[1]?.text as string
    })
    expect(coachWords).toContain('Quer treinar este fundamento?')
    expect(coachWords).toContain('Clique Enter para treinar')
    await page.keyboard.press('Enter', { delay: 80 })
  }
  for (const [focus, prop] of [
    ['SPEED', '.training-treadmill'], ['DRIBBLING', '.training-cones'], ['PASSING', '.training-partner'],
    ['FINISHING', '.training-goal'], ['DEFENDING', '.training-partner'], ['PHYSICAL', '.training-weights'],
  ] as const) {
    await openSector(focus)
    const panel = page.locator('.training-panel')
    const stage = panel.getByTestId('training-stage')
    await expect(stage).toHaveAttribute('data-focus', focus)
    await expect(stage.locator(prop)).toBeVisible()
    await expect(stage).toHaveAttribute('aria-label', /Cabeleira/)
    await panel.getByRole('button', { name: 'Voltar ao centro' }).click()
  }
  const before = (await (await page.request.get('/api/v1/roster')).json())[0]
  await openSector('DRIBBLING')
  const panel = page.locator('.training-panel')
  const stage = panel.getByTestId('training-stage')
  await expect(stage.locator('.training-progress')).toContainText('0/5 · faltam 5 para +1')
  await page.screenshot({ path: testInfo.outputPath('training-dribble-preview.png') })
  const started = Date.now()
  await panel.getByRole('button', { name: 'Começar treino' }).click()
  await expect(stage).toHaveClass(/is-playing/)
  await expect(panel.getByRole('button', { name: 'Voltar' })).toBeDisabled()
  expect((await (await page.request.get('/api/v1/roster')).json())[0].stats.dribbling).toBe(before.stats.dribbling)
  await expect(panel.getByRole('status')).toContainText('1/5', { timeout: 12_000 })
  expect(Date.now() - started).toBeGreaterThanOrEqual(4_900)
  const roster = await (await page.request.get('/api/v1/roster')).json()
  expect(roster[0].xp).toBe(before.xp)
  expect(roster[0].stats.dribbling).toBe(before.stats.dribbling)
  expect(roster[0].stats.passing).toBe(before.stats.passing)
  await expect(stage.locator('.training-progress')).toContainText('1/5 · faltam 4 para +1')
  await panel.getByRole('button', { name: 'Voltar ao centro' }).click()
  await openSector('DRIBBLING')
  await expect(panel.getByText(/Próximo treino para Cabeleira em/)).toBeVisible()
  await expect(stage.locator('.training-progress')).toContainText('1/5 · faltam 4 para +1')
  await expect(panel.getByRole('button', { name: 'Começar treino' })).toBeDisabled()
  await page.reload()
  expect((await (await page.request.get('/api/v1/roster')).json())[0].stats.dribbling).toBe(before.stats.dribbling)
})
