import { expect, test } from '@playwright/test'
import type { FatigueStatus, RosterPlayer } from '../src/api/gameApi'
import { continueGame } from './helpers/opening'

const conditions: { name: string; fatigue: FatigueStatus; color: string }[] = [
  { name: 'Disposto', fatigue: { value: 0, condition: 'RESTED', penaltyPercent: 0, nextConditionAt: null, fullyRecoveredAt: null }, color: 'rgb(104, 199, 129)' },
  { name: 'Cansado', fatigue: { value: 45, condition: 'TIRED', penaltyPercent: 5, nextConditionAt: null, fullyRecoveredAt: null }, color: 'rgb(233, 198, 90)' },
  { name: 'Muito cansado', fatigue: { value: 72, condition: 'VERY_TIRED', penaltyPercent: 10, nextConditionAt: null, fullyRecoveredAt: null }, color: 'rgb(237, 151, 83)' },
  { name: 'Exausto', fatigue: { value: 100, condition: 'EXHAUSTED', penaltyPercent: 15, nextConditionAt: null, fullyRecoveredAt: null }, color: 'rgb(220, 100, 100)' },
]

for (const viewport of [{ width: 960, height: 540 }, { width: 844, height: 390 }, { width: 568, height: 320 }]) {
  const phone = viewport.width !== 960
  test.describe(`Energy battery ${viewport.width}`, () => {
    test.use({ viewport, screen: viewport, hasTouch: phone, isMobile: phone })
    test('shows horizontal batteries with remaining energy and accessible conditions, without numeric counters', async ({ page }, testInfo) => {
      await page.request.post('/api/v1/profiles', { data: { displayName: 'Baterias' } })
      await page.request.post('/api/v1/profile/starter', { data: { playerDefinitionId: 'starter_leo' } })
      const [starter] = await (await page.request.get('/api/v1/roster')).json() as RosterPlayer[]
      const roster = conditions.map((item, index) => ({ ...starter!, id: `battery-${index}`, name: `Atleta ${index + 1}`, fatigue: item.fatigue }))
      await page.route('**/api/v1/roster', route => route.fulfill({ json: roster }))
      await page.goto('/')
      await continueGame(page)
      await page.getByRole('button', { name: phone ? 'Equipe' : 'Equipe · T', exact: true }).click()
      const team = page.getByRole('region', { name: 'Equipe', exact: true })
      for (const [index, item] of conditions.entries()) {
        const badge = team.locator('.player-card-fatigue').nth(index)
        await expect(badge).toHaveText('')
        const battery = badge.getByRole('img', { name: `Energia: ${item.name}`, exact: true })
        await expect(battery).toBeVisible()
        const fill = battery.locator('.energy-fill')
        await expect(fill).toHaveCSS('background-color', item.color)
        const shape = await battery.evaluate(element => {
          const box = element.getBoundingClientRect()
          const fill = element.querySelector('.energy-fill')!.getBoundingClientRect()
          return { width: box.width, height: box.height, fillWidth: fill.width, innerWidth: box.width - 8 }
        })
        expect(shape.width).toBeGreaterThan(shape.height)
        expect(shape.fillWidth / shape.innerWidth).toBeCloseTo((100 - item.fatigue.value) / 100, 1)
      }
      // Team supports vertical scrolling; each battery must fit horizontally inside its card.
      for (const battery of await team.locator('.energy-battery').all()) {
        const bounds = await battery.evaluate(element => {
          const box = element.getBoundingClientRect()
          const card = element.closest('.player-card-face')!.getBoundingClientRect()
          return { left: box.left, right: box.right + 5, cardLeft: card.left, cardRight: card.right }
        })
        expect(bounds.left).toBeGreaterThanOrEqual(bounds.cardLeft)
        expect(bounds.right).toBeLessThanOrEqual(bounds.cardRight)
      }
      await page.screenshot({ path: testInfo.outputPath('energy-batteries.png') })
    })
  })
}
