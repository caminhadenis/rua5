import { expect, test } from '@playwright/test'
import { continueGame, finishStarterGuidance, startOpening } from '../e2e/helpers/opening'
import type { DuelResponse, RosterPlayer } from '../src/api/gameApi'
import { persistentRoster } from '../e2e/helpers/roster'
import { execFileSync } from 'node:child_process'

test('production account → real duel → logout → another browser restores the same save', async ({ page, browser, baseURL }) => {
  test.setTimeout(90_000)
  const email = `deploy-${crypto.randomUUID()}@example.com`
  const password = 'Senha-de-teste-123'
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const response = await page.goto('/')
  expect(response!.headers()['cache-control']).toContain('no-cache')
  await expect(page.getByRole('form', { name: 'Conta Rua 5' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'INICIAR', exact: true })).toBeHidden()
  expect((await page.request.get('/api/v1/roster')).status()).toBe(401)
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
  await expect(page.getByRole('button', { name: 'INICIAR', exact: true })).toBeEnabled()
  expect((await page.request.post('/api/v1/profiles', { data: { displayName: 'Sem CSRF' } })).status()).toBe(403)
  await startOpening(page, 'Conta na nuvem')
  await page.getByRole('button', { name: 'Confirmar cores', exact: true }).click()
  await page.getByRole('button', { name: 'Escolher Aderlou' }).click()
  await finishStarterGuidance(page)
  await page.keyboard.down('ArrowRight')
  await page.waitForTimeout(6000)
  await page.keyboard.up('ArrowRight')
  await page.keyboard.press('Enter', { delay: 80 })
  const match = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/matches'))
  await page.getByRole('button', { name: 'Iniciar desafio' }).click()
  const result = await (await match).json() as DuelResponse
  await page.getByRole('button', { name: 'Pular', exact: true }).click()
  await expect(page.getByTestId('reward')).toContainText(`+${result.rewards!.xpAwarded} XP`)
  const roster = await (await page.request.get('/api/v1/roster')).json() as RosterPlayer[]
  expect(roster).toHaveLength(1)
  expect(roster[0]!.xp).toBe(result.rewards!.currentXp)
  const profile = await (await page.request.get('/api/v1/profile')).json() as { id: string }
  if (baseURL === 'http://127.0.0.1:5176') {
    // Restart only our isolated local rehearsal, never a remote deployment.
    execFileSync('docker', ['compose', '-p', 'rua5-deploy-validation', '-f', 'compose.deploy-test.yaml', 'restart', 'game'], {
      cwd: new URL('../../', import.meta.url), timeout: 30_000,
    })
    await expect.poll(async () => (await page.request.get('/health').catch(() => undefined))?.status(), { timeout: 45_000 }).toBe(200)
    expect(await (await page.request.get('/api/v1/profile')).json()).toMatchObject({ id: profile.id })
    expect(persistentRoster(await (await page.request.get('/api/v1/roster')).json())).toEqual(persistentRoster(roster))
  }
  await page.reload()
  await expect(page.getByRole('button', { name: 'Sair da conta', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Sair da conta', exact: true }).click()
  await expect(page.getByRole('form', { name: 'Conta Rua 5' })).toBeVisible()
  expect((await page.request.get('/api/v1/profile')).status()).toBe(401)

  const device = await browser.newContext({ baseURL })
  try {
    const second = await device.newPage()
    await second.goto('/')
    await second.getByLabel('E-mail', { exact: true }).fill(email)
    await second.getByLabel('Senha', { exact: true }).fill(password)
    await second.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(second.getByRole('button', { name: 'CONTINUAR', exact: true })).toBeEnabled()
    expect(await (await second.request.get('/api/v1/profile')).json()).toMatchObject({ id: profile.id })
    expect(persistentRoster(await (await second.request.get('/api/v1/roster')).json())).toEqual(persistentRoster(roster))
    await continueGame(second)
    await expect(second.getByRole('button', { name: 'Equipe · T' })).toBeVisible()
  } finally { await device.close() }
  expect(errors).toEqual([])
})

test('phone can register and sign in using the production menu', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true })
  try {
    const page = await context.newPage()
    await page.goto('/')
    await page.getByLabel('E-mail', { exact: true }).fill(`phone-${crypto.randomUUID()}@example.com`)
    await page.getByLabel('Senha', { exact: true }).fill('Senha-de-teste-123')
    await page.getByRole('button', { name: 'Criar conta', exact: true }).tap()
    await expect(page.getByRole('button', { name: 'INICIAR', exact: true })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Sair da conta', exact: true })).toBeVisible()
  } finally { await context.close() }
})
