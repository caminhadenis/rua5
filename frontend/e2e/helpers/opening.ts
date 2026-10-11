import { expect, type Page } from '@playwright/test'

/** Play the new opening up to the existing uniform picker, without injecting scene state. */
export async function startOpening(page: Page, name = 'Jogador'): Promise<void> {
  await expect(page.getByRole('button', { name: 'INICIAR', exact: true })).toBeVisible()
  const phone = await page.locator('html').evaluate(html => html.classList.contains('is-phone'))
  const press = async (name: string) => {
    const button = page.getByRole('button', { name, exact: true })
    if (phone) await button.tap()
    else await button.click()
  }
  await press('INICIAR')
  await press('Próxima fala')
  await page.getByRole('textbox', { name: 'Seu nome' }).fill(name)
  await press('Confirmar nome')
  for (let speech = 0; speech < 6; speech++) await press('Próxima fala')
  await press('Encerrar cerimônia')
  const welcome = page.getByRole('button', { name: 'Conversar sobre meu time' })
  if (phone) {
    const down = page.getByRole('button', { name: 'Mover para baixo' })
    await expect(down).toBeVisible()
    await expect(down).toBeEnabled()
    const box = (await down.boundingBox())!
    const touch = await page.context().newCDPSession(page)
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }] })
    try { await expect(welcome).toBeVisible({ timeout: 8000 }) }
    finally { await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await touch.detach() }
  } else {
    await page.keyboard.down('ArrowDown')
    try { await expect(welcome).toBeVisible({ timeout: 8000 }) }
    finally { await page.keyboard.up('ArrowDown') }
  }
  await press('Conversar sobre meu time')
}

export async function continueGame(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'CONTINUAR', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Menu Rua 5', exact: true })).toHaveCount(0)
}

/** Read Miguel's post-selection advice and choose independent exploration. */
export async function finishStarterGuidance(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Próxima orientação', exact: true }).click()
  await page.getByRole('button', { name: 'Próxima orientação', exact: true }).click()
  await page.getByRole('button', { name: 'Explorar o bairro', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Boas-vindas ao bairro' })).toContainText('casa da Dona Amélia')
  await page.getByRole('button', { name: 'Entendido, Miguel!', exact: true }).click()
}
