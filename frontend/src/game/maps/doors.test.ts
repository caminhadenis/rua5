import { describe, expect, it } from 'vitest'
import { outsideDoor, touchesDoor } from './doors'

describe('automatic door thresholds', () => {
  const door = { x: 480, y: 485 }
  const feet = (x: number, y: number) => ({ left: x - 9, right: x + 9, top: y + 6, bottom: y + 20 })
  it('requires feet to touch the threshold and keeps the interior spawn outside it', () => {
    expect(touchesDoor(feet(480, 435), door, 90, 24)).toBe(false)
    expect(touchesDoor(feet(480, 455), door, 90, 24)).toBe(true)
    expect(touchesDoor(feet(540, 455), door, 90, 24)).toBe(false)
  })
  it('returns safely outside either entrance orientation without immediately entering again', () => {
    for (const key of ['benfica.house.01.entry', 'benfica.gym.entry', 'benfica.recovery.entry', 'benfica.university.entry', 'benfica.stadium.entry']) {
      const point = outsideDoor(key, door)
      expect(touchesDoor(feet(point.x, point.y), door)).toBe(false)
    }
    // The new-game spawn in front of the university must not trigger a return to the ceremony.
    expect(touchesDoor(feet(464, 400), { x: 464, y: 432 })).toBe(false)
  })
})
