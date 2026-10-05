import { expect, test } from '@playwright/test'
import { writeFile } from 'node:fs/promises'

for (const phone of [false, true]) {
  test.describe(phone ? 'phone avatar' : 'desktop avatar', () => {
    test.use({ viewport: phone ? { width: 667, height: 375 } : { width: 960, height: 540 }, hasTouch: phone, isMobile: phone })

    test('walking frames contain the complete head, uniform and feet', async ({ page }, testInfo) => {
      await page.request.post('/api/v1/profiles', { data: { displayName: 'Avatar', primaryColor: '#2266aa', secondaryColor: '#dd3344' } })
      await page.request.post('/api/v1/profile/starter', { data: { playerDefinitionId: 'starter_leo' } })
      await page.goto('/')
      await expect.poll(() => page.evaluate(async () => {
        const { game } = await import('/src/main.ts')
        return game.scene.getScene('WorldScene').player?.texture.key
      })).toBe('team-starter_leo')
      const frames = await page.evaluate(async () => {
        const { game } = await import('/src/main.ts')
        const world = game.scene.getScene('WorldScene')
        const source = world.player.texture.getSourceImage()
        if (!(source instanceof HTMLCanvasElement) || source.width !== 128 || source.height !== 120) {
          throw new Error('Walking textures must be rasterized at 128×120 before frame slicing')
        }
        world.add.rectangle(400, 250, 128, 160, 0x010203).setScrollFactor(0).setDepth(10000)
        const probe = world.add.image(400, 250, world.player.texture.key, 'front-0').setScale(4).setScrollFactor(0).setDepth(10001)
        const results = []
        for (const direction of ['front', 'side', 'back']) {
          for (let pose = 0; pose < 4; pose++) {
            const name = `${direction}-${pose}`
            probe.setFrame(name)
            const snapshot = await new Promise<HTMLImageElement>(resolve => game.renderer.snapshotArea(336, 170, 128, 160, resolve))
            const canvas = document.createElement('canvas')
            canvas.width = 128; canvas.height = 160
            const context = canvas.getContext('2d')!
            context.drawImage(snapshot, 0, 0)
            const count = (pixels: Uint8ClampedArray, color: number[]) => {
              let total = 0
              for (let pixel = 0; pixel < pixels.length; pixel += 4) {
                if (color.every((channel, index) => Math.abs(pixels[pixel + index]! - channel) <= 1)) total++
              }
              return total
            }
            const colors = [[101, 67, 53], [34, 102, 170], [221, 51, 68], [245, 234, 210]]
            const rendered = colors.map(color => count(context.getImageData(0, 0, 128, 160).data, color))
            context.clearRect(0, 0, 128, 160)
            context.imageSmoothingEnabled = false
            const frame = probe.frame
            context.drawImage(probe.texture.getSourceImage(), frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, 128, 160)
            const expected = colors.map(color => count(context.getImageData(0, 0, 128, 160).data, color))
            results.push({ name, rendered, expected, image: snapshot.src })
          }
        }
        probe.destroy()
        return results
      })
      for (const frame of frames) {
        await writeFile(testInfo.outputPath(`${frame.name}.png`), Buffer.from(frame.image.split(',')[1]!, 'base64'))
        await testInfo.attach(frame.name, { body: Buffer.from(frame.image.split(',')[1]!, 'base64'), contentType: 'image/png' })
        expect(frame.expected.every(count => count > 150), frame.name).toBe(true)
        expect(frame.rendered, frame.name).toEqual(frame.expected)
      }
    })
  })
}
