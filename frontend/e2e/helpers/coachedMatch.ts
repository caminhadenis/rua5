import { expect, type Page } from '@playwright/test'
import type { CoachedResponse } from '../../src/api/coachedMatches'
import type { DuelResponse, StadiumResponse } from '../../src/api/gameApi'

export async function finishedDuel(page: Page, id: string): Promise<DuelResponse> {
  await expect(page.getByTestId('match-result')).toBeVisible()
  const response = await (await page.request.get(`/api/v1/coached-matches/${id}`)).json() as CoachedResponse
  expect(response.finished).toBe(true)
  return { match: response.match as DuelResponse['match'], rewards: response.rewards }
}

export async function finishedStadium(page: Page, id: string): Promise<StadiumResponse> {
  await expect(page.getByTestId('stadium-result')).toBeVisible()
  const response = await (await page.request.get(`/api/v1/coached-matches/${id}`)).json() as CoachedResponse
  expect(response.finished).toBe(true)
  return { match: response.match as StadiumResponse['match'], rewards: response.stadiumRewards! }
}

/** Existing presentation fixtures replay historical events independently of the incremental engine. */
export async function presentHistoricalMatch(page: Page, result: DuelResponse): Promise<void> {
  await page.route('**/challenges/*/coached-matches', route => route.fulfill({ json: {
    match: { ...result.match, mode: 'DUEL_1V1', sourceId: 'fixture', outcome: null, homeScore: 0, awayScore: 0, penalties: null, events: [] },
    step: 0, totalSteps: 5, elapsedSeconds: 0, finished: false,
    instruction: { tempo: 'NORMAL', posture: 'BALANCED' }, homeFatigue: 0, awayFatigue: 0, roundNumber: null, rewards: null, stadiumRewards: null,
  } }))
  await page.getByRole('button', { name: 'Iniciar desafio' }).click()
  await expect(page.getByRole('button', { name: 'Continuar partida' })).toBeVisible()
  await page.evaluate(async result => {
    const { game } = await import('/src/main.ts')
    game.scene.stop('MatchScene')
    game.scene.run('MatchScene', result)
  }, result)
  await expect(page.getByRole('button', { name: 'Continuar partida' })).toHaveCount(0)
}
