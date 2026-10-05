import { expect, type Page } from '@playwright/test'

export async function expectPanelFits(page: Page, selector: string) {
  const panel = page.locator(selector)
  await expect(panel).toBeVisible()
  const dimensions = await panel.evaluate(element => ({
    width: element.clientWidth, height: element.clientHeight,
    contentWidth: element.scrollWidth, contentHeight: element.scrollHeight,
  }))
  expect(dimensions.contentHeight, `${selector} should fit without scrolling`).toBeLessThanOrEqual(dimensions.height + 1)
  expect(dimensions.contentWidth).toBeLessThanOrEqual(dimensions.width + 1)
  for (const button of await panel.getByRole('button').all()) {
    if (!await button.isVisible()) continue
    const target = await button.evaluate(element => {
      const box = element.getBoundingClientRect()
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
      return { width: box.width, height: box.height, visible: hit !== null && element.contains(hit), bottom: box.bottom }
    })
    expect(target.width).toBeGreaterThanOrEqual(44)
    expect(target.height).toBeGreaterThanOrEqual(44)
    expect(target.bottom).toBeLessThanOrEqual(page.viewportSize()!.height)
    expect(target.visible, `Action ${await button.textContent()} must be reachable`).toBe(true)
  }
}
