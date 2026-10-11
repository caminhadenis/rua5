import { continueGame } from './helpers/opening'
import { expect, test } from '@playwright/test'
import { TRAINING_INTRO } from '../src/game/maps/trainingCenter'
import { expectPanelFits } from './helpers/mobilePanel'

for (const viewport of [{ width: 960, height: 540 }, { width: 844, height: 390 }, { width: 568, height: 320 }]) {
  const phone = viewport.width !== 960
  test.describe(`Training center ${viewport.width}`, () => {
    test.use({ viewport, screen: viewport, hasTouch: phone, isMobile: phone })
    test('enter the training center, choose a sector and repeat drills immediately without duplicating a confirmed session', async ({ page }, testInfo) => {
      expect((await page.request.post('/api/v1/profiles', { data: { displayName: 'Treinador' } })).status()).toBe(201)
      expect((await page.request.post('/api/v1/profile/starter', { data: { playerDefinitionId: 'starter_leo' } })).ok()).toBe(true)
      await page.goto('/')
      await continueGame(page)
      await expect(page.locator('canvas')).toBeVisible()
      await expect.poll(() => page.evaluate(async () => {
        const { game } = await import('/src/main.ts')
        return Boolean(game.scene.getScene('WorldScene')?.player?.body)
      })).toBe(true)
      await page.evaluate(async () => {
        const { game } = await import('/src/main.ts')
        const world = game.scene.getScene('WorldScene')
        const door = world.doors.find((place: { key: string }) => place.key === 'benfica.gym.entry')
        world.player.setPosition(door.x, door.y + 15)
      })
      await page.keyboard.press('e', { delay: 80 })
      await expect.poll(() => page.evaluate(async () => {
        const { game } = await import('/src/main.ts')
        return game.scene.isActive('InteriorScene')
      })).toBe(true)
      const introductionWords = () => page.evaluate(async () => {
        const { game } = await import('/src/main.ts')
        return game.scene.getScene('InteriorScene').dialogue?.list[1]?.text as string
      })
      for (const words of TRAINING_INTRO) {
        await expect.poll(introductionWords).toContain(words)
        // One teaching point per speech, without accumulating previous explanations.
        for (const other of TRAINING_INTRO.filter(line => line !== words)) expect(await introductionWords()).not.toContain(other)
        if (phone) {
          await expect(page.getByRole('region', { name: 'Conversa', exact: true })).toContainText(words)
          await page.getByRole('navigation', { name: 'Controles de toque' }).getByRole('button', { name: 'Continuar', exact: true }).tap()
        } else await page.keyboard.press('Enter', { delay: 80 })
      }
      const openSector = async (focus: string) => {
        await page.evaluate(async selected => {
          const { game } = await import('/src/main.ts')
          const interior = game.scene.getScene('InteriorScene')
          const coach = interior.people.find((person: { focus?: string }) => person.focus === selected)
          interior.player.setPosition(coach.sprite.x - 34, coach.sprite.y)
        }, focus)
        await page.keyboard.press('e', { delay: 80 })
        const coachWords = await page.evaluate(async () => {
          const { game } = await import('/src/main.ts')
          return game.scene.getScene('InteriorScene').dialogue?.list[1]?.text as string
        })
        expect(coachWords).toContain('Quer treinar este fundamento?')
        expect(coachWords).toContain('Clique Enter para treinar')
        await page.keyboard.press('Enter', { delay: 80 })
      }
      for (const [focus, prop] of [
        ['SPEED', '.training-treadmill'], ['DRIBBLING', '.training-cones'],
        ['FINISHING', '.training-goal'], ['DEFENDING', '.training-partner'], ['PHYSICAL', '.training-weights'],
      ] as const) {
        await openSector(focus)
        const panel = page.locator('.training-panel')
        const stage = panel.getByTestId('training-stage')
        await expect(stage).toHaveAttribute('data-focus', focus)
        await expect(stage.locator(prop)).toBeVisible()
        await expect(stage).toHaveAttribute('aria-label', /Cabeleira/)
        await panel.getByRole('button', { name: 'Voltar ao centro' }).click()
      }
      expect(await page.evaluate(async () => {
        const { game } = await import('/src/main.ts')
        return game.scene.getScene('InteriorScene').people.filter((person: { focus?: string }) => person.focus).length
      })).toBe(5)
      const before = (await (await page.request.get('/api/v1/roster')).json())[0]
      expect(Object.keys(before.stats).sort()).toEqual(['defending', 'dribbling', 'finishing', 'physical', 'speed'])
      await openSector('DRIBBLING')
      const panel = page.locator('.training-panel')
      const stage = panel.getByTestId('training-stage')
      await expect(stage.locator('.training-progress')).toHaveCount(0)
      await expect(panel).not.toContainText('+0,25')
      await expect(panel).not.toContainText('ganho')
      if (phone) await expectPanelFits(page, '.training-panel')
      await page.screenshot({ path: testInfo.outputPath('training-dribble-preview.png') })
      const battery = panel.locator('.energy-battery')
      const energyBefore = await battery.evaluate(element => parseFloat((element as HTMLElement).style.getPropertyValue('--energy-level')))
      const started = Date.now()
      await panel.getByRole('button', { name: 'Começar treino' }).click()
      await expect(stage).toHaveClass(/is-playing/)
      await expect(panel.getByRole('button', { name: 'Voltar' })).toBeDisabled()
      expect((await (await page.request.get('/api/v1/roster')).json())[0].stats.dribbling).toBe(before.stats.dribbling)
      await expect(panel.getByRole('status')).toHaveText('Treino concluído!', { timeout: 12_000 })
      expect(Date.now() - started).toBeGreaterThanOrEqual(4_900)
      const roster = await (await page.request.get('/api/v1/roster')).json()
      expect(roster[0].xp).toBe(before.xp)
      expect(roster[0].level).toBe(before.level)
      expect(roster[0].stats.dribbling).toBe(before.stats.dribbling + 0.25)
      expect(roster[0].stats.finishing).toBe(before.stats.finishing)
      expect(await battery.evaluate(element => parseFloat((element as HTMLElement).style.getPropertyValue('--energy-level')))).toBeLessThan(energyBefore)
      await expect(panel.locator('.player-card-fatigue')).not.toContainText('/100')
      await expect(panel).not.toContainText('→')
      await expect(stage.locator('.training-progress')).toHaveCount(0)
      await expect(panel.getByRole('button', { name: 'Treinar novamente' })).toBeEnabled()
      let secondSessionCount = 0
      let loseRosterRefresh = false
      await page.route('**/api/v1/training/sessions', async route => {
        const response = await route.fetch()
        secondSessionCount++
        loseRosterRefresh = true
        await route.fulfill({ response })
      })
      await page.route('**/api/v1/roster', async route => {
        if (loseRosterRefresh) {
          loseRosterRefresh = false
          await route.abort('failed')
        } else await route.continue()
      })
      await panel.getByRole('button', { name: 'Treinar novamente' }).click()
      await expect(panel.getByRole('button', { name: 'Tentar novamente', exact: true })).toBeVisible({ timeout: 12_000 })
      await panel.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
      await expect(panel.getByRole('status')).toHaveText('Treino concluído!')
      expect(secondSessionCount).toBe(1)
      const repeated = (await (await page.request.get('/api/v1/roster')).json())[0]
      expect(repeated.stats.dribbling).toBe(before.stats.dribbling + 0.5)
      expect(repeated.fatigue.value).toBeGreaterThan(20)
      expect(repeated.fatigue.value).toBeLessThanOrEqual(24)
      await expect(panel.getByRole('button', { name: 'Treinar novamente' })).toBeEnabled()
      await panel.getByRole('button', { name: 'Voltar ao centro' }).click()
      await openSector('DRIBBLING')
      await expect(panel.getByText(/Próximo treino para Cabeleira em/)).toHaveCount(0)
      await expect(stage.locator('.training-progress')).toHaveCount(0)
      await expect(panel.getByRole('button', { name: 'Começar treino' })).toBeEnabled()
      await page.reload()
      await continueGame(page)
      expect((await (await page.request.get('/api/v1/roster')).json())[0].stats.dribbling).toBe(before.stats.dribbling + 0.5)
    })
  })
}
