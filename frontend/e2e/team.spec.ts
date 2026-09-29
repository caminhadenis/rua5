import { expect, test, type Page } from '@playwright/test'
import type { DuelResponse, RosterPlayer } from '../src/api/gameApi'

async function enterWorld(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Equipe · T' })).toBeVisible()
}

async function approach(page: Page) {
  await page.keyboard.down('ArrowRight')
  await expect.poll(() => page.evaluate(async () => {
    const entry = '/src/main.ts'
    const { game } = await import(entry)
    return game.scene.getScene('WorldScene').hud.isDialogueOpen as boolean
  }), { timeout: 7000, intervals: [20] }).toBe(true)
  await page.keyboard.up('ArrowRight')
  await page.keyboard.press('Enter', { delay: 80 })
}

async function expectNiloRecruited(page: Page) {
  await expect.poll(() => page.evaluate(async () => {
    const entry = '/src/main.ts'
    const { game } = await import(entry)
    const scene = game.scene.getScene('WorldScene')
    const npc = scene.npcs.find((npc: { content: { playerDefinitionId?: string } }) => npc.content.playerDefinitionId === 'npc_nilo_01')
    return { visible: npc.sprite.visible, active: npc.sprite.active, collision: npc.sprite.body.enable }
  })).toEqual({ visible: false, active: false, collision: false })
}

test('real victory → recruit with lost response → roster → lineup → reload', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.request.post('/api/v1/profiles', { data: { displayName: 'Recrutamento', primaryColor: '#2266aa', secondaryColor: '#dd3344' } })
  await page.request.post('/api/v1/profile/starter', { data: { playerDefinitionId: 'starter_breno' } })
  await enterWorld(page)
  await approach(page)
  let won = false
  // Real simulation, no seed or score injection. Rematch if the first game is not a win.
  for (let attempt = 0; attempt < 20; attempt++) {
    const response = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/matches'))
    await page.getByRole('button', { name: 'Iniciar desafio' }).click()
    const result = await (await response).json() as DuelResponse
    await page.getByRole('button', { name: 'Pular', exact: true }).click()
    if (result.match.outcome === 'WIN') { won = true; break }
    await expect(page.getByRole('button', { name: 'Convidar para o time' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Voltar ao bairro' }).click()
    await expect(page.getByRole('button', { name: 'Equipe · T' })).toBeVisible()
    await page.keyboard.press('Enter', { delay: 80 })
  }
  expect(won).toBe(true)
  await expect(page.getByRole('button', { name: 'Convidar para o time' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('recruitment-unlocked.png') })
  const receipts: unknown[] = []
  await page.route('**/challenges/*/recruit', async route => {
    const response = await route.fetch()
    receipts.push(await response.json())
    if (receipts.length === 1) await route.abort('failed')
    else await route.fulfill({ response })
  })
  await page.getByRole('button', { name: 'Convidar para o time' }).click()
  await page.getByRole('button', { name: 'Tentar convite novamente' }).click()
  await expect(page.getByRole('region', { name: 'Recrutamento · Nilo' }).getByRole('status')).toContainText('Nilo entrou para o seu time!')
  await expectNiloRecruited(page)
  expect(receipts).toHaveLength(2)
  expect(receipts[0]).toEqual(receipts[1])
  const roster = await (await page.request.get('/api/v1/roster')).json() as RosterPlayer[]
  expect(roster).toHaveLength(2)
  const nilo = roster.find(p => p.playerDefinitionId === 'npc_nilo_01')!
  const starter = roster.find(p => p.playerDefinitionId === 'starter_breno')!
  await page.getByRole('button', { name: 'Voltar ao bairro' }).click()
  await page.getByRole('button', { name: 'Equipe · T' }).click()
  await expect(page.getByRole('region', { name: 'Equipe', exact: true })).toBeVisible()
  await expect(page.getByRole('radio')).toHaveCount(2)
  for (const sprite of await page.locator('.player-card-sprite').all()) {
    const svg = decodeURIComponent(await sprite.evaluate(el => (el as HTMLElement).style.backgroundImage))
    expect(svg).toContain('#2266aa')
    expect(svg).toContain('#dd3344')
  }
  await expect(page.locator('.lineup-slot')).toHaveCount(5)
  await expect(page.getByRole('region', { name: 'Recrutamento · Nilo' })).toContainText('Nilo já faz parte')
  await page.getByRole('button', { name: 'Slot 1 · Vazio', exact: true }).click()
  await page.locator('.player-card').filter({ hasText: 'Nilo' }).click()
  await expect(page.locator('.player-details')).toContainText('Marcador · Defesa')
  await expect(page.locator('.player-details')).toContainText(String(nilo.stats.defending))
  await page.getByRole('button', { name: 'Slot 2 · Vazio', exact: true }).click()
  const payloads: unknown[] = []
  await page.route('**/api/v1/lineup', async route => {
    if (route.request().method() !== 'PUT') { await route.continue(); return }
    payloads.push(route.request().postDataJSON())
    const response = await route.fetch()
    if (payloads.length === 1) await route.abort('failed')
    else await route.fulfill({ response })
  })
  await page.getByRole('button', { name: 'Salvar escalação' }).click()
  await expect(page.getByRole('button', { name: 'Tentar salvar novamente' })).toBeVisible()
  await expect(page.getByRole('radio').first()).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Slot 3 · Vazio', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Tentar salvar novamente' }).click()
  await expect(page.getByRole('status').first()).toContainText('2 / 5 escalados · Escalação salva')
  expect(payloads).toHaveLength(2)
  expect(payloads[0]).toEqual(payloads[1])
  const expected = { ownedPlayerIds: [starter.id, nilo.id, null, null, null] }
  expect(await (await page.request.get('/api/v1/lineup')).json()).toEqual(expected)
  await page.screenshot({ path: testInfo.outputPath('team-lineup.png') })
  await page.reload()
  await expect(page.getByRole('button', { name: 'Equipe · T' })).toBeVisible()
  await expectNiloRecruited(page)
  await page.getByRole('button', { name: 'Equipe · T' }).click()
  await expect(page.getByRole('button', { name: 'Slot 2 · Nilo', exact: true })).toBeVisible()
  await expect(page.getByRole('radio')).toHaveCount(2)
  for (const sprite of await page.locator('.player-card-sprite').all()) {
    const svg = decodeURIComponent(await sprite.evaluate(el => (el as HTMLElement).style.backgroundImage))
    expect(svg).toContain('#2266aa')
    expect(svg).toContain('#dd3344')
  }
  await page.getByRole('button', { name: 'Voltar ao bairro', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Equipe · T' })).toBeVisible()
  expect(errors).toEqual([])
})

test('five-slot editor supports full teams reserves moving and removing players', async ({ page }, testInfo) => {
  await page.request.post('/api/v1/profiles', { data: { displayName: 'Escalação' } })
  await page.request.post('/api/v1/profile/starter', { data: { playerDefinitionId: 'starter_leo' } })
  const [starter] = await (await page.request.get('/api/v1/roster')).json() as RosterPlayer[]
  // UI fixture only: database tests cover five owned players and ownership constraints.
  const roster = Array.from({ length: 6 }, (_, index) => ({ ...starter!, id: `fixture-${index}`, name: `Jogador ${index + 1}` }))
  let saved: { ownedPlayerIds: (string | null)[] } = { ownedPlayerIds: Array(5).fill(null) }
  await page.route('**/api/v1/roster', route => route.fulfill({ json: roster }))
  await page.route('**/api/v1/lineup', async route => {
    if (route.request().method() === 'PUT') saved = route.request().postDataJSON()
    await route.fulfill({ json: saved })
  })
  await enterWorld(page)
  await page.keyboard.press('t', { delay: 80 })
  for (let slot = 1; slot <= 5; slot++) {
    await page.locator('.player-card').filter({ hasText: `Jogador ${slot}` }).click()
    await page.getByRole('button', { name: `Slot ${slot} · Vazio`, exact: true }).click()
  }
  await page.getByRole('button', { name: 'Salvar escalação' }).click()
  await expect(page.getByRole('status').first()).toContainText('5 / 5 escalados · Escalação salva')
  expect(saved.ownedPlayerIds).toEqual(roster.slice(0, 5).map(p => p.id))
  await page.screenshot({ path: testInfo.outputPath('full-lineup.png') })
  await page.locator('.player-card').filter({ hasText: 'Jogador 1' }).click()
  await page.getByRole('button', { name: 'Slot 3 · Jogador 3', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Slot 1 · Vazio', exact: true })).toBeVisible()
  await page.locator('.player-card').filter({ hasText: 'Jogador 6' }).click()
  await page.getByRole('button', { name: 'Slot 1 · Vazio', exact: true }).click()
  await page.getByRole('button', { name: 'Retirar Jogador 2 do slot 2', exact: true }).click()
  await page.getByRole('button', { name: 'Salvar escalação' }).click()
  await expect(page.getByRole('status').first()).toContainText('4 / 5 escalados · Escalação salva')
  expect(saved.ownedPlayerIds).toEqual(['fixture-5', null, 'fixture-0', 'fixture-3', 'fixture-4'])
  await page.getByRole('button', { name: 'Voltar ao bairro', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Equipe · T' })).toBeVisible()
  await page.keyboard.press('t', { delay: 80 })
  await expect(page.getByRole('button', { name: 'Slot 3 · Jogador 1', exact: true })).toBeVisible()
})


test('inviting through the team screen removes the challenger from the neighborhood', async ({ page }) => {
  await page.request.post('/api/v1/profiles', { data: { displayName: 'Convite na equipe' } })
  const starter = await (await page.request.post('/api/v1/profile/starter', { data: { playerDefinitionId: 'starter_breno' } })).json()
  let won = false
  for (let attempt = 0; attempt < 20; attempt++) {
    const result = await (await page.request.post('/api/v1/challenges/00000000-0000-4000-8000-000000000001/matches', {
      headers: { 'Idempotency-Key': crypto.randomUUID() }, data: { ownedPlayerId: starter.id },
    })).json() as DuelResponse
    if (result.match.outcome === 'WIN') { won = true; break }
  }
  expect(won).toBe(true)
  await enterWorld(page)
  await page.getByRole('button', { name: 'Equipe · T' }).click()
  await page.getByRole('region', { name: 'Recrutamento · Nilo' }).getByRole('button', { name: 'Convidar para o time' }).click()
  await expect(page.getByRole('radio')).toHaveCount(2)
  await expectNiloRecruited(page)
  await page.getByRole('button', { name: 'Voltar ao bairro', exact: true }).click()
  await expectNiloRecruited(page)
})
