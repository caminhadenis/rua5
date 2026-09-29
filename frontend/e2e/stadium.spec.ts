import { expect, test, type Page } from '@playwright/test'

async function enterStadium(page: Page) {
  // Move to the authored entry; actual interaction and every API call remain real.
  await page.evaluate(async () => {
    const entry = '/src/main.ts'
    const { game } = await import(entry)
    const world = game.scene.getScene('WorldScene')
    world.player.setPosition(world.stadiumPoint.x, world.stadiumPoint.y - 24)
  })
  await page.keyboard.press('e', { delay: 80 })
  await expect(page.getByRole('region', { name: 'Estádio', exact: true })).toBeVisible()
}

test('stadium rejects incomplete lineup through the real UI', async ({ page }) => {
  await page.request.post('/api/v1/profiles', { data: { displayName: 'Estádio incompleto' } })
  await page.request.post('/api/v1/profile/starter', { data: { playerDefinitionId: 'starter_leo' } })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Equipe · T' })).toBeVisible()
  await enterStadium(page)
  await expect(page.getByText('Professor Dimas · treinador')).toBeVisible()
  await page.getByRole('button', { name: 'Ouvir mais de Dimas' }).click()
  await expect(page.getByText(/Íris e Tito protegem a defesa/)).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Escale cinco jogadores')
  await expect(page.getByRole('button', { name: 'Disputar 5 × 5' })).toHaveCount(0)
})
