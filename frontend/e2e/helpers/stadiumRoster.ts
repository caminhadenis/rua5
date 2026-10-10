import { expect, type Page } from '@playwright/test'

/** Prepare the required roster through actual duels and recruitment commands. */
export async function recruitStadiumRoster(page: Page): Promise<void> {
  const roster = await (await page.request.get('/api/v1/roster')).json()
  const athlete = roster[0]
  for (const suffix of ['001', '002', '003', '004']) {
    const id = `00000000-0000-4000-8000-000000000${suffix}`
    let won = false
    for (let attempt = 0; attempt < 50; attempt++) {
      const response = await page.request.post(`/api/v1/challenges/${id}/matches`, {
        data: { ownedPlayerId: athlete.id }, headers: { 'Idempotency-Key': crypto.randomUUID() },
      })
      expect(response.ok()).toBe(true)
      if ((await response.json()).match.outcome === 'WIN') { won = true; break }
    }
    expect(won).toBe(true)
    expect((await page.request.post(`/api/v1/challenges/${id}/recruit`, { data: {} })).ok()).toBe(true)
  }
  expect(await (await page.request.get('/api/v1/roster')).json()).toHaveLength(5)
}
