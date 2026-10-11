import { expect, test, type Page } from '@playwright/test'
import { continueGame } from './helpers/opening'
import { expectPanelFits } from './helpers/mobilePanel'
import { recruitStadiumRoster } from './helpers/stadiumRoster'
import type { CoachedResponse } from '../src/api/coachedMatches'

async function prepare(page: Page) {
  await page.request.post('/api/v1/profiles', { data: { displayName: 'Treinador de campo' } })
  await page.request.post('/api/v1/profile/starter', { data: { playerDefinitionId: 'starter_rafa' } })
}
async function openDuel(page: Page) {
  await page.goto('/')
  await continueGame(page)
  await expect.poll(() => page.evaluate(async () => {
    const { game } = await import('/src/main.ts')
    return game.scene.isActive('WorldScene') && !game.scene.getScene('WorldScene').choosing
  })).toBe(true)
  await page.keyboard.down('ArrowRight')
  try {
    await expect.poll(() => page.evaluate(async () => {
      const { game } = await import('/src/main.ts')
      return game.scene.getScene('WorldScene').hud.isDialogueOpen as boolean
    }), { timeout: 8000, intervals: [30] }).toBe(true)
  } finally { await page.keyboard.up('ArrowRight') }
  await page.keyboard.press('Enter', { delay: 80 })
  await page.getByRole('button', { name: 'Iniciar desafio' }).click()
  await expect(page.getByRole('button', { name: 'Continuar partida' })).toBeVisible()
  return (await (await page.request.get('/api/v1/coached-matches/active')).json()).active as CoachedResponse
}

test('coach has two instruction pauses, retries a lost step, reloads and finishes with one reward', async ({ page }, testInfo) => {
  test.setTimeout(70_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await prepare(page)
  const start = await openDuel(page)
  await expect(page.locator('.coach-help')).toHaveCount(0)
  await expect(page.locator('.coach-controls')).not.toContainText('Cansaço:')
  await expect(page.locator('.coach-controls select')).toHaveCount(0)
  await expect(page.locator('.coach-option')).toHaveCount(6)
  await expect(page.locator('.coach-steps span')).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Normal', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Equilibrado', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(start.step).toBe(0)
  expect(start.match.outcome).toBeNull()
  expect(start.rewards).toBeNull()
  await expect(page.getByTestId('sideline-coach')).toBeVisible()
  await expect(page.getByTestId('current-event')).toContainText('recebe suas orientações na lateral')
  await page.getByRole('group', { name: 'Ritmo', exact: true }).getByRole('button', { name: 'Apressar', exact: true }).focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'Apressar', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Normal', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('group', { name: 'Postura', exact: true }).getByRole('button', { name: 'Ofensivo', exact: true }).click()
  await page.getByRole('button', { name: 'Acelerar · 1×' }).click()
  const firstPromise = page.waitForResponse(r => r.url().endsWith('/advance'))
  await page.getByRole('button', { name: 'Continuar partida' }).click()
  const first = await (await firstPromise).json() as CoachedResponse
  expect(first.instruction).toEqual({ tempo: 'FAST', posture: 'OFFENSIVE' })
  await expect(page.getByTestId('sideline-coach')).toBeHidden()
  await expect(page.getByTestId('current-event')).toHaveAttribute('data-sequence', /[1-9]/)
  await expect(page.getByTestId('reward')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Continuar partida' })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('coach-status')).toContainText('Orientação 2/2 · intervalo · relógio parado')
  await expect(page.getByTestId('sideline-coach')).toBeVisible()
  const before = await (await page.request.get(`/api/v1/coached-matches/${start.match.id}`)).json() as CoachedResponse
  expect(before.step).toBe(3)
  await page.screenshot({ path: testInfo.outputPath('coach-pause.png') })
  await page.reload()
  await continueGame(page)
  await expect(page.getByTestId('sideline-coach')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Apressar', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('group', { name: 'Ritmo', exact: true }).getByRole('button', { name: 'Cadenciar', exact: true }).click()
  await page.getByRole('group', { name: 'Postura', exact: true }).getByRole('button', { name: 'Defensivo', exact: true }).click()
  const keys: string[] = []
  let retryKey: string | undefined
  let original: CoachedResponse | undefined
  await page.route('**/coached-matches/*/advance', async route => {
    const key = route.request().headers()['idempotency-key']!
    keys.push(key)
    if (retryKey && key !== retryKey) { await route.continue(); return }
    const response = await route.fetch()
    if (!original) { retryKey = key; original = await response.json() as CoachedResponse; await route.abort('failed') }
    else { expect(await response.json()).toEqual(original); await route.fulfill({ response }) }
  })
  await page.getByRole('button', { name: 'Continuar partida' }).click()
  await page.getByRole('button', { name: 'Recuperar trecho' }).click()
  await expect(page.getByTestId('reward')).toBeVisible({ timeout: 30_000 })
  expect(keys).toHaveLength(3)
  expect(keys[0]).toBe(keys[1])
  expect(keys[2]).not.toBe(keys[1])
  await page.unroute('**/coached-matches/*/advance')
  await expect(page.getByTestId('sideline-coach')).toBeHidden()
  const finished = await (await page.request.get(`/api/v1/coached-matches/${start.match.id}`)).json() as CoachedResponse
  expect(finished.finished).toBe(true)
  await expect(page.getByTestId('home-score')).toHaveText(String(finished.match.homeScore))
  await expect(page.getByTestId('reward')).toContainText(`+${finished.rewards!.xpAwarded} XP`)
  await page.getByRole('button', { name: 'Voltar ao bairro' }).click()
  const [athlete] = await (await page.request.get('/api/v1/roster')).json()
  expect(athlete.wins + athlete.draws + athlete.losses).toBe(1)
  expect(athlete.xp).toBe(finished.rewards!.currentXp)
  expect(errors).toEqual([])
})

test('continuous mode applies a pending instruction to the next segment and completes automatically', async ({ page }) => {
  test.setTimeout(60_000)
  await prepare(page)
  await openDuel(page)
  const responses: CoachedResponse[] = []
  page.on('response', response => { if (response.url().endsWith('/advance')) void response.json().then(value => responses.push(value as CoachedResponse)) })
  await page.getByLabel('Pausar para orientar').uncheck()
  await page.getByRole('button', { name: 'Acelerar · 1×' }).click()
  await page.getByRole('button', { name: 'Continuar partida' }).click()
  await expect(page.getByTestId('coach-status')).toContainText('Trecho 1/5')
  await page.getByRole('group', { name: 'Ritmo', exact: true }).getByRole('button', { name: 'Apressar', exact: true }).click()
  await page.getByRole('group', { name: 'Postura', exact: true }).getByRole('button', { name: 'Ofensivo', exact: true }).click()
  await expect(page.getByTestId('coach-status')).toContainText('próximo trecho')
  await expect(page.getByTestId('reward')).toBeVisible({ timeout: 40_000 })
  expect(responses).toHaveLength(5)
  expect(responses[0]!.instruction.tempo).toBe('NORMAL')
  expect(responses[1]!.instruction).toEqual({ tempo: 'FAST', posture: 'OFFENSIVE' })
})

for (const viewport of [{ width: 960, height: 540 }, { width: 844, height: 390 }, { width: 667, height: 375 }, { width: 568, height: 320 }]) {
  test.describe(`coach layout ${viewport.width}`, () => {
    const phone = viewport.width !== 960
    test.use({ viewport, screen: viewport, hasTouch: phone, isMobile: phone })
    test('street and stadium commands fit, change instructions and resume after reload', async ({ page }, testInfo) => {
      test.setTimeout(90_000)
      await prepare(page)
      await openDuel(page)
      const press = async (name: string) => {
        const command = page.getByRole('button', { name, exact: true })
        if (phone) await command.tap()
        else await command.click()
      }
      const fits = async () => {
        await expectPanelFits(page, phone ? '.coached-duel-panel' : '.coach-controls')
        const size = await page.locator('.coached-duel-panel').evaluate(panel => ({ height: panel.clientHeight, content: panel.scrollHeight }))
        expect(size.content).toBeLessThanOrEqual(size.height + 1)
        await expect(page.getByTestId('sideline-coach')).toBeVisible()
        await expect.poll(() => page.locator('.duel-arena').evaluate(arena => {
          const stage = arena.getBoundingClientRect()
          const avatars = ['.duelist.home', '.duel-coach', '.coach-talk'].map(selector => arena.querySelector(selector)!.getBoundingClientRect())
          const [player, coach] = avatars
          const closeEnoughToTalk = Math.abs(player!.x + player!.width / 2 - coach!.x - coach!.width / 2) <= player!.width * 1.25
          const playerSprite = arena.querySelector('.duelist.home .duel-sprite')!.getBoundingClientRect()
          const sameScale = Math.abs(playerSprite.width - coach!.width) <= 1
          return sameScale && closeEnoughToTalk && avatars.every(avatar => avatar.left >= stage.left && avatar.right <= stage.right && avatar.top >= stage.top && avatar.bottom <= stage.bottom)
        })).toBe(true)
      }
      await press('Apressar')
      await press('Ofensivo')
      await expect(page.locator('.coach-option[aria-pressed="true"]')).toHaveCount(2)
      await fits()
      await page.screenshot({ path: testInfo.outputPath('coach-phone.png') })
      await press('Pular')
      await expect(page.getByTestId('reward')).toBeVisible()
      await press('Voltar ao bairro')
      await recruitStadiumRoster(page)
      const [athlete] = await (await page.request.get('/api/v1/roster')).json()
      const response = await page.request.post('/api/v1/stadiums/benfica_stadium/coached-matches', { data: { ownedPlayerId: athlete.id, seriesId: null, roundNumber: 1 }, headers: { 'Idempotency-Key': crypto.randomUUID() } })
      expect(response.ok()).toBe(true)
      await page.reload()
      await continueGame(page)
      await expect(page.locator('.stadium-theater')).toBeVisible()
      await press('Cadenciar')
      await press('Defensivo')
      await fits()
      await page.screenshot({ path: testInfo.outputPath('coach-stadium-phone.png') })
      await press('Pular')
      await expect(page.getByTestId('stadium-result')).toBeVisible()
      await press('Voltar ao estádio')
      await expect.poll(() => page.evaluate(async () => {
        const { game } = await import('/src/main.ts')
        return game.scene.isActive('InteriorScene')
      })).toBe(true)
    })
  })
}
