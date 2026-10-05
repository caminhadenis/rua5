import { expect, test } from '@playwright/test'
import type { DuelResponse, RosterPlayer } from '../src/api/gameApi'
import { expectPanelFits } from './helpers/mobilePanel'

for (const viewport of [{ width: 667, height: 375 }, { width: 568, height: 320 }]) {
  test.describe(`compact phone ${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport, screen: viewport, hasTouch: true, isMobile: true })

    test('five athletes and a result with level up and recruitment keep actions visible', async ({ page }, testInfo) => {
      await page.request.post('/api/v1/profiles', { data: { displayName: 'Painéis compactos' } })
      await page.request.post('/api/v1/profile/starter', { data: { playerDefinitionId: 'starter_leo' } })
      const roster = await (await page.request.get('/api/v1/roster')).json() as RosterPlayer[]
      let displayedRoster = [roster[0], ...['Nilo', 'Cora', 'Davi', 'Bia'].map((name, index) => ({ ...roster[0], id: `layout-${index}`, name, playerDefinitionId: 'npc_nilo' }))]
      // Presentation fixtures exercise a full roster and the tallest result. The separate
      // mobile smoke executes the unmodified backend match and persistent rewards.
      await page.route('**/api/v1/roster', route => route.fulfill({ json: displayedRoster }))
      await page.route('**/api/v1/challenges/*', async route => {
        const response = await route.fetch()
        await route.fulfill({ json: { ...await response.json(), recruitmentStatus: 'AVAILABLE', recruitable: true } })
      })
      await page.route('**/api/v1/challenges/*/matches', async route => {
        const response = await route.fetch()
        const result = await response.json() as DuelResponse
        await route.fulfill({ json: { ...result, match: { ...result.match, outcome: 'WIN', homeScore: 2, awayScore: 0 }, rewards: { ...result.rewards, previousLevel: 1, currentLevel: 2, recruitmentUnlocked: true } } })
      })
      await page.goto('/')
      const controls = page.getByRole('navigation', { name: 'Controles de toque' })
      await expect(controls).toBeVisible()
      await page.evaluate(async () => {
        const { game } = await import('/src/main.ts')
        const world = game.scene.getScene('WorldScene')
        const npc = world.npcs.find((npc: { content: { name: string } }) => npc.content.name === 'Nilo')
        world.player.setPosition(npc.sprite.x - 48, npc.sprite.y)
      })
      await expect(controls.getByRole('button', { name: 'Desafiar', exact: true })).toBeEnabled()
      await controls.getByRole('button', { name: 'Desafiar', exact: true }).tap()
      await expect(page.getByRole('radio')).toHaveCount(5)
      await expectPanelFits(page, '.duel-selection-panel')
      const cards = await page.locator('.player-cards').evaluate(element => ({ content: element.scrollHeight, height: element.clientHeight }))
      expect(cards.content).toBeLessThanOrEqual(cards.height + 1)
      await page.screenshot({ path: testInfo.outputPath('five-athletes.png') })
      await page.getByRole('button', { name: 'Iniciar desafio' }).tap()
      await expect(page.getByRole('button', { name: 'Pular', exact: true })).toBeVisible()
      await expectPanelFits(page, '.duel-panel')
      await page.getByRole('button', { name: 'Pular', exact: true }).tap()
      await expect(page.getByRole('button', { name: 'Convidar para o time' })).toBeVisible()
      await expectPanelFits(page, '.duel-panel')
      const result = await page.locator('.duel-controls').evaluate(element => ({ content: element.scrollHeight, height: element.clientHeight }))
      expect(result.content).toBeLessThanOrEqual(result.height + 1)
      await page.screenshot({ path: testInfo.outputPath('level-up-and-invite.png') })
      await page.getByRole('button', { name: 'Voltar ao bairro' }).tap()
      await expect(controls).toBeVisible()
      displayedRoster = Array.from({ length: 30 }, (_, index) => ({ ...roster[0], id: `large-${index}`, name: `Atleta ${index + 1}` }))
      await expect(controls.getByRole('button', { name: 'Desafiar', exact: true })).toBeEnabled()
      await controls.getByRole('button', { name: 'Desafiar', exact: true }).tap()
      await expect(page.getByRole('radio')).toHaveCount(30)
      await expectPanelFits(page, '.duel-selection-panel')
      const largeRoster = await page.locator('.player-cards').evaluate(element => ({ content: element.scrollHeight, height: element.clientHeight }))
      expect(largeRoster.content).toBeGreaterThan(largeRoster.height)
    })
  })
}
