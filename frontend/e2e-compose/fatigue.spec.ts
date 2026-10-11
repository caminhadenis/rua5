import { finishedDuel } from '../e2e/helpers/coachedMatch'
import type { CoachedResponse } from '../src/api/coachedMatches'
import { startOpening, continueGame, finishStarterGuidance } from '../e2e/helpers/opening'
import { expect, test } from '@playwright/test'
import type { RosterPlayer, TrainingResult } from '../src/api/gameApi'
import { persistentRoster } from '../e2e/helpers/roster'

test('fatigue from real training and duels is visible, affects match stats and survives reload and retry', async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await startOpening(page)
  await page.getByRole('button', { name: 'Confirmar cores', exact: true }).click()
  await page.getByRole('button', { name: 'Escolher Aderlou' }).click()
  await finishStarterGuidance(page)
  await expect(page.getByRole('button', { name: 'Equipe · T' })).toBeVisible()
  const roster = () => page.request.get('/api/v1/roster').then(response => response.json()) as Promise<RosterPlayer[]>
  const [initial] = await roster()
  const payload = { ownedPlayerId: initial!.id }
  const training = await page.request.post('/api/v1/training/sessions', {
    headers: { 'Idempotency-Key': crypto.randomUUID() }, data: { ...payload, focus: 'DRIBBLING' },
  })
  expect(training.ok()).toBe(true)
  const trained = await training.json() as TrainingResult
  expect(trained.fatigue!.after.value).toBe(12)
  expect(trained.statAfter).toBe(initial!.stats.dribbling + 0.25)
  const path = '/api/v1/challenges/00000000-0000-4000-8000-000000000001/matches'
  for (let duel = 0; duel < 3; duel++) {
    const response = await page.request.post(path, { headers: { 'Idempotency-Key': crypto.randomUUID() }, data: payload })
    expect(response.ok()).toBe(true)
  }
  const before = await roster()
  expect(before[0]!.fatigue!.condition).toBe('VERY_TIRED')
  await page.getByRole('button', { name: 'Equipe · T' }).click()
  await expect(page.locator('.player-card-fatigue .energy-battery')).toHaveAttribute('aria-label', 'Energia: Muito cansado')
  await expect(page.locator('.player-card-fatigue')).not.toContainText('rendimento reduzido nos duelos')
  await expect(page.locator('.player-details')).not.toContainText('no início do duelo')
  await expect(page.locator('.team-panel .fatigue-recovery')).toHaveCount(0)
  await expect(page.locator('.player-details dd')).toHaveCount(5)
  await expect(page.locator('.player-details dd').nth(1)).toHaveText(before[0]!.stats.dribbling.toLocaleString('pt-BR'))
  await page.screenshot({ path: testInfo.outputPath('fatigue-team.png') })
  await page.getByRole('button', { name: 'Voltar ao bairro', exact: true }).click()
  await page.reload()
  await continueGame(page)
  await expect(page.getByRole('button', { name: 'Equipe · T' })).toBeVisible()
  const reloaded = await roster()
  expect(persistentRoster(reloaded)).toEqual(persistentRoster(before))
  expect(reloaded[0]!.fatigue!.value).toBeLessThan(before[0]!.fatigue!.value)
  expect(reloaded[0]!.fatigue!.value).toBeGreaterThan(60)
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(6000)
  await page.keyboard.up('ArrowRight')
  await page.keyboard.press('Enter', { delay: 80 })
  await expect(page.locator('.player-card-fatigue .energy-battery')).toHaveAttribute('data-condition', 'VERY_TIRED')
  await expect(page.locator('.player-card-fatigue')).not.toContainText('/100')
  const receipts: CoachedResponse[] = []
  const keys: string[] = []
  await page.route('**/challenges/*/coached-matches', async route => {
    const response = await route.fetch()
    receipts.push(await response.json() as CoachedResponse)
    keys.push(route.request().headers()['idempotency-key']!)
    if (receipts.length === 1) await route.abort('failed')
    else await route.fulfill({ response })
  })
  await page.getByRole('button', { name: 'Iniciar desafio' }).click()
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
  await page.getByRole('button', { name: 'Pular', exact: true }).click()
  expect(receipts).toHaveLength(2)
  expect(receipts[0]).toEqual(receipts[1])
  expect(keys[0]).toBe(keys[1])
  const result = await finishedDuel(page, receipts[0]!.match.id)
  expect(result.rewards!.fatigue!.before.penaltyPercent).toBe(10)
  await expect(page.locator('.duel-controls .fatigue-status .energy-battery')).toHaveAttribute('data-condition', result.rewards!.fatigue!.after.condition)
  await expect(page.locator('.duel-controls .fatigue-status')).not.toContainText('Desgaste +')
  const after = await roster()
  expect(after[0]!.fatigue!.value).toBeLessThan(85)
  expect(after[0]!.fatigue!.value).toBeGreaterThan(80)
  expect(after[0]!.wins + after[0]!.draws + after[0]!.losses).toBe(4)
  expect(errors).toEqual([])
})
