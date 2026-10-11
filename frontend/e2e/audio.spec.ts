import { expect, test, type Page } from '@playwright/test'
import { finishedDuel } from './helpers/coachedMatch'
import { continueGame } from './helpers/opening'

async function monitorCues(page: Page) {
  await page.evaluate(async () => {
    const { gameAudio } = await import('/src/game/audio/GameAudio.ts')
    const play = gameAudio.play.bind(gameAudio)
    const cues: string[] = []
    Object.assign(window, { audioCues: cues })
    gameAudio.play = cue => { cues.push(cue); play(cue) }
  })
}
const cues = (page: Page) => page.evaluate(() => (window as unknown as { audioCues: string[] }).audioCues)

/** Sample the actual Web Audio output, including the master mute gain. */
async function amplitude(page: Page) {
  return page.evaluate(async () => {
    const { gameAudio } = await import('/src/game/audio/GameAudio.ts')
    const audio = gameAudio as unknown as { context: AudioContext; master: GainNode }
    const analyser = audio.context.createAnalyser()
    analyser.fftSize = 2048
    audio.master.connect(analyser)
    await new Promise(resolve => setTimeout(resolve, 150))
    const samples = new Float32Array(analyser.fftSize)
    analyser.getFloatTimeDomainData(samples)
    audio.master.disconnect(analyser)
    analyser.disconnect()
    return Math.max(...samples.map(Math.abs))
  })
}

for (const phone of [false, true]) {
  test.describe(phone ? 'phone sound' : 'desktop sound', () => {
    test.use({ viewport: phone ? { width: 844, height: 390 } : { width: 960, height: 540 },
      screen: phone ? { width: 844, height: 390 } : { width: 960, height: 540 }, hasTouch: phone, isMobile: phone })
    test('menu, ceremony and city themes, diploma, mute and reload', async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      await page.goto('/')
      const sound = page.locator('.audio-toggle')
      await expect(sound).toHaveText('Som: ativar')
      await expect(sound).toHaveAttribute('data-music', 'menu')
      if (phone) await sound.tap()
      else await sound.click()
      await expect(sound).toHaveAttribute('data-playing', 'menu')
      expect(await amplitude(page)).toBeGreaterThan(0.001)
      await monitorCues(page)
      await page.getByRole('button', { name: 'INICIAR', exact: true }).click()
      await expect(sound).toHaveAttribute('data-playing', 'graduation')
      expect(await amplitude(page)).toBeGreaterThan(0.001)
      await page.getByRole('button', { name: 'Próxima fala', exact: true }).click()
      await page.getByRole('textbox', { name: 'Seu nome' }).fill('Treinador do som')
      await page.getByRole('button', { name: 'Confirmar nome' }).click()
      expect(await cues(page)).toContain('diploma')
      for (let speech = 0; speech < 6; speech++) await page.getByRole('button', { name: 'Próxima fala', exact: true }).click()
      await page.getByRole('button', { name: 'Encerrar cerimônia' }).click()
      await page.keyboard.down('ArrowDown')
      try { await expect(sound).toHaveAttribute('data-playing', 'city', { timeout: 8000 }) }
      finally { await page.keyboard.up('ArrowDown') }
      await sound.click()
      await expect(sound).toHaveText('Som: desligado')
      await expect(sound).toHaveAttribute('data-playing', '')
      expect(await amplitude(page)).toBe(0)
      await page.reload()
      await expect(sound).toHaveText('Som: desligado')
      await expect(sound).toHaveAttribute('data-music', 'menu')
      await sound.click()
      await expect(sound).toHaveAttribute('data-playing', 'menu')
      expect(errors).toEqual([])
    })
  })
}

test('attention once per approach, accepted duel, whistle, actual outcome and return to city', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.request.post('/api/v1/profiles', { data: { displayName: 'Áudio duelo' } })
  await page.request.post('/api/v1/profile/starter', { data: { playerDefinitionId: 'starter_leo' } })
  await page.goto('/')
  await continueGame(page)
  const sound = page.locator('.audio-toggle')
  await expect(sound).toHaveAttribute('data-playing', 'city')
  await monitorCues(page)
  await expect.poll(() => page.evaluate(async () => {
    const { game } = await import('/src/main.ts')
    return game.scene.getScene('WorldScene').challenger.active as boolean
  })).toBe(true)
  await page.keyboard.down('ArrowRight')
  try {
    await expect.poll(() => page.evaluate(async () => {
      const { game } = await import('/src/main.ts')
      return game.scene.getScene('WorldScene').hud.isDialogueOpen as boolean
    }), { timeout: 7000 }).toBe(true)
  } finally { await page.keyboard.up('ArrowRight') }
  expect((await cues(page)).filter(cue => cue === 'attention')).toHaveLength(1)
  await page.waitForTimeout(300)
  expect((await cues(page)).filter(cue => cue === 'attention')).toHaveLength(1)
  await page.keyboard.press('Enter', { delay: 80 })
  const response = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/coached-matches'))
  await page.getByRole('button', { name: 'Iniciar desafio', exact: true }).click()
  await expect(sound).toHaveAttribute('data-playing', 'duel')
  const initial = await (await response).json()
  await expect(page.getByRole('region', { name: 'Partida', exact: true })).toBeVisible()
  expect(await cues(page)).toContain('whistle')
  expect(await amplitude(page)).toBeGreaterThan(0.001)
  await page.getByRole('button', { name: 'Pular', exact: true }).click()
  await expect(page.getByTestId('match-result')).toBeVisible()
  const result = await finishedDuel(page, initial.match.id)
  expect((await cues(page)).at(-1)).toBe({ WIN: 'win', LOSS: 'loss', DRAW: 'draw' }[result.match.outcome as 'WIN' | 'LOSS' | 'DRAW'])
  await expect(sound).toHaveAttribute('data-playing', '')
  // Presentation fixtures exercise every authoritative outcome without changing saved progress.
  for (const outcome of ['WIN', 'LOSS', 'DRAW'] as const) {
    await page.evaluate(async ({ match, outcome }) => {
      const { game } = await import('/src/main.ts')
      game.scene.stop('MatchScene')
      game.scene.run('MatchScene', { match: { ...match, outcome, sourceId: null }, rewards: null })
    }, { match: result.match, outcome })
    await page.getByRole('button', { name: 'Pular', exact: true }).click()
    await expect(page.getByTestId('match-result')).toBeVisible()
    expect((await cues(page)).at(-1)).toBe({ WIN: 'win', LOSS: 'loss', DRAW: 'draw' }[outcome])
    await expect(sound).toHaveAttribute('data-playing', '')
  }
  await page.getByRole('button', { name: 'Voltar ao bairro', exact: true }).click()
  await expect(sound).toHaveAttribute('data-playing', 'city')
  expect(await amplitude(page)).toBeGreaterThan(0.001)
  expect(errors).toEqual([])
})
