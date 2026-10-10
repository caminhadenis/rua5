import { expect, test } from '@playwright/test'
import { continueGame } from './helpers/opening'

for (const phone of [false, true]) {
  test.describe(phone ? 'phone NPC walking' : 'desktop NPC walking', () => {
    test.use({ viewport: phone ? { width: 844, height: 390 } : { width: 960, height: 540 }, hasTouch: phone, isMobile: phone })
    test('NPC legs alternate during patrol and approach, then rest during the dialogue', async ({ page }, testInfo) => {
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      await page.request.post('/api/v1/profiles', { data: { displayName: 'Passos' } })
      await page.request.post('/api/v1/profile/starter', { data: { playerDefinitionId: 'starter_leo' } })
      await page.goto('/')
      await continueGame(page)
      await expect(page.getByRole('complementary', { name: 'Minimapa do Benfica' })).toBeVisible()
      const samples = new Map<string, Set<string>>()
      for (let tick = 0; tick < 35; tick++) {
        const actors = await page.evaluate(async () => {
          const { game } = await import('/src/main.ts')
          const world = game.scene.getScene('WorldScene')
          return world.npcs.filter((npc: { content: { kind: string } }) => npc.content.kind === 'challenger').map((npc: {
            content: { id: string }; sprite: { frame: { name: string; cutWidth: number; cutHeight: number }; body: { width: number; height: number } }
          }) => ({ id: npc.content.id, frame: npc.sprite.frame.name, width: npc.sprite.frame.cutWidth,
            height: npc.sprite.frame.cutHeight, bodyWidth: npc.sprite.body.width, bodyHeight: npc.sprite.body.height }))
        })
        for (const actor of actors) {
          const poses = samples.get(actor.id) ?? new Set<string>()
          poses.add(actor.frame)
          samples.set(actor.id, poses)
          expect([actor.width, actor.height, actor.bodyWidth, actor.bodyHeight]).toEqual([32, 40, 18, 14])
        }
        await page.waitForTimeout(100)
      }
      expect(samples.size).toBe(16)
      for (const poses of samples.values()) expect(poses.size).toBeGreaterThanOrEqual(3)
      // Inspect actual raster pixels: the two contact frames must move both feet in each direction.
      const sheets = await page.evaluate(async () => {
        const { game } = await import('/src/main.ts')
        const world = game.scene.getScene('WorldScene')
        const keys = [...new Set(world.npcs.filter((npc: { content: { kind: string } }) => npc.content.kind === 'challenger').map((npc: { sprite: { texture: { key: string } } }) => npc.sprite.texture.key)), 'walking-resident-cap'] as string[]
        return keys.map(key => {
          const source = world.textures.get(key).getSourceImage() as HTMLCanvasElement
          const context = source.getContext('2d')!
          const feet = [0, 1, 2].map(row => [0, 1, 2, 3].map(frame =>
            Array.from(context.getImageData(frame * 32, row * 40 + 32, 32, 8).data).join(',')))
          return { key, width: source.width, height: source.height, feet }
        })
      })
      for (const sheet of sheets) {
        expect([sheet.width, sheet.height]).toEqual([128, 120])
        for (const feet of sheet.feet) {
          expect(feet[0]).toBe(feet[2])
          expect(feet[1], sheet.key).not.toBe(feet[3])
          expect(new Set(feet).size, sheet.key).toBe(3)
        }
      }
      await page.evaluate(async () => {
        const { game } = await import('/src/main.ts')
        const world = game.scene.getScene('WorldScene')
        world.player.body.reset(world.challenger.x - 82, world.challenger.y)
      })
      const approachFrames = new Set<string>()
      await expect.poll(() => page.evaluate(async () => {
        const { game } = await import('/src/main.ts')
        return game.scene.getScene('WorldScene').encounterLocked
      })).toBe(true)
      for (let tick = 0; tick < 8; tick++) {
        approachFrames.add(await page.evaluate(async () => {
          const { game } = await import('/src/main.ts')
          return game.scene.getScene('WorldScene').challenger.frame.name as string
        }))
        await page.waitForTimeout(65)
      }
      expect(approachFrames.size).toBeGreaterThan(1)
      await expect.poll(() => page.evaluate(async () => {
        const { game } = await import('/src/main.ts')
        return game.scene.getScene('WorldScene').hud.isDialogueOpen
      })).toBe(true)
      expect(await page.evaluate(async () => {
        const { game } = await import('/src/main.ts')
        return game.scene.getScene('WorldScene').challenger.frame.name
      })).toMatch(/-0$/)
      await page.screenshot({ path: testInfo.outputPath('npc-facing-trainer.png') })
      expect(errors).toEqual([])
    })
  })
}
