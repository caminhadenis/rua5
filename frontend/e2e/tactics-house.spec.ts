import { expect, test } from '@playwright/test'
import { continueGame } from './helpers/opening'
import { expectPanelFits } from './helpers/mobilePanel'
import { TACTICS_GREETING, TACTICS_LESSONS } from '../src/game/maps/tacticsRoom'

for (const viewport of [{ width: 960, height: 540 }, { width: 844, height: 390 }, { width: 568, height: 320 }]) {
  const phone = viewport.width !== 960
  test.describe(`Amélia tactics visit ${viewport.width}`, () => {
    test.use({ viewport, screen: viewport, hasTouch: phone, isMobile: phone })
    test('receives, guides and teaches the visitor, with a reusable mural and no progression changes', async ({ page }, testInfo) => {
      test.setTimeout(45_000)
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      await page.request.post('/api/v1/profiles', { data: { displayName: 'Visitante da Amélia' } })
      await page.request.post('/api/v1/profile/starter', { data: { playerDefinitionId: 'starter_leo' } })
      const before = await (await page.request.get('/api/v1/roster')).json()
      await page.goto('/')
      await continueGame(page)
      await expect.poll(() => page.evaluate(async () => {
        const { game } = await import('/src/main.ts')
        return game.scene.isActive('WorldScene') && !game.scene.getScene('WorldScene').choosing
      })).toBe(true)
      await page.evaluate(async () => {
        const { game } = await import('/src/main.ts')
        const world = game.scene.getScene('WorldScene')
        const door = world.doors.find((d: { key: string }) => d.key === 'benfica.house.01.entry')
        world.player.body.reset(door.x, door.y - 13)
      })
      const panel = page.getByRole('region', { name: 'Mural de táticas da Dona Amélia' })
      const positions: number[] = []
      await expect.poll(() => page.evaluate(async () => {
        const { game } = await import('/src/main.ts')
        return game.scene.isActive('InteriorScene')
      })).toBe(true)
      await expect.poll(async () => {
        const position = await page.evaluate(async () => {
          const { game } = await import('/src/main.ts')
          const room = game.scene.getScene('InteriorScene')
          const coach = room.people.find((p: { role: string }) => p.role === 'tactics-coach').sprite
          return { y: coach.y, phase: room.tacticsVisit.phase, frame: coach.frame.name }
        })
        positions.push(position.y)
        return position.phase
      }, { intervals: [50] }).toBe('greeting')
      expect(new Set(positions).size).toBeGreaterThan(2)
      for (const words of TACTICS_GREETING) {
        await expect(panel).toContainText(words)
        await expect(panel.locator('p:not(.story-speaker)')).toHaveCount(1)
        await expectPanelFits(page, '.tactics-panel')
        if (words !== TACTICS_GREETING.at(-1)) await panel.getByRole('button', { name: 'Continuar', exact: true }).click()
      }
      await page.getByRole('button', { name: 'Ir ao mural', exact: true }).click()
      if (viewport.width === 844) {
        await page.setViewportSize({ width: 390, height: 844 })
        await expect(page.getByText('Vire o celular para jogar')).toBeVisible()
        const position = () => page.evaluate(async () => {
          const { game } = await import('/src/main.ts')
          const room = game.scene.getScene('InteriorScene')
          return { x: room.player.x, y: room.player.y }
        })
        const paused = await position()
        await page.waitForTimeout(250) // Give the guided walk time to move if rotation failed to pause it.
        expect(await position()).toEqual(paused)
        await page.setViewportSize(viewport)
      }
      await expect(panel).toBeVisible()
      await expect(panel).toContainText('Ritmo: apressar')
      const arrival = await page.evaluate(async () => {
        const { game } = await import('/src/main.ts')
        const room = game.scene.getScene('InteriorScene')
        const coach = room.people.find((p: { role: string }) => p.role === 'tactics-coach').sprite
        return { x: room.player.x, y: room.player.y, coachX: coach.x, coachY: coach.y }
      })
      expect(arrival).toEqual({ x: 480, y: 290, coachX: 420, coachY: 290 })
      for (const [index, lesson] of TACTICS_LESSONS.entries()) {
        await expect(panel).toContainText(lesson.title)
        await expect(panel).toContainText(lesson.text)
        await expect(panel.locator('p:not(.story-speaker)')).toHaveCount(1)
        await expectPanelFits(page, '.tactics-panel')
        if (index === 0) await page.screenshot({ path: testInfo.outputPath('amelia-tempo.png') })
        if (index === 1) {
          await panel.getByRole('button', { name: 'Anterior', exact: true }).click()
          await expect(panel).toContainText(TACTICS_LESSONS[0]!.text)
          await panel.getByRole('button', { name: 'Próxima dica', exact: true }).click()
          await expect(panel).toContainText(lesson.text)
        }
        await panel.getByRole('button', { name: index === TACTICS_LESSONS.length - 1 ? 'Concluir visita' : 'Próxima dica', exact: true }).click()
      }
      await expect(panel).toHaveCount(0)
      // The wall itself can be consulted, without starting another guided walk.
      if (phone) await page.getByRole('button', { name: 'Ler mural', exact: true }).tap()
      else await page.keyboard.press('Enter', { delay: 80 })
      await expect(panel).toContainText('Ritmo: apressar')
      await page.getByRole('button', { name: 'Fechar mural', exact: true }).click()
      await expect(panel).toHaveCount(0)
      // Team navigation remains available after the optional visit.
      if (phone) await page.getByRole('button', { name: 'Equipe', exact: true }).tap()
      else await page.getByRole('button', { name: 'Equipe · T', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Voltar ao interior', exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Voltar ao interior', exact: true }).click()
      // Returning to a saved room receives the visitor again; the tour can be skipped.
      await page.reload()
      await continueGame(page)
      await page.getByRole('button', { name: 'Explorar a casa', exact: true }).click()
      await expect(panel).toHaveCount(0)
      await expect.poll(() => page.evaluate(async () => {
        const { game } = await import('/src/main.ts')
        const room = game.scene.getScene('InteriorScene')
        return { x: room.player.x, y: room.player.y, active: room.tacticsVisit.active }
      })).toEqual({ x: 480, y: 290, active: false })
      expect(await (await page.request.get('/api/v1/roster')).json()).toEqual(before)
      expect(errors).toEqual([])
    })
  })
}
