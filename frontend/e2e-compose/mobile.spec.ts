import { expect, test } from '@playwright/test'
import type { DuelResponse, RosterPlayer } from '../src/api/gameApi'
import { expectPanelFits } from '../e2e/helpers/mobilePanel'

test.use({ viewport: { width: 667, height: 375 }, screen: { width: 667, height: 375 }, hasTouch: true, isMobile: true })

test('compiled phone client walks, challenges and restores progress using only touch', async ({ page, context }, testInfo) => {
  test.setTimeout(45_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await page.getByRole('button', { name: 'Começar', exact: true }).tap()
  await page.getByRole('button', { name: 'Confirmar cores', exact: true }).tap()
  await page.getByRole('button', { name: 'Escolher Aderlou' }).tap()
  const controls = page.getByRole('navigation', { name: 'Controles de toque' })
  await expect(controls).toBeVisible()
  await expect(page.getByRole('button', { name: 'Equipe · T' })).toBeHidden()
  const canvas = (await page.locator('canvas').boundingBox())!
  const pad = (await controls.locator('.touch-dpad').boundingBox())!
  expect(pad.x + pad.width).toBeLessThanOrEqual(canvas.x)
  const cdp = await context.newCDPSession(page)
  const right = (await controls.getByRole('button', { name: 'Mover para a direita' }).boundingBox())!
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: right.x + right.width / 2, y: right.y + right.height / 2, id: 1 }] })
  await expect(controls.getByRole('button', { name: 'Desafiar', exact: true })).toBeEnabled({ timeout: 10_000 })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect(page.getByRole('region', { name: 'Conversa' })).toContainText('Nilo')
  await page.screenshot({ path: testInfo.outputPath('phone-small-landscape.png') })
  await controls.getByRole('button', { name: 'Desafiar', exact: true }).tap()
  await expect(page.getByRole('button', { name: 'Iniciar desafio' })).toBeVisible()
  await expectPanelFits(page, '.duel-selection-panel')
  await page.screenshot({ path: testInfo.outputPath('phone-selection-compact.png') })
  const response = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/matches'))
  await page.getByRole('button', { name: 'Iniciar desafio' }).tap()
  const result = await (await response).json() as DuelResponse
  await expect(page.getByRole('button', { name: 'Pular', exact: true })).toBeVisible()
  await expectPanelFits(page, '.duel-panel')
  await page.screenshot({ path: testInfo.outputPath('phone-duel-compact.png') })
  await page.getByRole('button', { name: 'Pular', exact: true }).tap()
  await expect(page.getByTestId('reward')).toContainText(`+${result.rewards!.xpAwarded} XP`)
  await expect(page.getByRole('region', { name: 'Recrutamento · Nilo' })).toBeVisible()
  await expectPanelFits(page, '.duel-panel')
  await page.screenshot({ path: testInfo.outputPath('phone-result-compact.png') })
  const roster = await (await page.request.get('/api/v1/roster')).json() as RosterPlayer[]
  expect(roster[0]!.xp).toBe(result.rewards!.currentXp)
  expect(roster[0]!.wins + roster[0]!.draws + roster[0]!.losses).toBe(1)
  await page.reload()
  await expect(controls).toBeVisible()
  expect(await (await page.request.get('/api/v1/roster')).json()).toEqual(roster)
  expect(errors).toEqual([])
})
