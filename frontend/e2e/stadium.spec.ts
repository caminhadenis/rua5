import { expect, test } from '@playwright/test'
import { talkToStadiumCoach } from './stadiumHelpers'
import type { StadiumInfo, StadiumResponse } from '../src/api/gameApi'

test('stadium entry is explorable and supporters oppose the visitor before coach starts a single duel', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.request.post('/api/v1/profiles', { data: { displayName: 'Estádio individual' } })
  await page.request.post('/api/v1/profile/starter', { data: { playerDefinitionId: 'starter_leo' } })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Equipe · T' })).toBeVisible()
  await page.evaluate(async () => {
    const { game } = await import('/src/main.ts')
    const world = game.scene.getScene('WorldScene')
    world.player.setPosition(world.stadiumPoint.x, world.stadiumPoint.y - 24)
  })
  await page.keyboard.press('e', { delay: 80 })
  await expect.poll(() => page.evaluate(async () => {
    const { game } = await import('/src/main.ts')
    return game.scene.isActive('InteriorScene')
  })).toBe(true)
  await expect(page.getByRole('region', { name: 'Estádio', exact: true })).toHaveCount(0)
  const interior = await page.evaluate(async () => {
    const { game } = await import('/src/main.ts')
    const scene = game.scene.getScene('InteriorScene')
    return { x: scene.player.x as number, y: scene.player.y as number,
      supporters: scene.people.filter((p: { role?: string }) => p.role === 'supporter').length as number }
  })
  expect(interior).toEqual({ x: 480, y: 435, supporters: 4 })
  await page.screenshot({ path: testInfo.outputPath('stadium-interior.png') })
  // A supporter conversation must not issue a match command.
  const matches: string[] = []
  page.on('request', request => { if (request.method() === 'POST' && request.url().includes('/matches')) matches.push(request.url()) })
  await page.evaluate(async () => {
    const { game } = await import('/src/main.ts')
    game.scene.getScene('InteriorScene').player.setPosition(185, 267)
  })
  await page.keyboard.press('e', { delay: 80 })
  await expect.poll(() => page.evaluate(async () => {
    const { game } = await import('/src/main.ts')
    return game.scene.getScene('InteriorScene').dialogue?.list[1]?.text as string
  })).toContain('Hoje você não leva essa taça')
  expect(matches).toEqual([])
  await page.keyboard.press('Escape', { delay: 80 })
  await page.evaluate(async () => {
    const { game } = await import('/src/main.ts')
    game.scene.getScene('InteriorScene').player.setPosition(480, 435)
  })
  await talkToStadiumCoach(page)
  await expect(page.getByText('Professor Dimas · treinador')).toBeVisible()
  await page.getByRole('button', { name: 'Ouvir mais de Dimas' }).click()
  await expect(page.getByText(/mais forte entra por último/)).toBeVisible()
  const receipt = page.waitForResponse(r => r.request().method() === 'POST' && r.url().includes('/stadiums/') && r.url().endsWith('/matches'))
  await page.getByRole('button', { name: 'Iniciar duelo 1 × 1' }).click()
  const result = await (await receipt).json() as StadiumResponse
  expect(result.match.home).toHaveLength(1)
  expect(result.match.away).toHaveLength(1)
  expect(result.rewards.trophy).toBeNull()
  await expect(page.locator('.duelist')).toHaveCount(2)
  await expect(page.locator('.stadium-fan')).toHaveCount(16)
  await expect(page.locator('.fan-flag')).toHaveCount(6)
  await expect(page.locator('.stadium-sideline-coach')).toHaveCount(0)
  await expect(page.locator('.coach-portrait')).toHaveCount(0)
  const checkStands = async (minimumWidth = 56) => {
    const geometry = await page.locator('.stadium-theater').evaluate(theater => {
      const court = theater.querySelector('.duel-arena')!.getBoundingClientRect()
      const spectators = [...theater.querySelectorAll('.stadium-fan, .fan-flag, .stadium-support-banner')]
      const animations = [...theater.querySelectorAll('.stadium-stand')].flatMap(stand => stand.getAnimations({ subtree: true }))
      animations.forEach(animation => animation.pause())
      const overlaps = new Set<string>()
      // Check multiple animation phases, including accessories, not just one screenshot.
      for (const time of [0, 175, 350, 500, 700, 1000, 1400]) {
        animations.forEach(animation => { animation.currentTime = time })
        for (const spectator of spectators) {
          const box = spectator.getBoundingClientRect()
          if (box.left < court.right && box.right > court.left && box.top < court.bottom && box.bottom > court.top) overlaps.add(spectator.className)
        }
      }
      animations.forEach(animation => animation.play())
      return {
        overlaps: [...overlaps],
        widths: [...theater.querySelectorAll('.fan-avatar')].map(el => el.getBoundingClientRect().width),
      }
    })
    expect(geometry.overlaps).toEqual([])
    expect(geometry.widths.every(width => width >= minimumWidth)).toBe(true)
  }
  await page.screenshot({ path: testInfo.outputPath('stadium-duel-crowd.png') })
  await checkStands()
  expect(await page.locator('.stadium-duel-panel').evaluate(panel => {
    return panel.querySelector('.duel-controls')!.getBoundingClientRect().bottom <= panel.getBoundingClientRect().bottom - 4
  })).toBe(true)
  expect(await page.locator('.fan-arm').first().evaluate(el => getComputedStyle(el).animationName)).toBe('fan-arm-wave')
  await page.getByRole('button', { name: 'Pular', exact: true }).click()
  await expect(page.getByTestId('stadium-result')).toBeVisible()
  await expect(page.locator('.duel-arena')).toHaveCount(0)
  await expect(page.locator('.coach-portrait')).toBeVisible()
  await expect(page.locator('.player-cards')).toHaveCount(0)
  // Continue through real losses until the first win, then verify the coach's handoff.
  let outcome = result
  for (let attempt = 0; outcome.match.outcome !== 'WIN' && attempt < 30; attempt++) {
    await page.getByRole('button', { name: 'Recomeçar sequência' }).click()
    const nextReceipt = page.waitForResponse(r => r.request().method() === 'POST' && r.url().includes('/stadiums/') && r.url().endsWith('/matches'))
    await page.getByRole('button', { name: 'Iniciar duelo 1 × 1' }).click()
    outcome = await (await nextReceipt).json() as StadiumResponse
    await page.getByRole('button', { name: 'Pular', exact: true }).click()
    await expect(page.getByTestId('stadium-result')).toBeVisible()
  }
  expect(outcome.match.outcome).toBe('WIN')
  const info = await (await page.request.get('/api/v1/stadiums/benfica_stadium')).json() as StadiumInfo
  const nextOpponent = info.opponentLineup[1]!
  await expect(page.locator('.coach-dialogue')).toContainText('Gostei do que vi')
  await expect(page.locator('.coach-dialogue')).toContainText(`Agora vou colocar ${nextOpponent.name}`)
  await page.screenshot({ path: testInfo.outputPath('coach-announces-next-player.png') })
  await page.getByRole('button', { name: 'Próximo adversário' }).click()
  await expect(page.locator('.stadium-next-opponent')).toContainText(nextOpponent.name)
  await expect(page.getByRole('radio')).toHaveCount(1)
  const secondReceipt = page.waitForResponse(r => r.request().method() === 'POST' && r.url().includes('/stadiums/') && r.url().endsWith('/matches'))
  await page.getByRole('button', { name: 'Iniciar duelo 1 × 1' }).click()
  const second = await (await secondReceipt).json() as StadiumResponse
  expect(second.match.away[0]!.playerId).toBe(nextOpponent.playerId)
  await expect(page.locator('.coach-portrait')).toHaveCount(0)
  await checkStands()
  // The same separation holds on narrow screens, including waving flags.
  await page.setViewportSize({ width: 390, height: 844 })
  await checkStands(40)
  await page.setViewportSize({ width: 960, height: 540 })
  await page.getByRole('button', { name: 'Pular', exact: true }).click()
  await expect(page.getByTestId('stadium-result')).toBeVisible()
  await page.getByRole('button', { name: 'Voltar ao estádio' }).click()
  await expect.poll(() => page.evaluate(async () => {
    const { game } = await import('/src/main.ts')
    return game.scene.isActive('InteriorScene')
  })).toBe(true)
  await page.keyboard.press('ArrowDown', { delay: 180 })
  await page.keyboard.press('Escape', { delay: 80 })
  await expect(page.getByRole('button', { name: 'Equipe · T' })).toBeVisible()
  expect(errors).toEqual([])
})
