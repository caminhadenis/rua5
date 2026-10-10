import { expect, test } from '@playwright/test'
import { continueGame, startOpening } from './helpers/opening'

for (const phone of [false, true]) {
  test.describe(phone ? 'phone neighborhood guidance' : 'desktop neighborhood guidance', () => {
    test.use({ viewport: phone ? { width: 844, height: 390 } : { width: 960, height: 540 },
      screen: phone ? { width: 844, height: 390 } : { width: 960, height: 540 }, hasTouch: phone, isMobile: phone })
    test('Miguel explains the chosen starter and walks to training, then doors work on contact', async ({ page }, testInfo) => {
      test.setTimeout(60_000)
      const errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))
      await page.goto('/')
      await startOpening(page, 'Novo treinador')
      await page.getByRole('button', { name: 'Confirmar cores' }).click()
      await page.getByRole('button', { name: 'Escolher Aderlou' }).click()
      const panel = page.getByRole('region', { name: 'Boas-vindas ao bairro' })
      await expect(panel).toContainText('Parabéns pela escolha, Aderlou')
      await expect(panel).toContainText('marcação')
      await page.getByRole('button', { name: 'Próxima orientação' }).click()
      await expect(panel).toContainText('menu Equipe, na seção Elenco')
      await page.getByRole('button', { name: 'Próxima orientação' }).click()
      await expect(panel).toContainText('subir o nível')
      await expect(panel).toContainText('sem ganhar XP')
      await page.getByRole('button', { name: 'Conhecer o centro de treinamento' }).click()
      await expect(panel).toBeHidden()
      const minimap = page.getByRole('complementary', { name: 'Minimapa do Benfica' })
      await expect(minimap).toBeVisible()
      const routePositions: { x: number; y: number; frame: string; mentorFrame: string }[] = []
      await expect.poll(async () => {
        const position = await page.evaluate(async () => {
          const { game } = await import('/src/main.ts')
          const world = game.scene.getScene('WorldScene')
          return { x: world.player.x, y: world.player.y, frame: world.player.frame.name, mentorFrame: world.children.getByName('miguel').frame.name, finished: !world.guide, dialogue: world.hud.isDialogueOpen }
        })
        expect(position.dialogue).toBe(false)
        routePositions.push(position)
        return position.finished
      }, { timeout: 20_000, intervals: [100] }).toBe(true)
      expect(routePositions.length).toBeGreaterThan(10)
      expect(new Set(routePositions.map(p => p.frame)).size).toBeGreaterThan(2)
      expect(new Set(routePositions.map(p => p.mentorFrame)).size).toBeGreaterThan(2)
      expect(routePositions.at(-1)!.x).toBe(1488)
      await expect(panel).toContainText('Chegamos ao Centro de Treinamento!')
      const roster = await (await page.request.get('/api/v1/roster')).json()
      expect(roster).toHaveLength(1)
      expect(roster[0].xp).toBe(0)
      expect(roster[0].level).toBe(1)
      await page.screenshot({ path: testInfo.outputPath('miguel-training-arrival.png') })
      await page.getByRole('button', { name: 'Entrar no centro de treinamento' }).click()
      await expect(minimap).toBeHidden()
      const active = (name: string) => page.evaluate(async name => {
        const { game } = await import('/src/main.ts')
        return game.scene.isActive(name)
      }, name)
      await expect.poll(() => active('InteriorScene')).toBe(true)
      // Close Jo's introductory conversation before crossing the exit.
      if (phone) await page.getByRole('button', { name: 'Fechar', exact: true }).tap()
      else await page.keyboard.press('Escape', { delay: 80 })
      await expect.poll(() => page.evaluate(async () => {
        const { game } = await import('/src/main.ts')
        return Boolean(game.scene.getScene('InteriorScene').dialogue?.visible)
      })).toBe(false)
      if (phone) {
        const down = page.getByRole('button', { name: 'Mover para baixo' })
        const box = (await down.boundingBox())!
        const cdp = await page.context().newCDPSession(page)
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }] })
        try { await expect.poll(() => active('WorldScene')).toBe(true) }
        finally { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach() }
      } else {
        await page.keyboard.down('ArrowDown')
        try { await expect.poll(() => active('WorldScene')).toBe(true) }
        finally { await page.keyboard.up('ArrowDown') }
      }
      await expect(minimap).toBeVisible()
      for (const text of ['E · Estádio', 'T · Centro de treinamento', 'R · Centro de recuperação', '● Você']) await expect(minimap).toContainText(text)
      const before = await minimap.locator('circle').getAttribute('cx')
      await page.keyboard.down('ArrowLeft')
      await expect.poll(() => minimap.locator('circle').getAttribute('cx')).not.toBe(before)
      await page.keyboard.up('ArrowLeft')
      // The phone minimap must fit below the d-pad and avoid every touch target.
      if (phone) {
        const box = (await minimap.boundingBox())!
        for (const control of await page.locator('.touch-controls:visible button:visible').all()) {
          const target = (await control.boundingBox())!
          expect(box.x + box.width <= target.x || target.x + target.width <= box.x ||
            box.y + box.height <= target.y || target.y + target.height <= box.y).toBe(true)
        }
      }
      await page.screenshot({ path: testInfo.outputPath('neighborhood-minimap.png') })
      await page.waitForTimeout(300)
      expect(await active('WorldScene')).toBe(true)
      expect(errors).toEqual([])
    })
  })
}

test('all building entrances and exits cross automatically without bouncing back', async ({ page }) => {
  await page.request.post('/api/v1/profiles', { data: { displayName: 'Portas' } })
  await page.request.post('/api/v1/profile/starter', { data: { playerDefinitionId: 'starter_leo' } })
  await page.goto('/')
  await continueGame(page)
  await expect(page.getByRole('button', { name: 'Equipe · T' })).toBeVisible()
  const keys = await page.evaluate(async () => {
    const { game } = await import('/src/main.ts')
    return game.scene.getScene('WorldScene').doors.map((d: { key: string }) => d.key) as string[]
  })
  for (const key of keys) {
    // A street challenger may greet the trainer after the previous building exit.
    await expect.poll(() => page.evaluate(async () => {
      const { game } = await import('/src/main.ts')
      return game.scene.getScene('WorldScene').encounterLocked
    })).toBe(false)
    await page.evaluate(async key => {
      const { game } = await import('/src/main.ts')
      const world = game.scene.getScene('WorldScene')
      const door = world.doors.find((d: { key: string }) => d.key === key)
      world.player.body.reset(door.x, door.y - 13)
      world.hud.closeDialogue()
    }, key)
    await expect.poll(() => page.evaluate(async () => {
      const { game } = await import('/src/main.ts')
      return game.scene.isActive('InteriorScene')
    }), { message: `Automatically enter ${key}` }).toBe(true)
    await page.evaluate(async () => {
      const { game } = await import('/src/main.ts')
      const interior = game.scene.getScene('InteriorScene')
      interior.dialogue?.setVisible(false)
      interior.mobileDialogue.close()
    })
    // Real walking from the interior spawn into the exit: no interaction key.
    await page.keyboard.down('ArrowDown')
    try {
      await expect.poll(() => page.evaluate(async () => {
        const { game } = await import('/src/main.ts')
        return game.scene.isActive('WorldScene')
      })).toBe(true)
    } finally { await page.keyboard.up('ArrowDown') }
    await page.waitForTimeout(200)
    expect(await page.evaluate(async () => {
      const { game } = await import('/src/main.ts')
      return game.scene.isActive('WorldScene')
    })).toBe(true)
  }
  const challenger = await (await page.request.get('/api/v1/challenges/00000000-0000-4000-8000-000000000009')).json()
  expect(challenger.name).toBe('Estela')
})
