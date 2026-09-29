import { describe, expect, it } from 'vitest'
import { movementVelocity, WALK_SPEED } from './movement'

const idle = { left: false, right: false, up: false, down: false }

describe('exploration movement', () => {
  it('stops without input and cancels opposing directions', () => {
    expect(movementVelocity(idle)).toEqual({ x: 0, y: 0 })
    expect(movementVelocity({ left: true, right: true, up: true, down: true })).toEqual({ x: 0, y: 0 })
  })

  it('keeps diagonal speed equal to straight movement', () => {
    expect(movementVelocity({ ...idle, right: true })).toEqual({ x: WALK_SPEED, y: 0 })
    const diagonal = movementVelocity({ ...idle, right: true, up: true })
    expect(diagonal.x).toBeGreaterThan(0)
    expect(diagonal.y).toBeLessThan(0)
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(WALK_SPEED)
  })

  it('blocks movement while talking', () => {
    expect(movementVelocity({ ...idle, left: true, down: true }, true)).toEqual({ x: 0, y: 0 })
  })
})
