import { expect, test, type Page } from '@playwright/test'
import { continueGame } from './helpers/opening'
import { recruitStadiumRoster } from './helpers/stadiumRoster'
import { persistentRoster } from './helpers/roster'
import type { RosterPlayer, ReleasedPlayer } from '../src/api/gameApi'

const NILO = '00000000-0000-4000-8000-000000000001'
const RUI = '00000000-0000-4000-8000-000000000005'

async function worldPoint(page: Page) {
  return page.evaluate(async () => {
    const entry = '/src/main.ts'
    const { game } = await import(entry)
    const { player } = game.scene.getScene('WorldScene')
    return { x: player.x as number, y: player.y as number }
  })
}

async function releasedNpc(page: Page, definition: string) {
  return page.evaluate(async id => {
    const entry = '/src/main.ts'
    const { game } = await import(entry)
    const scene = game.scene.getScene('WorldScene')
    const npcs = scene.npcs.filter((npc: { content: { playerDefinitionId?: string }; sprite: { active: boolean } }) => npc.content.playerDefinitionId === id && npc.sprite.active)
    return npcs.map((npc: { sprite: { x: number; y: number; body: { enable: boolean } } }) => ({ x: npc.sprite.x, y: npc.sprite.y, collision: npc.sprite.body.enable }))
  }, definition)
}

async function roster(page: Page): Promise<RosterPlayer[]> {
  return (await page.request.get('/api/v1/roster')).json()
}

async function begin(page: Page) {
  await page.request.post('/api/v1/profiles', { data: { displayName: 'Dispensa' } })
  await page.request.post('/api/v1/profile/starter', { data: { playerDefinitionId: 'starter_leo' } })
}

test('full team blocks a sixth signing; dismissal survives lost response and reload, then permits replacement', async ({ page }) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await begin(page)
  await recruitStadiumRoster(page)
  const before = await roster(page)
  for (let attempt = 0; attempt < 60; attempt++) {
    const response = await page.request.post(`/api/v1/challenges/${RUI}/matches`, {
      data: { ownedPlayerId: before[0]!.id }, headers: { 'Idempotency-Key': crypto.randomUUID() },
    })
    expect(response.ok()).toBe(true)
    if ((await response.json()).match.outcome === 'WIN') break
  }
  const rejected = await page.request.post(`/api/v1/challenges/${RUI}/recruit`, { data: {} })
  expect(rejected.status()).toBe(409)
  expect((await rejected.json()).code).toBe('ROSTER_FULL')
  await page.goto('/')
  await continueGame(page)
  const point = await worldPoint(page)
  await page.getByRole('button', { name: 'Equipe · T' }).click()
  await expect(page.locator('.roster-capacity')).toContainText('5/5')
  await expect(page.getByRole('region', { name: 'Recrutamento · Rui' }).getByRole('button', { name: 'Convidar para o time' })).toBeDisabled()
  await page.getByRole('radio', { name: /^Nilo,/ }).check()
  await page.getByRole('button', { name: 'Dispensar Nilo', exact: true }).click()
  await page.getByRole('button', { name: 'Cancelar dispensa' }).click()
  expect(await roster(page)).toHaveLength(5)
  await page.getByRole('button', { name: 'Dispensar Nilo', exact: true }).click()
  const receipts: unknown[] = []
  await page.route('**/roster/*/dismiss', async route => {
    const response = await route.fetch()
    receipts.push(await response.json())
    if (receipts.length === 1) await route.abort('failed')
    else await route.fulfill({ response })
  })
  await page.getByRole('button', { name: 'Confirmar dispensa' }).click()
  await page.getByRole('button', { name: 'Tentar dispensa novamente' }).click()
  await expect(page.getByRole('radio')).toHaveCount(4)
  expect(receipts).toHaveLength(2)
  expect(receipts[0]).toEqual(receipts[1])
  const released = await (await page.request.get('/api/v1/maps/benfica/released-players')).json() as ReleasedPlayer[]
  expect(released).toMatchObject([{ id: NILO, playerDefinitionId: 'npc_nilo_01', ...point }])
  await page.getByRole('button', { name: 'Voltar ao bairro', exact: true }).click()
  await expect.poll(() => releasedNpc(page, 'npc_nilo_01')).toEqual([{ ...point, collision: true }])
  await page.reload()
  await continueGame(page)
  await expect.poll(() => releasedNpc(page, 'npc_nilo_01')).toEqual([{ ...point, collision: true }])
  await page.getByRole('button', { name: 'Equipe · T' }).click()
  await expect(page.getByRole('radio')).toHaveCount(4)
  await page.getByRole('region', { name: 'Recrutamento · Rui' }).getByRole('button', { name: 'Convidar para o time' }).click()
  await expect(page.getByRole('radio')).toHaveCount(5)
  const after = await roster(page)
  expect(after.some(player => player.playerDefinitionId === 'npc_rui_01')).toBe(true)
  expect(after.some(player => player.playerDefinitionId === 'npc_nilo_01')).toBe(false)
  expect(errors).toEqual([])
})

test('last starter becomes a private challenger and can be rehired with preserved progress', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await begin(page)
  const before = await roster(page)
  await page.goto('/')
  await continueGame(page)
  const point = await worldPoint(page)
  await page.getByRole('button', { name: 'Equipe · T' }).click()
  await page.getByRole('button', { name: 'Dispensar Cabeleira' }).click()
  await page.getByRole('button', { name: 'Confirmar dispensa' }).click()
  await expect(page.getByRole('radio')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Recrutamento · Cabeleira' })).toBeVisible()
  await page.getByRole('button', { name: 'Voltar ao bairro', exact: true }).click()
  await expect.poll(() => releasedNpc(page, 'starter_leo')).toEqual([{ ...point, collision: true }])
  await page.reload()
  await continueGame(page)
  await expect.poll(() => releasedNpc(page, 'starter_leo')).toEqual([{ ...point, collision: true }])
  await page.getByRole('button', { name: 'Equipe · T' }).click()
  await page.getByRole('region', { name: 'Recrutamento · Cabeleira' }).getByRole('button', { name: 'Convidar para o time' }).click()
  await expect(page.getByRole('radio')).toHaveCount(1)
  expect(persistentRoster(await roster(page))).toEqual(persistentRoster(before))
  await page.getByRole('button', { name: 'Voltar ao bairro', exact: true }).click()
  await expect.poll(() => releasedNpc(page, 'starter_leo')).toEqual([])
  expect(errors).toEqual([])
})

test('team is accessible inside a building and returns to that interior after dismissal', async ({ page }) => {
  await begin(page)
  await page.goto('/')
  await continueGame(page)
  await page.evaluate(async () => {
    const entry = '/src/main.ts'
    const { game } = await import(entry)
    const world = game.scene.getScene('WorldScene')
    const door = world.doors.find((place: { key: string }) => place.key === 'benfica.gym.entry')
    world.player.setPosition(door.x, door.y + 15)
  })
  const point = await worldPoint(page)
  await page.keyboard.press('e', { delay: 80 })
  await expect.poll(() => page.evaluate(async () => {
    const entry = '/src/main.ts'
    const { game } = await import(entry)
    return game.scene.isActive('InteriorScene')
  })).toBe(true)
  await page.keyboard.press('t', { delay: 80 })
  await page.getByRole('button', { name: 'Dispensar Cabeleira' }).click()
  await page.getByRole('button', { name: 'Confirmar dispensa' }).click()
  await expect(page.getByRole('radio')).toHaveCount(0)
  await page.getByRole('button', { name: 'Voltar ao interior', exact: true }).click()
  await expect.poll(() => page.evaluate(async () => {
    const entry = '/src/main.ts'
    const { game } = await import(entry)
    return { interior: game.scene.isActive('InteriorScene'), world: game.scene.isActive('WorldScene') }
  })).toEqual({ interior: true, world: false })
  await page.keyboard.press('Escape', { delay: 80 })
  await expect.poll(() => releasedNpc(page, 'starter_leo')).toEqual([{ ...point, collision: true }])
})

test.describe('phone dismissal', () => {
  test.use({ viewport: { width: 844, height: 390 }, screen: { width: 844, height: 390 }, hasTouch: true, isMobile: true })
  test('coach can dismiss and rehire an athlete using touch controls', async ({ page }, testInfo) => {
    await begin(page)
    await page.goto('/')
    await continueGame(page)
    await page.getByRole('navigation', { name: 'Controles de toque' }).getByRole('button', { name: 'Equipe', exact: true }).tap()
    await page.getByRole('button', { name: 'Dispensar Cabeleira' }).tap()
    await page.screenshot({ path: testInfo.outputPath('phone-dismissal.png') })
    await page.getByRole('button', { name: 'Confirmar dispensa' }).tap()
    await expect(page.getByRole('radio')).toHaveCount(0)
    await page.getByRole('region', { name: 'Recrutamento · Cabeleira' }).getByRole('button', { name: 'Convidar para o time' }).tap()
    await expect(page.getByRole('radio')).toHaveCount(1)
    await page.getByRole('button', { name: 'Voltar ao bairro', exact: true }).tap()
    await expect(page.getByRole('navigation', { name: 'Controles de toque' })).toBeVisible()
    expect(await roster(page)).toHaveLength(1)
  })
})

test('a released starter can be challenged through its map dialogue and keeps its appearance', async ({ page }) => {
  test.setTimeout(60_000)
  await begin(page)
  const [starter] = await roster(page)
  for (let attempt = 0; attempt < 60; attempt++) {
    const response = await page.request.post(`/api/v1/challenges/${NILO}/matches`, {
      data: { ownedPlayerId: starter!.id }, headers: { 'Idempotency-Key': crypto.randomUUID() },
    })
    if ((await response.json()).match.outcome === 'WIN') break
  }
  expect((await page.request.post(`/api/v1/challenges/${NILO}/recruit`, { data: {} })).ok()).toBe(true)
  await page.goto('/')
  await continueGame(page)
  await page.getByRole('button', { name: 'Equipe · T' }).click()
  await page.getByRole('button', { name: 'Dispensar Cabeleira' }).click()
  await page.getByRole('button', { name: 'Confirmar dispensa' }).click()
  await expect(page.getByRole('radio')).toHaveCount(1)
  await page.getByRole('button', { name: 'Voltar ao bairro', exact: true }).click()
  await expect.poll(() => releasedNpc(page, 'starter_leo')).toHaveLength(1)
  await page.keyboard.press('e', { delay: 80 })
  await expect.poll(() => page.evaluate(async () => {
    const entry = '/src/main.ts'
    const { game } = await import(entry)
    return game.scene.getScene('WorldScene').hud.isDialogueOpen
  })).toBe(true)
  await page.keyboard.press('Enter', { delay: 80 })
  await expect(page.getByText(/Adversário: Cabeleira/)).toBeVisible()
  await page.getByRole('button', { name: 'Iniciar desafio' }).click()
  await expect(page.locator('.duelist.away')).toHaveAttribute('data-avatar', 'player')
  const sprite = page.locator('.duelist.away .duel-sprite')
  expect(decodeURIComponent(await sprite.evaluate(el => (el as HTMLElement).style.backgroundImage))).toContain('fill="#3b291f"')
  await expect(sprite).toHaveCSS('background-size', '256px 240px')
  await page.getByRole('button', { name: 'Pular', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Voltar ao bairro', exact: true })).toBeVisible()
})
