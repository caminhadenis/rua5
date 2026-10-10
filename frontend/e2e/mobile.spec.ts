import { recruitStadiumRoster } from './helpers/stadiumRoster'
import { startOpening, continueGame, finishStarterGuidance } from './helpers/opening'
import { expect, test, type CDPSession, type Locator, type Page } from '@playwright/test'
import { expectPanelFits } from './helpers/mobilePanel'

async function createPlayer(page: Page) {
  expect((await page.request.post('/api/v1/profiles', { data: { displayName: 'Celular' } })).status()).toBe(201)
  expect((await page.request.post('/api/v1/profile/starter', { data: { playerDefinitionId: 'starter_leo' } })).ok()).toBe(true)
}

async function state(page: Page, sceneName = 'WorldScene') {
  return page.evaluate(async name => {
    const { game } = await import('/src/main.ts')
    const scene = game.scene.getScene(name)
    if (!game.scene.isActive(name) || !scene.player?.body) return null
    return {
      x: scene.player.x as number, y: scene.player.y as number,
      vx: scene.player.body.velocity.x as number, vy: scene.player.body.velocity.y as number,
      dialogue: name === 'WorldScene' ? scene.hud.isDialogueOpen as boolean : Boolean(scene.dialogue?.visible),
    }
  }, sceneName)
}

async function point(locator: Locator, id: number) {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2, id }
}

async function touch(cdp: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel', points: { x: number; y: number; id: number }[]) {
  // This Chromium version accepts the ended finger's ID for a partial release.
  // An empty touchEnd releases all fingers.
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points })
}

test('desktop keeps keyboard controls and never shows mobile UI even in a narrow window', async ({ page }) => {
  await createPlayer(page)
  await page.goto('/')
  await continueGame(page)
  await expect.poll(() => state(page)).not.toBeNull()
  const before = (await state(page))!
  await expect(page.getByRole('navigation', { name: 'Controles de toque' })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Equipe · T' })).toBeVisible()
  await page.getByRole('button', { name: 'Equipe · T' }).click()
  await expect(page.locator('.player-card-face strong')).toHaveCSS('font-size', '16px')
  await expect(page.locator('.player-card-portrait')).toHaveCSS('width', '64px')
  await page.getByRole('button', { name: 'Voltar ao bairro', exact: true }).click()
  await expect.poll(() => state(page)).not.toBeNull()
  await page.keyboard.down('ArrowRight')
  await expect.poll(async () => (await state(page))!.x).toBeGreaterThan(before.x + 20)
  await page.keyboard.up('ArrowRight')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('html')).not.toHaveClass(/is-phone/)
  await expect(page.getByRole('region', { name: 'Orientação do celular' })).toBeHidden()
  await expect(page.getByRole('navigation', { name: 'Controles de toque' })).toBeHidden()
})

test.describe('phone', () => {
  test.use({ viewport: { width: 844, height: 390 }, screen: { width: 844, height: 390 }, hasTouch: true, isMobile: true })

  test('held touch, sliding, two fingers, cancellation and team transitions never leave movement stuck', async ({ page, context }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await createPlayer(page)
    await page.goto('/')
    await continueGame(page)
    const controls = page.getByRole('navigation', { name: 'Controles de toque' })
    await expect(controls).toBeVisible()
    const cdp = await context.newCDPSession(page)
    const right = await point(controls.getByRole('button', { name: 'Mover para a direita' }), 1)
    const down = await point(controls.getByRole('button', { name: 'Mover para baixo' }), 2)
    const before = (await state(page))!
    await touch(cdp, 'touchStart', [right])
    await expect.poll(async () => (await state(page))!.x, { intervals: [20] }).toBeGreaterThan(before.x + 24)
    await touch(cdp, 'touchMove', [{ ...down, id: 1 }])
    await expect.poll(async () => (await state(page))!.vy).toBe(160)
    await touch(cdp, 'touchEnd', [])
    await expect.poll(async () => (await state(page))!.vy).toBe(0)

    await touch(cdp, 'touchStart', [right])
    await touch(cdp, 'touchStart', [right, down])
    await expect.poll(async () => {
      const current = (await state(page))!
      return current.vx > 0 && current.vy > 0 && Math.abs(Math.hypot(current.vx, current.vy) - 160) < 0.01
    }, { intervals: [20] }).toBe(true)
    expect((await state(page))!.vx).toBeGreaterThan(0)
    expect((await state(page))!.vy).toBeGreaterThan(0)
    await touch(cdp, 'touchEnd', [right])
    await expect.poll(async () => (await state(page))!.vx).toBe(0)
    expect((await state(page))!.vy).toBe(160)
    await touch(cdp, 'touchCancel', [])
    await expect.poll(async () => (await state(page))!.vy).toBe(0)

    await touch(cdp, 'touchStart', [right])
    const team = await point(controls.getByRole('button', { name: 'Equipe', exact: true }), 3)
    await touch(cdp, 'touchStart', [right, team])
    await touch(cdp, 'touchEnd', [team])
    await expect(page.getByRole('button', { name: 'Voltar ao bairro', exact: true })).toBeVisible()
    await expect(controls).toBeHidden()
    await touch(cdp, 'touchEnd', [])
    await page.getByRole('button', { name: 'Voltar ao bairro', exact: true }).tap()
    await expect(controls).toBeVisible()
    expect((await state(page))!).toMatchObject({ vx: 0, vy: 0 })
    const resting = (await state(page))!
    await page.waitForTimeout(180)
    expect((await state(page))!.x).toBe(resting.x)
    // The control rails are outside the canvas, with finger sized targets.
    const canvas = (await page.locator('canvas').boundingBox())!
    const pad = (await controls.locator('.touch-dpad').boundingBox())!
    expect(pad.x + pad.width).toBeLessThanOrEqual(canvas.x)
    const actions = (await controls.locator('.touch-actions').boundingBox())!
    expect(canvas.x + canvas.width).toBeLessThanOrEqual(actions.x)
    for (const button of await controls.getByRole('button').all()) {
      const box = await button.boundingBox()
      if (box) { expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44) }
    }
    await page.screenshot({ path: testInfo.outputPath('phone-landscape.png') })
    expect(errors).toEqual([])
  })

  test('portrait asks for rotation and releases held movement before resuming landscape', async ({ page, context }, testInfo) => {
    await createPlayer(page)
    await page.goto('/')
    await continueGame(page)
    const controls = page.getByRole('navigation', { name: 'Controles de toque' })
    await expect(controls).toBeVisible()
    const cdp = await context.newCDPSession(page)
    await touch(cdp, 'touchStart', [await point(controls.getByRole('button', { name: 'Mover para a direita' }), 1)])
    await expect.poll(async () => (await state(page))!.vx).toBe(160)
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('heading', { name: 'Vire o celular para jogar' })).toBeVisible()
    await expect(controls).toBeHidden()
    await expect.poll(async () => (await state(page))!.vx).toBe(0)
    const resting = (await state(page))!
    await page.waitForTimeout(150)
    expect((await state(page))!.x).toBe(resting.x)
    await page.screenshot({ path: testInfo.outputPath('phone-portrait.png') })
    await touch(cdp, 'touchEnd', [])
    await page.setViewportSize({ width: 844, height: 390 })
    await expect(controls).toBeVisible()
    expect((await state(page))!.vx).toBe(0)
  })

  test('a new phone player chooses a starter, walks to Nilo and plays a real duel entirely by touch', async ({ page, context }, testInfo) => {
    test.setTimeout(45_000)
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('/')
    await startOpening(page)
    await page.getByRole('button', { name: 'Confirmar cores' }).tap()
    await page.getByRole('button', { name: 'Escolher Cabeleira' }).tap()
    await finishStarterGuidance(page)
    const controls = page.getByRole('navigation', { name: 'Controles de toque' })
    await expect(controls).toBeVisible()
    const cdp = await context.newCDPSession(page)
    await touch(cdp, 'touchStart', [await point(controls.getByRole('button', { name: 'Mover para a direita' }), 1)])
    await expect.poll(async () => (await state(page))!.dialogue, { timeout: 8000, intervals: [20] }).toBe(true)
    await touch(cdp, 'touchEnd', [])
    await expect(page.getByRole('region', { name: 'Conversa' })).toContainText('Nilo')
    await page.screenshot({ path: testInfo.outputPath('phone-dialogue.png') })
    await controls.getByRole('button', { name: 'Desafiar', exact: true }).tap()
    await expect(controls).toBeHidden()
    await expect(page.getByRole('button', { name: 'Iniciar desafio', exact: true })).toBeVisible()
    await expectPanelFits(page, '.duel-selection-panel')
    await page.getByRole('button', { name: 'Iniciar desafio', exact: true }).tap()
    await expect(page.getByRole('button', { name: 'Pular', exact: true })).toBeVisible()
    await expectPanelFits(page, '.duel-panel')
    await page.getByRole('button', { name: 'Pular', exact: true }).tap()
    await expect(page.getByTestId('match-result')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Recrutamento · Nilo' })).toBeVisible()
    await expectPanelFits(page, '.duel-panel')
    await page.screenshot({ path: testInfo.outputPath('phone-duel-result.png') })
    await page.getByRole('button', { name: 'Voltar ao bairro', exact: true }).tap()
    await expect(controls).toBeVisible()
    await controls.getByRole('button', { name: 'Fechar', exact: true }).tap()
    await expect(page.getByRole('region', { name: 'Conversa' })).toBeHidden()
    expect((await state(page))!).toMatchObject({ vx: 0, vy: 0 })
    expect(errors).toEqual([])
  })

  test('touch actions enter interiors, talk to trainers and select a stadium athlete', async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setViewportSize({ width: 568, height: 320 })
    await createPlayer(page)
    await recruitStadiumRoster(page)
    await page.goto('/')
    await continueGame(page)
    const controls = page.locator('.touch-controls:visible')
    await expect(controls).toBeVisible()
    // Arrange positions only; every command and scene transition uses the real touch UI.
    const goToDoor = async (key: string) => {
      await page.evaluate(async key => {
        const { game } = await import('/src/main.ts')
        const world = game.scene.getScene('WorldScene')
        const door = key === 'benfica.stadium.entry' ? world.stadiumPoint : world.doors.find((door: { key: string }) => door.key === key)
        world.player.setPosition(door.x, door.y + 15)
      }, key)
      await controls.getByRole('button', { name: 'Entrar', exact: true }).tap()
      await expect.poll(() => state(page, 'InteriorScene')).not.toBeNull()
    }
    await goToDoor('benfica.gym.entry')
    await controls.getByRole('button', { name: 'Continuar', exact: true }).tap()
    await page.evaluate(async () => {
      const { game } = await import('/src/main.ts')
      const interior = game.scene.getScene('InteriorScene')
      const coach = interior.people.find((person: { focus?: string }) => person.focus === 'SPEED')
      interior.player.setPosition(coach.sprite.x - 34, coach.sprite.y)
    })
    await controls.getByRole('button', { name: 'Conversar', exact: true }).tap()
    await controls.getByRole('button', { name: 'Treinar', exact: true }).tap()
    await expect(page.getByRole('button', { name: 'Começar treino', exact: true })).toBeVisible()
    await expectPanelFits(page, '.training-panel')
    await page.screenshot({ path: testInfo.outputPath('phone-training-selection.png') })
    await page.getByRole('button', { name: 'Voltar ao centro', exact: true }).tap()
    await controls.getByRole('button', { name: 'Sair', exact: true }).last().tap()
    await expect.poll(() => state(page)).not.toBeNull()
    await goToDoor('benfica.stadium.entry')
    await page.evaluate(async () => {
      const { game } = await import('/src/main.ts')
      const interior = game.scene.getScene('InteriorScene')
      const coach = interior.people.find((person: { role?: string }) => person.role === 'stadium-coach')
      interior.player.setPosition(coach.sprite.x - 34, coach.sprite.y)
    })
    await controls.getByRole('button', { name: 'Conversar', exact: true }).tap()
    await expect(page.getByRole('region', { name: 'Conversa' })).toContainText('Dimas')
    await controls.getByRole('button', { name: 'Desafiar', exact: true }).tap()
    await expect(page.getByRole('button', { name: 'Iniciar duelo 1 × 1', exact: true })).toBeVisible()
    await expectPanelFits(page, '.stadium-panel')
    await page.screenshot({ path: testInfo.outputPath('phone-stadium-selection.png') })
    await expect(page.locator('.touch-controls:visible')).toHaveCount(0)
    await page.getByRole('button', { name: 'Iniciar duelo 1 × 1', exact: true }).tap()
    await expect(page.getByRole('button', { name: 'Pular', exact: true })).toBeVisible()
    await expectPanelFits(page, '.stadium-duel-panel')
    const court = (await page.locator('.duel-arena').boundingBox())!
    expect(court.height).toBeGreaterThanOrEqual(64)
    await page.screenshot({ path: testInfo.outputPath('phone-stadium-duel.png') })
    await page.getByRole('button', { name: 'Pular', exact: true }).tap()
    await expect(page.getByTestId('stadium-result')).toBeVisible()
    await expectPanelFits(page, '.coach-result-panel')
    await page.screenshot({ path: testInfo.outputPath('phone-coach-result.png') })
    await page.getByRole('button', { name: 'Voltar ao estádio', exact: true }).tap()
    await expect(controls).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('phone-stadium.png') })
    expect(errors).toEqual([])
  })
})
