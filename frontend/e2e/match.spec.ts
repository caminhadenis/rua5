import { persistentRoster } from './helpers/roster'
import { startOpening, continueGame, finishStarterGuidance } from './helpers/opening'
import { expect, test, type Page } from '@playwright/test'
import type { DuelResponse, MatchEvent, RosterPlayer } from '../src/api/gameApi'

async function dialogueState(page: Page) {
  return page.evaluate(async () => {
    const entry = '/src/main.ts'
    const { game } = await import(entry)
    const { hud } = game.scene.getScene('WorldScene')
    return { open: hud.isDialogueOpen, text: hud.dialogueText.text as string, action: hud.challengeButton.text as string }
  })
}

async function walkToNpc(page: Page) {
  await expect.poll(() => page.evaluate(async () => {
    const entry = '/src/main.ts'
    const { game } = await import(entry)
    const world = game.scene.getScene('WorldScene')
    return game.scene.isActive('WorldScene') && !world.choosing
  })).toBe(true)
  await expect(page.locator('.scene-panel')).toHaveCount(0)
  await page.keyboard.down('ArrowRight')
  await expect.poll(() => page.evaluate(async () => {
    const entry = '/src/main.ts'
    const { game } = await import(entry)
    return game.scene.getScene('WorldScene').hud.isDialogueOpen as boolean
  }), { timeout: 7000, intervals: [20] }).toBe(true)
  await page.keyboard.up('ArrowRight')
  await expect.poll(() => page.evaluate(async () => {
    const entry = '/src/main.ts'
    const { game } = await import(entry)
    return game.scene.getScene('WorldScene').hud.isDialogueOpen as boolean
  })).toBe(true)
  await page.keyboard.press('Enter', { delay: 80 })
  await expect(page.getByRole('button', { name: 'Iniciar desafio' })).toBeVisible()
}

test('starter → NPC → real API → timeline → speed/skip → persisted reward and roster', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await startOpening(page)
  await page.getByRole('button', { name: 'Confirmar cores', exact: true }).click()
  await page.getByRole('button', { name: 'Escolher Loraco' }).click()
  await finishStarterGuidance(page)
  await walkToNpc(page)
  await expect(page.getByRole('radio', { name: 'Loraco, nível 1' })).toBeChecked()
  await expect(page.locator('.player-card-sprite')).toHaveCSS('background-image', /d8a83e/)
  await expect(page.locator('select')).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('player-selection.png') })
  let commands = 0
  page.on('request', request => { if (request.method() === 'POST' && request.url().includes('/matches')) commands++ })
  const resultPromise = page.waitForResponse(response => response.request().method() === 'POST' && response.url().includes('/matches'))
  await page.getByRole('button', { name: 'Iniciar desafio' }).click()
  const response = await resultPromise
  expect(response.ok()).toBe(true)
  const result = await response.json() as DuelResponse
  await expect(page.locator('.scene-transition')).toHaveCount(1)
  await expect(page.getByRole('region', { name: 'Partida', exact: true })).toBeVisible()
  await expect(page.locator('.duelist.home .duel-sprite')).toHaveCSS('background-image', /d8a83e/)
  await expect(page.getByTestId('current-event')).toHaveAttribute('data-sequence', /[1-9]/)
  const visible = await page.evaluate(() => ({
    sequence: Number(document.querySelector<HTMLElement>('[data-testid="current-event"]')!.dataset.sequence),
    home: document.querySelector('[data-testid="home-score"]')!.textContent,
    away: document.querySelector('[data-testid="away-score"]')!.textContent,
    whiteSpace: getComputedStyle(document.querySelector('[data-testid="current-event"]')!).whiteSpace,
  }))
  const currentEvent = result.match.events[visible.sequence - 1]!
  expect(visible.home).toBe(String(currentEvent.homeScore))
  expect(visible.away).toBe(String(currentEvent.awayScore))
  expect(visible.whiteSpace).toBe('nowrap')
  await expect(page.getByTestId('current-event')).toHaveCount(1)
  await page.screenshot({ path: testInfo.outputPath('duel-playback.png') })
  await expect(page.getByTestId('reward')).toHaveCount(0)
  await page.getByRole('button', { name: 'Acelerar · 1×' }).click()
  await expect(page.getByRole('button', { name: 'Acelerar · 4×' })).toBeVisible()
  await page.getByRole('button', { name: 'Pular', exact: true }).click()
  await expect(page.getByTestId('match-result')).toContainText(`${result.match.homeScore} × ${result.match.awayScore}`)
  await expect(page.getByTestId('reward')).toContainText(`+${result.rewards!.xpAwarded} XP`)
  await expect(page.getByTestId('home-score')).toHaveText(String(result.match.homeScore))
  await expect(page.getByTestId('away-score')).toHaveText(String(result.match.awayScore))
  const emotions = result.match.outcome === 'WIN' ? ['happy', 'sad'] : result.match.outcome === 'LOSS' ? ['sad', 'happy'] : ['neutral', 'neutral']
  await expect(page.locator('.duelist.home')).toHaveAttribute('data-emotion', emotions[0]!)
  await expect(page.locator('.duelist.away')).toHaveAttribute('data-emotion', emotions[1]!)
  await page.screenshot({ path: testInfo.outputPath('match-reward.png') })
  await page.getByRole('button', { name: 'Voltar ao bairro' }).click()
  const roster = await (await page.request.get('/api/v1/roster')).json()
  expect(roster[0].level).toBe(result.rewards!.currentLevel)
  expect(roster[0].xp).toBe(result.rewards!.currentXp)
  expect(roster[0].wins + roster[0].draws + roster[0].losses).toBe(1)
  expect(commands).toBe(1)
  // Reenter the same MatchScene for a rematch; clocks and controls must reset.
  await expect.poll(() => page.evaluate(async () => {
    const entry = '/src/main.ts'
    const { game } = await import(entry)
    const world = game.scene.getScene('WorldScene')
    return { active: game.scene.isActive('WorldScene'), choosing: world.choosing, keyboard: world.input.keyboard.enabled }
  })).toEqual({ active: true, choosing: false, keyboard: true })
  await expect.poll(async () => (await dialogueState(page)).open).toBe(true)
  expect((await dialogueState(page)).action).toContain('REVANCHE')
  await page.screenshot({ path: testInfo.outputPath('post-match-dialogue.png') })
  await page.keyboard.press('Enter', { delay: 80 })
  await expect(page.getByRole('button', { name: 'Iniciar desafio' })).toBeVisible()
  const rematchPromise = page.waitForResponse(response => response.url().includes('/matches'))
  await page.getByRole('button', { name: 'Iniciar desafio' }).click()
  const rematch = await (await rematchPromise).json() as DuelResponse
  expect(rematch.match.id).not.toBe(result.match.id)
  expect(rematch.rewards!.challengerProgress.attempts).toBe(2)
  await expect(page.getByTestId('reward')).toHaveCount(0)
  await page.getByRole('button', { name: 'Pular', exact: true }).click()
  await expect(page.getByTestId('reward')).toContainText(`+${rematch.rewards!.xpAwarded} XP`)
  await page.getByRole('button', { name: 'Voltar ao bairro' }).click()
  const latestRoster = await (await page.request.get('/api/v1/roster')).json()
  expect(latestRoster[0].wins + latestRoster[0].draws + latestRoster[0].losses).toBe(2)
  expect(commands).toBe(2)
  await page.reload()
  await continueGame(page)
  await expect.poll(() => page.evaluate(async () => {
    const entry = '/src/main.ts'
    const { game } = await import(entry)
    return game.scene.isActive('WorldScene')
  })).toBe(true)
  expect(persistentRoster(await (await page.request.get('/api/v1/roster')).json())[0]).toEqual(persistentRoster(latestRoster)[0])
  expect(errors).toEqual([])
})

test('lost response retries the same command and normal completion grants no additional reward', async ({ page }) => {
  test.setTimeout(45_000)
  await page.request.post('/api/v1/profiles', { data: { displayName: 'Retry' } })
  await page.request.post('/api/v1/profile/starter', { data: { playerDefinitionId: 'starter_leo' } })
  await page.goto('/')
  await continueGame(page)
  await walkToNpc(page)
  const keys: string[] = []
  let original: DuelResponse | undefined
  await page.route('**/challenges/*/matches', async route => {
    keys.push(route.request().headers()['idempotency-key']!)
    const response = await route.fetch()
    if (!original) {
      original = await response.json() as DuelResponse
      await route.abort('failed')
    } else {
      expect(await response.json()).toEqual(original)
      await route.fulfill({ response })
    }
  })
  await page.getByRole('button', { name: 'Iniciar desafio' }).click()
  await expect(page.getByRole('radio')).toBeDisabled()
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
  await page.getByRole('button', { name: 'Acelerar · 1×' }).click()
  await expect(page.getByTestId('reward')).toBeVisible({ timeout: 25_000 })
  expect(keys).toHaveLength(2)
  expect(keys[0]).toBe(keys[1])
  await expect(page.getByTestId('home-score')).toHaveText(String(original!.match.homeScore))
  await expect(page.getByTestId('away-score')).toHaveText(String(original!.match.awayScore))
  await page.getByRole('button', { name: 'Voltar ao bairro' }).click()
  const roster = await (await page.request.get('/api/v1/roster')).json()
  expect(roster[0].wins + roster[0].draws + roster[0].losses).toBe(1)
  expect(roster[0].xp).toBe(original!.rewards!.currentXp)
})

test('player cards support mouse and keyboard and send the chosen owned player', async ({ page }, testInfo) => {
  await page.request.post('/api/v1/profiles', { data: { displayName: 'Elenco' } })
  await page.request.post('/api/v1/profile/starter', { data: { playerDefinitionId: 'starter_leo' } })
  const [starter] = await (await page.request.get('/api/v1/roster')).json() as RosterPlayer[]
  // Presentation fixture for a larger roster, without introducing recruitment before M5.
  const roster: RosterPlayer[] = [starter!, { ...starter!, id: 'second-owned-player', playerDefinitionId: 'npc_cora_01', name: 'Cora', level: 2 }]
  await page.route('**/api/v1/roster', route => route.fulfill({ json: roster }))
  await page.goto('/')
  await continueGame(page)
  await walkToNpc(page)
  const leo = page.getByRole('radio', { name: 'Cabeleira, nível 1' })
  const cora = page.getByRole('radio', { name: 'Cora, nível 2' })
  await expect(page.getByRole('radio')).toHaveCount(2)
  await page.locator('.player-card').filter({ hasText: 'Cora' }).click()
  await expect(cora).toBeChecked()
  await cora.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(leo).toBeChecked()
  await page.keyboard.press('ArrowRight')
  await expect(cora).toBeChecked()
  await page.screenshot({ path: testInfo.outputPath('roster-cards.png') })
  await page.route('**/challenges/*/matches', route => route.fulfill({ status: 400, json: { code: 'PLAYER_NOT_OWNED' } }))
  const sent = page.waitForRequest(request => request.method() === 'POST' && request.url().includes('/matches'))
  await page.getByRole('button', { name: 'Iniciar desafio' }).click()
  expect((await sent).postDataJSON()).toEqual({ ownedPlayerId: roster[1]!.id })
  await page.getByRole('button', { name: 'Voltar', exact: true }).click()
  await expect(page.getByRole('radio')).toHaveCount(0)
  await page.keyboard.press('e', { delay: 80 })
  await expect.poll(async () => (await dialogueState(page)).open).toBe(true)
})

test('challenger reacts to each server outcome and offers a rematch', async ({ page }) => {
  await page.request.post('/api/v1/profiles', { data: { displayName: 'Conversa' } })
  await page.request.post('/api/v1/profile/starter', { data: { playerDefinitionId: 'starter_leo' } })
  await page.goto('/')
  await continueGame(page)
  await walkToNpc(page)
  const outcomes = [
    { outcome: 'WIN', homeScore: 1, awayScore: 0, text: 'Parabéns pela vitória!' },
    { outcome: 'LOSS', homeScore: 0, awayScore: 1, text: 'Continue treinando' },
    { outcome: 'DRAW', homeScore: 0, awayScore: 0, text: 'Ficou tudo igual.' },
  ] as const
  for (const [index, entry] of outcomes.entries()) {
    const result: DuelResponse = {
      match: {
        id: `conversation-${index}`, home: [{ playerId: 'home', name: 'Cabeleira', level: 1 }],
        away: [{ playerId: 'away', name: 'Nilo', level: 1 }],
        outcome: entry.outcome, homeScore: entry.homeScore, awayScore: entry.awayScore,
        events: [{ sequence: 1, minute: 1, type: entry.outcome === 'DRAW' ? 'POSSESSION' : 'GOAL',
          side: entry.outcome === 'LOSS' ? 'AWAY' : 'HOME', actorPlayerId: entry.outcome === 'LOSS' ? 'away' : 'home',
          homeScore: entry.homeScore, awayScore: entry.awayScore }],
      }, rewards: null,
    }
    await page.route('**/challenges/*/matches', route => route.fulfill({ json: result }))
    await page.getByRole('button', { name: 'Iniciar desafio' }).click()
    await page.getByRole('button', { name: 'Pular', exact: true }).click()
    await page.getByRole('button', { name: 'Voltar ao bairro' }).click()
    await expect.poll(async () => (await dialogueState(page)).open).toBe(true)
    const dialogue = await dialogueState(page)
    expect(dialogue.text).toContain('Nilo · Desafiante')
    expect(dialogue.text).toContain(entry.text)
    expect(dialogue.action).toContain('REVANCHE')
    if (index < outcomes.length - 1) {
      await page.keyboard.press('Enter', { delay: 80 })
      await expect(page.getByRole('button', { name: 'Iniciar desafio' })).toBeVisible()
    }
  }
  await page.keyboard.press('Escape', { delay: 80 })
  await expect.poll(async () => (await dialogueState(page)).open).toBe(false)
})

test('goal raises the scorer arms, holds the caption and shows winner and loser poses', async ({ page }, testInfo) => {
  await page.request.post('/api/v1/profiles', { data: { displayName: 'Comemoração' } })
  await page.request.post('/api/v1/profile/starter', { data: { playerDefinitionId: 'starter_leo' } })
  await page.goto('/')
  await continueGame(page)
  await walkToNpc(page)
  // Fixed presentation fixture: the real-API smoke above covers simulation and persistence.
  const result: DuelResponse = {
    match: {
      id: 'celebration', home: [{ playerId: 'home', name: 'Cabeleira', level: 1 }],
      away: [{ playerId: 'away', name: 'Nilo', level: 1 }], homeScore: 1, awayScore: 0, outcome: 'WIN',
      events: [
        { sequence: 1, minute: 1, type: 'GOAL', side: 'HOME', actorPlayerId: 'home', homeScore: 1, awayScore: 0 },
        { sequence: 2, minute: 2, type: 'POSSESSION', side: 'AWAY', actorPlayerId: 'away', homeScore: 1, awayScore: 0 },
      ],
    },
    rewards: null,
  }
  await page.route('**/challenges/*/matches', route => route.fulfill({ json: result }))
  await page.getByRole('button', { name: 'Iniciar desafio' }).click()
  await page.getByRole('button', { name: 'Acelerar · 1×' }).click()
  await expect.poll(() => page.locator('.duel-ball').getAttribute('data-shot'), { intervals: [20] }).toBe('home')
  expect(await page.getByTestId('current-event').textContent()).not.toContain('GOL!')
  await expect(page.getByTestId('home-score')).toHaveText('0')
  await expect.poll(() => page.locator('.duel-ball').evaluate(ball => getComputedStyle(ball).animationName)).toBe('shot-home')
  await expect(page.getByTestId('current-event')).toContainText('GOL!')
  await expect(page.getByTestId('home-score')).toHaveText('1')
  await expect(page.locator('.duelist.home')).toHaveAttribute('data-emotion', 'happy')
  await expect(page.locator('.duelist.away')).toHaveAttribute('data-emotion', 'neutral')
  await page.screenshot({ path: testInfo.outputPath('goal-celebration.png') })
  await page.getByRole('button', { name: 'Pular', exact: true }).click()
  await expect(page.locator('.duelist.home')).toHaveAttribute('data-emotion', 'happy')
  await expect(page.locator('.duelist.away')).toHaveAttribute('data-emotion', 'sad')
  await page.screenshot({ path: testInfo.outputPath('winner-and-loser.png') })
})

test('both teams shoot into their net and a missed shot stays outside', async ({ page }) => {
  await page.request.post('/api/v1/profiles', { data: { displayName: 'Gols dos dois lados' } })
  await page.request.post('/api/v1/profile/starter', { data: { playerDefinitionId: 'starter_leo' } })
  await page.goto('/')
  await continueGame(page)
  await walkToNpc(page)
  const events: MatchEvent[] = [
    { sequence: 1, minute: 1, type: 'GOAL', side: 'HOME', actorPlayerId: 'home', homeScore: 1, awayScore: 0 },
    { sequence: 2, minute: 2, type: 'GOAL', side: 'AWAY', actorPlayerId: 'away', homeScore: 1, awayScore: 1 },
    { sequence: 3, minute: 3, type: 'SHOT_MISSED', side: 'HOME', actorPlayerId: 'home', homeScore: 1, awayScore: 1 },
  ]
  const result: DuelResponse = {
    match: { id: 'both-goals', home: [{ playerId: 'home', name: 'Cabeleira', level: 1 }],
      away: [{ playerId: 'away', name: 'Nilo', level: 1 }], homeScore: 1, awayScore: 1,
      outcome: 'DRAW', events }, rewards: null,
  }
  await page.route('**/challenges/*/matches', route => route.fulfill({ json: result }))
  await page.getByRole('button', { name: 'Iniciar desafio' }).click()
  await expect(page.getByRole('region', { name: 'Partida', exact: true })).toBeVisible()
  const show = async (event: MatchEvent) => page.evaluate(async shot => {
    const { game } = await import('/src/main.ts')
    const scene = game.scene.getScene('MatchScene') as unknown as { showEvents: (events: MatchEvent[]) => void }
    scene.showEvents([shot])
  }, event)
  await show(events[0]!)
  expect(await page.getByTestId('current-event').textContent()).not.toContain('GOL!')
  await expect(page.getByTestId('home-score')).toHaveText('0')
  await expect(page.getByTestId('current-event')).toContainText('GOL!')
  await expect(page.getByTestId('home-score')).toHaveText('1')
  const homeInNet = await page.evaluate(() => {
    const ball = document.querySelector('.duel-ball')!.getBoundingClientRect()
    const net = document.querySelector('.duel-goal.goal-home')!.getBoundingClientRect()
    return { inside: ball.left >= net.left && ball.right <= net.right && ball.top >= net.top && ball.bottom <= net.bottom,
      width: net.width, mesh: getComputedStyle(document.querySelector('.duel-goal.goal-home')!).backgroundImage }
  })
  expect(homeInNet.inside).toBe(true)
  expect(homeInNet.width).toBeGreaterThan(30)
  expect(homeInNet.mesh).toContain('linear-gradient')
  await show(events[1]!)
  expect(await page.getByTestId('current-event').textContent()).not.toContain('GOL!')
  await expect(page.getByTestId('away-score')).toHaveText('0')
  await expect(page.getByTestId('current-event')).toContainText('Nilo marcou um GOL!')
  await expect(page.getByTestId('away-score')).toHaveText('1')
  const awayInNet = await page.evaluate(() => {
    const ball = document.querySelector('.duel-ball')!.getBoundingClientRect()
    const net = document.querySelector('.duel-goal.goal-away')!.getBoundingClientRect()
    return ball.left >= net.left && ball.right <= net.right && ball.top >= net.top && ball.bottom <= net.bottom
  })
  expect(awayInNet).toBe(true)
  await show(events[2]!)
  await page.waitForTimeout(600)
  await expect(page.getByTestId('current-event')).toContainText('fora!')
  await expect(page.getByTestId('home-score')).toHaveText('1')
  await expect(page.getByTestId('away-score')).toHaveText('1')
  const missedNet = await page.evaluate(() => {
    const ball = document.querySelector('.duel-ball')!.getBoundingClientRect()
    const net = document.querySelector('.duel-goal.goal-home')!.getBoundingClientRect()
    return ball.bottom < net.top
  })
  expect(missedNet).toBe(true)
})

test('duel events move the athletes, carry the ball, dribble and tackle', async ({ page }) => {
  await page.request.post('/api/v1/profiles', { data: { displayName: 'Coreografia' } })
  await page.request.post('/api/v1/profile/starter', { data: { playerDefinitionId: 'starter_rafa' } })
  await page.goto('/')
  await continueGame(page)
  await walkToNpc(page)
  const events: MatchEvent[] = [
    { sequence: 1, minute: 1, type: 'POSSESSION', side: 'HOME', actorPlayerId: 'home', homeScore: 0, awayScore: 0 },
    { sequence: 2, minute: 2, type: 'DRIBBLE_SUCCESS', side: 'HOME', actorPlayerId: 'home', homeScore: 0, awayScore: 0 },
    { sequence: 3, minute: 3, type: 'TACKLE', side: 'AWAY', actorPlayerId: 'away', homeScore: 0, awayScore: 0 },
  ]
  const result: DuelResponse = {
    match: {
      id: 'choreography',
      home: [{ playerId: 'home', playerDefinitionId: 'starter_rafa', name: 'Loraco', level: 1 }],
      away: [{ playerId: 'away', playerDefinitionId: 'npc_cora_01', name: 'Cora', level: 1 }],
      homeScore: 0, awayScore: 0, outcome: 'DRAW', events,
    },
    rewards: null,
  }
  await page.route('**/challenges/*/matches', route => route.fulfill({ json: result }))
  await page.getByRole('button', { name: 'Iniciar desafio' }).click()
  await expect(page.getByRole('region', { name: 'Partida', exact: true })).toBeVisible()
  await expect(page.locator('.duelist.away .duel-sprite')).toHaveCSS('background-image', /challenger-curls/)
  const show = async (shot: MatchEvent) => page.evaluate(async event => {
    const { game } = await import('/src/main.ts')
    const scene = game.scene.getScene('MatchScene') as unknown as { showEvents: (events: MatchEvent[]) => void }
    scene.showEvents([event])
  }, shot)

  await show(events[0]!)
  await expect(page.locator('.duel-ball')).toHaveAttribute('data-owner', 'home')
  await expect(page.locator('.duelist.home')).toHaveAttribute('data-action', 'carry')
  const firstLane = await page.locator('.duelist.home').evaluate(el => (el as HTMLElement).style.getPropertyValue('--duelist-y'))

  await show(events[1]!)
  await expect(page.locator('.duelist.home')).toHaveAttribute('data-action', 'dribble')
  await expect(page.locator('.duelist.away')).toHaveAttribute('data-action', 'stumble')
  const secondLane = await page.locator('.duelist.home').evaluate(el => (el as HTMLElement).style.getPropertyValue('--duelist-y'))
  expect(secondLane).not.toBe(firstLane)

  await show(events[2]!)
  await expect(page.locator('.duelist.away')).toHaveAttribute('data-action', 'tackle')
  await expect(page.locator('.duel-ball')).toHaveAttribute('data-owner', 'away')
})
