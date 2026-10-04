import { describe, expect, it } from 'vitest'
import { isPhoneDevice, TouchInput } from './TouchInput'
import { movementVelocity, WALK_SPEED } from './movement'

describe('phone controls', () => {
  it('requires touch capability and a phone sized screen in either orientation', () => {
    expect(isPhoneDevice(true, 390, 844)).toBe(true)
    expect(isPhoneDevice(true, 844, 390)).toBe(true)
    expect(isPhoneDevice(false, 390, 844)).toBe(false)
    expect(isPhoneDevice(true, 1920, 1080)).toBe(false)
    expect(isPhoneDevice(true, 1024, 768)).toBe(false)
  })

  it('keeps independent fingers held and normalizes diagonal movement', () => {
    const input = new TouchInput()
    input.hold(1, { right: true })
    input.hold(2, { up: true })
    expect(Math.hypot(...Object.values(movementVelocity(input.directions)))).toBeCloseTo(WALK_SPEED)
    input.release(1)
    expect(movementVelocity(input.directions)).toEqual({ x: 0, y: -WALK_SPEED })
    input.hold(2, { left: true })
    expect(movementVelocity(input.directions)).toEqual({ x: -WALK_SPEED, y: 0 })
  })

  it('consumes actions once and clears held fingers and queued actions on interruption', () => {
    const input = new TouchInput()
    input.hold(7, { down: true })
    input.press('confirm')
    expect(input.consume('confirm')).toBe(true)
    expect(input.consume('confirm')).toBe(false)
    expect(input.directions.down).toBe(true)
    input.press('back')
    input.reset()
    expect(input.consume('back')).toBe(false)
    expect(movementVelocity(input.directions)).toEqual({ x: 0, y: 0 })
  })
})
