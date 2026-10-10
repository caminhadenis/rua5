import { startOpening, continueGame, finishStarterGuidance } from './helpers/opening'
import { persistentRoster } from './helpers/roster'
import { expect, test, type Page } from '@playwright/test'
import { talkToStadiumCoach } from './stadiumHelpers'
import type { DuelResponse, RosterPlayer, StadiumResponse } from '../src/api/gameApi'

async function state(page: Page) {
  return page.evaluate(async () => {
    const entry = '/src/main.ts'
    const { game } = await import(entry)
    const scene = game.scene.getScene('WorldScene')
    return { x: scene.player.x as number, y: scene.player.y as number, dialogue: scene.hud.isDialogueOpen as boolean,
      interactable: scene.npcs.some((npc: { content: { kind: string }; sprite: { active: boolean; body: { center: { x: number; y: number } } } }) =>
        npc.content.kind === 'challenger' && npc.sprite.active && Math.hypot(scene.player.body.center.x - npc.sprite.body.center.x,
          scene.player.body.center.y - npc.sprite.body.center.y) <= 60) }
  })
}

// Only read scene coordinates. Movement and recruitment use real user controls.
async function walk(page: Page, axis: 'x' | 'y', target: number, dialogue = false, allowEarlyDialogue = false) {
  const before = await state(page)
  const positive = target > before[axis]
  const key = axis === 'x' ? (positive ? 'ArrowRight' : 'ArrowLeft') : (positive ? 'ArrowDown' : 'ArrowUp')
  await page.keyboard.down(key)
  try {
    await expect.poll(async () => {
      const current = await state(page)
      // A challenger greeted during the previous return can be solid and already greeted.
      if (dialogue && !current.dialogue && current.interactable) await page.keyboard.press('e', { delay: 80 })
      return (allowEarlyDialogue && current.dialogue) || (dialogue ? current.dialogue : positive ? current[axis] >= target - 4 : current[axis] <= target + 4)
    }, { timeout: 18_000, intervals: [20] }).toBe(true)
  } catch (error) {
    throw new Error(`Walking ${axis} to ${target}, current ${JSON.stringify(await state(page))}`, { cause: error })
  } finally { await page.keyboard.up(key) }
}

test('authoritative MVP: new profile → explore → recruit four → roster → stadium → trophy → reload', async ({ page }, testInfo) => {
  test.setTimeout(240_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await startOpening(page, 'Jornada M7')
  await page.getByRole('button', { name: 'Confirmar cores', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Escolher / })).toHaveCount(3)
  await page.getByRole('button', { name: 'Escolher Aderlou' }).click()
  await finishStarterGuidance(page)
  await expect(page.getByRole('button', { name: 'Equipe · T' })).toBeVisible()
  const roster = () => page.request.get('/api/v1/roster').then(r => r.json()) as Promise<RosterPlayer[]>
  const [starter] = await roster()
  expect(await roster()).toHaveLength(1)
  const duelReceipts: DuelResponse[] = []
  const duelKeys: string[] = []
  await page.route('**/challenges/*/matches', async route => {
    // Lose a committed response; retries must recover it without a second XP award.
    const response = await route.fetch()
    duelReceipts.push(await response.json() as DuelResponse)
    duelKeys.push(route.request().headers()['idempotency-key']!)
    if (duelReceipts.length === 1) await route.abort('failed')
    else await route.fulfill({ response })
  })
  for (const [index, name] of ['Nilo', 'Cora', 'Davi', 'Bia'].entries()) {
    if (index === 0) await walk(page, 'x', 816, true)
    if (index === 1) {
      await walk(page, 'y', 300)
      await walk(page, 'x', 1008)
      await walk(page, 'y', 400, true)
    }
    if (index === 2) {
      await walk(page, 'x', 1120)
      await walk(page, 'y', 576, true)
    }
    if (index === 3) {
      // The hedge west of Bia blocks the direct approach; follow the southern path.
      await walk(page, 'y', 752, false, true)
      if (!(await state(page)).dialogue) await walk(page, 'x', 1232, false, true)
      if (!(await state(page)).dialogue) await walk(page, 'y', 688, true)
    }
    await page.keyboard.press('Enter', { delay: 80 })
    let won = false
    for (let attempt = 0; attempt < 25; attempt++) {
      await expect(page.getByRole('region', { name: `Desafiar ${name}`, exact: true })).toBeVisible()
      await page.locator('.player-card').filter({ hasText: 'Aderlou' }).click()
      await page.getByRole('button', { name: 'Iniciar desafio' }).click()
      if (index === 0 && attempt === 0) {
        await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
        await expect(page.getByTestId('current-event')).toHaveAttribute('data-sequence', /[1-9]/)
        const first = Number(await page.getByTestId('current-event').getAttribute('data-sequence'))
        await expect.poll(async () => Number(await page.getByTestId('current-event').getAttribute('data-sequence'))).toBeGreaterThan(first)
        expect(duelReceipts[0]).toEqual(duelReceipts[1])
        expect(duelKeys[0]).toBe(duelKeys[1])
      }
      await page.getByRole('button', { name: 'Pular', exact: true }).click()
      const result = duelReceipts.at(-1)!
      const current = (await roster()).find(p => p.id === starter!.id)!
      expect(current.xp).toBe(result.rewards!.currentXp)
      expect(current.level).toBe(result.rewards!.currentLevel)
      won = result.match.outcome === 'WIN'
      if (won) break
      await page.getByRole('button', { name: 'Voltar ao bairro' }).click()
      await expect(page.getByRole('button', { name: 'Equipe · T' })).toBeVisible()
      await expect.poll(async () => (await state(page)).dialogue).toBe(true)
      await page.keyboard.press('Enter', { delay: 80 })
    }
    expect(won, `Recruit ${name} using real simulation`).toBe(true)
    await page.getByRole('button', { name: 'Convidar para o time' }).click()
    await expect(page.getByRole('region', { name: `Recrutamento · ${name}` })).toContainText(`${name} entrou para o seu time!`)
    const members = await roster()
    expect(members).toHaveLength(index + 2)
    expect(new Set(members.map(p => p.playerDefinitionId)).size).toBe(members.length)
    await page.getByRole('button', { name: 'Voltar ao bairro' }).click()
    await expect(page.getByRole('button', { name: 'Equipe · T' })).toBeVisible()
    await page.keyboard.press('Escape', { delay: 80 })
  }
  const recruited = await roster()
  await page.reload()
  await continueGame(page)
  await page.getByRole('button', { name: 'Equipe · T' }).click()
  expect(persistentRoster(await roster())).toEqual(persistentRoster(recruited))
  await expect(page.getByRole('radio')).toHaveCount(5)
  await expect(page.locator('.lineup-slot')).toHaveCount(0)
  await page.getByRole('button', { name: 'Voltar ao bairro', exact: true }).click()
  // Bia patrols north/south: return below the hedge before heading west.
  await walk(page, 'y', 752)
  await walk(page, 'x', 1120)
  await walk(page, 'y', 336)
  await walk(page, 'x', 2128)
  await walk(page, 'y', 1320)
  await walk(page, 'x', 1936)
  await page.keyboard.press('e', { delay: 80 })
  await talkToStadiumCoach(page)
  await expect(page.getByText('Professor Dimas · treinador', { exact: true })).toBeVisible()
  const stadiumReceipts: StadiumResponse[] = []
  const stadiumKeys: string[] = []
  await page.route('**/stadiums/*/matches', async route => {
    const response = await route.fetch()
    stadiumReceipts.push(await response.json() as StadiumResponse)
    stadiumKeys.push(route.request().headers()['idempotency-key']!)
    if (stadiumReceipts.length === 1) await route.abort('failed')
    else await route.fulfill({ response })
  })
  let won = false
  for (let duel = 0; duel < 500; duel++) {
    await page.locator('.player-card').filter({ hasText: 'Aderlou' }).click()
    await page.getByRole('button', { name: 'Iniciar duelo 1 × 1' }).click()
    if (duel === 0) await page.getByRole('button', { name: 'Recuperar partida' }).click()
    await expect(page.locator('.duelist')).toHaveCount(2)
    await expect(page.locator('.stadium-fan')).toHaveCount(16)
    if (duel === 0) await page.screenshot({ path: testInfo.outputPath('m7-stadium-pitch.png') })
    await page.getByRole('button', { name: 'Pular', exact: true }).click()
    const result = stadiumReceipts.at(-1)!
    won = Boolean(result.rewards.trophy)
    if (won) {
      expect(result.rewards.series.wins).toBe(5)
      break
    }
    await page.getByRole('button', { name: result.rewards.series.finished ? 'Recomeçar sequência' : 'Próximo adversário' }).click()
  }
  expect(won).toBe(true)
  expect(stadiumReceipts[0]).toEqual(stadiumReceipts[1])
  expect(stadiumKeys[0]).toBe(stadiumKeys[1])
  await expect(page.getByRole('status').filter({ hasText: 'Troféu conquistado' })).toContainText('Troféu conquistado: Taça do Benfica')
  await page.screenshot({ path: testInfo.outputPath('m7-trophy.png') })
  await page.getByRole('button', { name: 'Ver conquistas' }).click()
  await expect(page.getByRole('region', { name: 'Conquistas' })).toContainText('Taça do Benfica')
  await page.getByRole('button', { name: 'Voltar ao bairro', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Equipe · T' })).toBeVisible()
  const completedRoster = await roster()
  await page.reload()
  await continueGame(page)
  await expect(page.getByRole('button', { name: 'Equipe · T' })).toBeVisible()
  expect(persistentRoster(await roster())).toEqual(persistentRoster(completedRoster))
  await page.getByRole('button', { name: 'Equipe · T' }).click()
  await expect(page.getByRole('region', { name: 'Conquistas' })).toContainText('Taça do Benfica')
  await page.getByRole('button', { name: 'Voltar ao bairro', exact: true }).click()
  // Continue restores the stadium doorstep; reenter directly from the saved position.
  await expect(page.getByRole('button', { name: 'Equipe · T' })).toBeVisible()
  await page.keyboard.press('e', { delay: 80 })
  await talkToStadiumCoach(page)
  await expect(page.getByRole('status')).toContainText('Conquistado')
  await expect(page.getByRole('button', { name: 'Iniciar duelo 1 × 1' })).toHaveCount(0)
  const blocked = await page.request.post('/api/v1/stadiums/benfica_stadium/matches', { headers: { 'Idempotency-Key': crypto.randomUUID() }, data: { ownedPlayerId: starter!.id, roundNumber: 1 } })
  expect(blocked.status()).toBe(409)
  expect((await blocked.json()).code).toBe('STADIUM_ALREADY_COMPLETED')
  expect(errors).toEqual([])
})

test('connection errors offer retry and sound preference survives reload', async ({ page }) => {
  await page.route('**/api/v1/profile', route => route.abort('failed'))
  await page.goto('/')
  await expect(page.getByText('Não foi possível consultar sua jornada salva.')).toBeVisible()
  await page.unroute('**/api/v1/profile')
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(page.getByRole('button', { name: 'INICIAR', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Som: ligado' }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Som: desligado' })).toHaveAttribute('aria-pressed', 'false')
})
