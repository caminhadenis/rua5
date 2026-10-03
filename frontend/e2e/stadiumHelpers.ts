import { expect, type Page } from '@playwright/test'

export async function talkToStadiumCoach(page: Page) {
  await expect.poll(() => page.evaluate(async () => {
    const { game } = await import('/src/main.ts')
    return game.scene.isActive('InteriorScene')
  })).toBe(true)
  const coordinate = (axis: 'x' | 'y') => page.evaluate(async axis => {
    const { game } = await import('/src/main.ts')
    return game.scene.getScene('InteriorScene').player[axis] as number
  }, axis)
  await page.keyboard.down('ArrowUp')
  await expect.poll(() => coordinate('y'), { intervals: [20] }).toBeLessThan(310)
  await page.keyboard.up('ArrowUp')
  await page.keyboard.down('ArrowRight')
  await expect.poll(() => coordinate('x'), { intervals: [20] }).toBeGreaterThan(675)
  await page.keyboard.up('ArrowRight')
  await page.keyboard.press('e', { delay: 80 })
  await expect.poll(() => page.evaluate(async () => {
    const { game } = await import('/src/main.ts')
    return game.scene.getScene('InteriorScene').dialogue?.list[1]?.text as string
  })).toContain('Professor Dimas')
  await page.keyboard.press('Enter', { delay: 80 })
  await expect(page.getByRole('region', { name: 'Estádio', exact: true })).toBeVisible()
}
