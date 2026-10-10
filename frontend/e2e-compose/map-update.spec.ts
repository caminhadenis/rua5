import { continueGame } from '../e2e/helpers/opening'
import { expect, test } from '@playwright/test'
import currentMap from '../src/assets/maps/benfica.json' with { type: 'json' }

test('an old map cached at the previous URL cannot break the updated game', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const oldMap = structuredClone(currentMap)
  oldMap.layers = oldMap.layers.filter(layer => layer.name !== 'houses')
  const interactions = oldMap.layers.find(layer => layer.name === 'interactions')!
  interactions.objects = interactions.objects!.filter(object => object.type !== 'resident')
  // Simulate a browser retaining the previous release's unversioned map.
  let staleMapRequests = 0
  await page.route('**/maps/benfica.json', route => {
    staleMapRequests++
    return route.fulfill({ json: oldMap })
  })
  await page.request.post('/api/v1/profiles', { data: { displayName: 'Map update' } })
  await page.request.post('/api/v1/profile/starter', { data: { playerDefinitionId: 'starter_leo' } })
  const response = await page.goto('/')
  await continueGame(page)
  expect(response!.headers()['cache-control']).toContain('no-cache')
  await expect(page.getByRole('button', { name: 'Equipe · T' })).toBeVisible()
  expect(staleMapRequests).toBe(0)
  expect(errors).toEqual([])
  await page.reload()
  await continueGame(page)
  await expect(page.getByRole('button', { name: 'Equipe · T' })).toBeVisible()
  expect(errors).toEqual([])
})
