import { finishedDuel } from '../e2e/helpers/coachedMatch'
import { startOpening, continueGame, finishStarterGuidance } from '../e2e/helpers/opening'
import { persistentRoster } from '../e2e/helpers/roster'
import { expect, test } from '@playwright/test'
import type { RosterPlayer } from '../src/api/gameApi'

test('compiled client → same-origin API/session → real duel → persisted reward → reload', async ({ page }) => {
  test.setTimeout(45_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await startOpening(page)
  await page.getByRole('button', { name: 'Confirmar cores', exact: true }).click()
  await page.getByRole('button', { name: 'Escolher Aderlou' }).click()
  await finishStarterGuidance(page)
  await expect(page.getByRole('button', { name: 'Equipe · T' })).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible()
  // Walk until the approach dialogue pauses the player. No development-only scene hooks.
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(6000)
  await page.keyboard.up('ArrowRight')
  await page.keyboard.press('Enter', { delay: 80 })
  const response = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/coached-matches'))
  await page.getByRole('button', { name: 'Iniciar desafio' }).click()
  const initial = await (await response).json()
  await page.getByRole('button', { name: 'Pular', exact: true }).click()
  const result = await finishedDuel(page, initial.match.id)
  await expect(page.getByTestId('reward')).toContainText(`+${result.rewards!.xpAwarded} XP`)
  const roster = await (await page.request.get('/api/v1/roster')).json() as RosterPlayer[]
  expect(roster).toHaveLength(1)
  expect(Object.keys(roster[0]!.stats).sort()).toEqual(['defending', 'dribbling', 'finishing', 'physical', 'speed'])
  expect(roster[0]!.xp).toBe(result.rewards!.currentXp)
  expect(roster[0]!.wins + roster[0]!.draws + roster[0]!.losses).toBe(1)
  await page.reload()
  await continueGame(page)
  await expect(page.getByRole('button', { name: 'Equipe · T' })).toBeVisible()
  expect(persistentRoster(await (await page.request.get('/api/v1/roster')).json())).toEqual(persistentRoster(roster))
  expect(errors).toEqual([])
})
