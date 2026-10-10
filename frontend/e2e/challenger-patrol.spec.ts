import { expect, test, type Page } from '@playwright/test'
import { continueGame } from './helpers/opening'

async function patrolState(page: Page) {
  return page.evaluate(async () => {
    const { game } = await import('/src/main.ts')
    const world = game.scene.getScene('WorldScene')
    if (!world.npcs?.[0]?.sprite.active) return null
    return {
      npcs: world.npcs.filter((npc: { content: { kind: string } }) => npc.content.kind === 'challenger').map((npc: {
        sprite: { x: number; y: number; body: { left: number; top: number; width: number; height: number } }
      }) => ({ x: npc.sprite.x, y: npc.sprite.y, left: npc.sprite.body.left, top: npc.sprite.body.top,
        width: npc.sprite.body.width, height: npc.sprite.body.height })),
      talking: world.hud.isDialogueOpen as boolean,
      approaching: world.encounterLocked as boolean,
    }
  })
}

test('challengers patrol, keep their collisions aligned and pause for conversations and team menus', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.request.post('/api/v1/profiles', { data: { displayName: 'Patrulha' } })
  await page.request.post('/api/v1/profile/starter', { data: { playerDefinitionId: 'starter_leo' } })
  await page.goto('/')
  await continueGame(page)
  await expect.poll(() => patrolState(page)).not.toBeNull()
  const before = (await patrolState(page))!
  await expect.poll(async () => {
    const after = (await patrolState(page))!
    return after.npcs.filter((npc, index) => Math.hypot(npc.x - before.npcs[index]!.x, npc.y - before.npcs[index]!.y) > 8).length
  }).toBe(16)
  const walking = (await patrolState(page))!
  for (const npc of walking.npcs) {
    expect(npc.width).toBe(18)
    expect(npc.height).toBe(14)
    expect(npc.left).toBeCloseTo(npc.x - 9)
    expect(npc.top).toBeCloseTo(npc.y + 6)
  }
  await page.screenshot({ path: testInfo.outputPath('challengers-patrolling.png') })
  await page.evaluate(async () => {
    const { game } = await import('/src/main.ts')
    const world = game.scene.getScene('WorldScene')
    world.player.setPosition(world.challenger.x - 75, world.challenger.y)
  })
  await expect.poll(async () => (await patrolState(page))!.talking).toBe(true)
  const talking = (await patrolState(page))!
  await page.waitForTimeout(300)
  expect((await patrolState(page))!.npcs).toEqual(talking.npcs)
  // Closing near the NPC must not retrigger a conversation on every patrol tick.
  await page.keyboard.press('Escape', { delay: 80 })
  await page.waitForTimeout(300)
  expect((await patrolState(page))!.talking).toBe(false)
  await page.getByRole('button', { name: 'Equipe · T' }).click()
  await expect(page.getByRole('button', { name: 'Voltar ao bairro', exact: true })).toBeVisible()
  const sleeping = (await patrolState(page))!
  await page.waitForTimeout(300)
  expect((await patrolState(page))!.npcs).toEqual(sleeping.npcs)
  await page.getByRole('button', { name: 'Voltar ao bairro', exact: true }).click()
  await page.evaluate(async () => {
    const { game } = await import('/src/main.ts')
    game.scene.getScene('WorldScene').player.setPosition(160, 400)
  })
  const resumed = (await patrolState(page))!
  await expect.poll(async () => {
    const after = (await patrolState(page))!
    return Math.hypot(after.npcs[0]!.x - resumed.npcs[0]!.x, after.npcs[0]!.y - resumed.npcs[0]!.y)
  }).toBeGreaterThan(8)
  expect(errors).toEqual([])
})

test('a released starter patrols without changing its saved location and disappears when rehired', async ({ page }) => {
  await page.request.post('/api/v1/profiles', { data: { displayName: 'Dispensado' } })
  await page.request.post('/api/v1/profile/starter', { data: { playerDefinitionId: 'starter_leo' } })
  await page.goto('/')
  await continueGame(page)
  await expect.poll(() => patrolState(page)).not.toBeNull()
  await page.getByRole('button', { name: 'Equipe · T' }).click()
  await page.getByRole('button', { name: 'Dispensar Cabeleira' }).click()
  await page.getByRole('button', { name: 'Confirmar dispensa' }).click()
  await expect(page.getByRole('radio')).toHaveCount(0)
  const saved = await (await page.request.get('/api/v1/maps/benfica/released-players')).json()
  await page.getByRole('button', { name: 'Voltar ao bairro', exact: true }).click()
  const releasedPosition = () => page.evaluate(async () => {
    const { game } = await import('/src/main.ts')
    const world = game.scene.getScene('WorldScene')
    const sprite = world.releasedNpcs[0]?.sprite
    return sprite?.active ? { x: sprite.x as number, y: sprite.y as number } : null
  })
  await expect.poll(releasedPosition).toEqual({ x: saved[0].x, y: saved[0].y })
  await page.evaluate(async () => {
    const { game } = await import('/src/main.ts')
    game.scene.getScene('WorldScene').player.setPosition(464, 400)
  })
  await expect.poll(async () => {
    const position = (await releasedPosition())!
    return Math.hypot(position.x - saved[0].x, position.y - saved[0].y)
  }).toBeGreaterThan(8)
  expect(await (await page.request.get('/api/v1/maps/benfica/released-players')).json()).toEqual(saved)
  await page.getByRole('button', { name: 'Equipe · T' }).click()
  await page.getByRole('region', { name: 'Recrutamento · Cabeleira' }).getByRole('button', { name: 'Convidar para o time' }).click()
  await expect(page.getByRole('radio')).toHaveCount(1)
  await page.getByRole('button', { name: 'Voltar ao bairro', exact: true }).click()
  await expect.poll(releasedPosition).toBeNull()
})

test.describe('phone patrol', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true })

  test('patrols pause in portrait and resume in landscape', async ({ page }) => {
    await page.request.post('/api/v1/profiles', { data: { displayName: 'Celular' } })
    await page.request.post('/api/v1/profile/starter', { data: { playerDefinitionId: 'starter_leo' } })
    await page.goto('/')
    await continueGame(page)
    await expect.poll(() => patrolState(page)).not.toBeNull()
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('heading', { name: 'Vire o celular para jogar' })).toBeVisible()
    await page.waitForTimeout(150)
    const paused = (await patrolState(page))!
    await page.waitForTimeout(300)
    expect((await patrolState(page))!.npcs).toEqual(paused.npcs)
    await page.setViewportSize({ width: 844, height: 390 })
    await expect.poll(async () => Math.abs((await patrolState(page))!.npcs[0]!.x - paused.npcs[0]!.x)).toBeGreaterThan(8)
  })
})
