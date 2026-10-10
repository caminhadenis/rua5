import { expect, test, type Page } from '@playwright/test'
import { continueGame } from './helpers/opening'
import type { RecoveryReceipt, RosterPlayer } from '../src/api/gameApi'

async function approachStation(page: Page, stationId: string): Promise<void> {
  await page.evaluate(async id => {
    const { game } = await import('/src/main.ts')
    const { RECOVERY_STATIONS } = await import('/src/game/maps/recoveryCenter.ts')
    const station = RECOVERY_STATIONS.find((item: { id: string }) => item.id === id)!
    game.scene.getScene('InteriorScene').player.setPosition(station.x, station.y + 41)
  }, stationId)
  await page.keyboard.press('e', { delay: 80 })
  await expect(page.locator('.recovery-panel')).toBeVisible()
}

test('remote recovery center treats athletes durably, renders them and preserves retries and cancellation', async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  expect((await page.request.post('/api/v1/profiles', { data: { displayName: 'Centro de recuperação' } })).status()).toBe(201)
  expect((await page.request.post('/api/v1/profile/starter', { data: { playerDefinitionId: 'starter_leo' } })).ok()).toBe(true)
  const roster = () => page.request.get('/api/v1/roster').then(response => response.json()) as Promise<RosterPlayer[]>
  const player = (await roster())[0]!
  expect((await page.request.post('/api/v1/training/sessions', { headers: { 'Idempotency-Key': crypto.randomUUID() }, data: { ownedPlayerId: player.id, focus: 'SPEED' } })).ok()).toBe(true)
  await page.goto('/')
  await continueGame(page)
  await expect(page.getByRole('button', { name: 'Equipe · T' })).toBeVisible()
  await page.evaluate(async () => {
    const { game } = await import('/src/main.ts')
    const world = game.scene.getScene('WorldScene')
    const door = world.doors.find((item: { key: string }) => item.key === 'benfica.recovery.entry')
    world.player.setPosition(door.x, door.y + 15)
  })
  await expect.poll(() => page.evaluate(async () => {
    const { game } = await import('/src/main.ts')
    return game.scene.getScene('WorldScene').cameras.main.worldView.y
  })).toBeGreaterThan(1950)
  await page.screenshot({ path: testInfo.outputPath('remote-recovery-exterior.png') })
  await page.keyboard.press('e', { delay: 80 })
  await expect.poll(() => page.evaluate(async () => {
    const { game } = await import('/src/main.ts')
    return game.scene.isActive('InteriorScene')
  })).toBe(true)
  expect(await page.evaluate(async () => {
    const { game } = await import('/src/main.ts')
    return game.scene.getScene('InteriorScene').people.map((person: { role: string }) => person.role)
  })).toEqual(['physiotherapist', 'masseur'])
  await page.screenshot({ path: testInfo.outputPath('recovery-interior.png') })
  await approachStation(page, 'benfica.recovery.bed.01')
  const panel = page.locator('.recovery-panel')
  await expect(panel).toContainText('5 segundos')
  const keys: string[] = []
  const receipts: RecoveryReceipt[] = []
  await page.route('**/api/v1/recovery/sessions', async route => {
    const response = await route.fetch()
    receipts.push(await response.json() as RecoveryReceipt)
    keys.push(route.request().headers()['idempotency-key']!)
    if (receipts.length === 1) await route.abort('failed')
    else await route.fulfill({ response })
  })
  await panel.getByRole('button', { name: 'Deixar jogador descansando' }).click()
  await panel.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
  await expect(panel.getByRole('status')).toContainText('Jogador entregue')
  expect(receipts).toHaveLength(2)
  expect(receipts[0]).toEqual(receipts[1])
  expect(keys[0]).toBe(keys[1])
  await expect.poll(() => page.evaluate(async () => {
    const { game } = await import('/src/main.ts')
    return game.scene.getScene('InteriorScene').recoveryArt.patients.size
  })).toBe(1)
  await panel.getByRole('button', { name: 'Voltar ao centro' }).click()
  // Cancellation must happen inside the current five-second treatment window.
  await approachStation(page, 'benfica.recovery.bed.01')
  await panel.getByRole('button', { name: 'Interromper recuperação' }).click()
  await expect(panel.getByRole('status')).toContainText('Recuperação interrompida')
  const rested = (await roster())[0]!
  expect(rested.recovery).toBeNull()
  expect(rested.fatigue!.value).toBeLessThan(12)
  expect(rested.fatigue!.value).toBeGreaterThan(0)
  await panel.getByRole('button', { name: 'Voltar ao centro' }).click()
  await page.unroute('**/api/v1/recovery/sessions')
  await approachStation(page, 'benfica.recovery.ice.01')
  await expect(panel).toContainText('5 segundos')
  await panel.getByRole('button', { name: 'Deixar jogador descansando' }).click()
  await expect(panel.getByRole('status')).toContainText('Jogador entregue')
  await panel.getByRole('button', { name: 'Voltar ao centro' }).click()
  await page.screenshot({ path: testInfo.outputPath('athlete-in-ice.png') })
  await page.getByRole('button', { name: 'Equipe · T' }).click()
  await expect(page.locator('.player-card-fatigue')).toContainText('Em recuperação')
  await expect(page.getByRole('button', { name: 'Dispensar Cabeleira' })).toBeDisabled()
  await page.getByRole('button', { name: 'Voltar ao interior' }).click()
  await page.keyboard.press('Escape', { delay: 80 })
  await page.reload()
  await continueGame(page)
  // Saved geometry resumes outside the clinic; treatment completes while exploring or offline.
  await expect.poll(() => page.evaluate(async () => {
    const { game } = await import('/src/main.ts')
    return game.scene.getScene('WorldScene').player.y
  })).toBeGreaterThan(2400)
  await expect.poll(async () => (await roster())[0]!.recovery, { timeout: 10_000, intervals: [100] }).toBeNull()
  expect((await roster())[0]!.fatigue!.value).toBe(0)

  expect(errors).toEqual([])
})


test('phone can approach an ice tub and select a player with visible touch actions', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true })
  const page = await context.newPage()
  expect((await page.request.post('/api/v1/profiles', { data: { displayName: 'Clínica no celular' } })).status()).toBe(201)
  await page.request.post('/api/v1/profile/starter', { data: { playerDefinitionId: 'starter_leo' } })
  const player = (await (await page.request.get('/api/v1/roster')).json())[0] as RosterPlayer
  await page.request.post('/api/v1/training/sessions', { headers: { 'Idempotency-Key': crypto.randomUUID() }, data: { ownedPlayerId: player.id, focus: 'SPEED' } })
  await page.goto('/')
  await continueGame(page)
  await expect(page.getByRole('button', { name: 'Equipe', exact: true })).toBeVisible()
  await page.evaluate(async () => {
    const { game } = await import('/src/main.ts')
    const world = game.scene.getScene('WorldScene')
    const door = world.doors.find((item: { key: string }) => item.key === 'benfica.recovery.entry')
    world.player.setPosition(door.x, door.y + 15)
  })
  await page.getByRole('button', { name: 'Entrar', exact: true }).tap()
  await expect.poll(() => page.evaluate(async () => {
    const { game } = await import('/src/main.ts')
    return game.scene.isActive('InteriorScene')
  })).toBe(true)
  await page.evaluate(async () => {
    const { game } = await import('/src/main.ts')
    game.scene.getScene('InteriorScene').player.setPosition(775, 266)
  })
  await page.getByRole('button', { name: 'Recuperar', exact: true }).tap()
  const panel = page.locator('.recovery-panel')
  await expect(panel).toBeVisible()
  const submit = panel.getByRole('button', { name: 'Deixar jogador descansando' })
  await expect(submit).toBeInViewport()
  await expect(panel.getByRole('button', { name: 'Voltar ao centro' })).toBeInViewport()
  const bounds = await submit.boundingBox()
  expect(bounds!.height).toBeGreaterThanOrEqual(44)
  await page.screenshot({ path: testInfo.outputPath('phone-recovery-selection.png') })
  await submit.tap()
  await expect(panel.getByRole('status')).toContainText('Jogador entregue')
  await context.close()
})
