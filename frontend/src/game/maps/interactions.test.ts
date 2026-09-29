import { describe, expect, it } from 'vitest'
import { ApproachDialogue, canInteract, INTERACTION_RADIUS } from './interactions'

describe('interaction proximity', () => {
  it('allows interaction at the radius boundary', () => {
    expect(canInteract({ x: 10, y: 20 }, { x: 10 + INTERACTION_RADIUS, y: 20 })).toBe(true)
    expect(canInteract({ x: 10, y: 20 }, { x: 11 + INTERACTION_RADIUS, y: 20 })).toBe(false)
  })

  it('uses circular distance instead of allowing distant diagonal interactions', () => {
    expect(canInteract({ x: 0, y: 0 }, { x: 50, y: 50 })).toBe(false)
    expect(canInteract({ x: 0, y: 0 }, { x: 30, y: 40 })).toBe(true)
  })
})

it('greets once on approach and rearms only after leaving the area', () => {
  const dialogue = new ApproachDialogue()
  const npc = { x: 0, y: 0 }
  expect(dialogue.update({ x: 100, y: 0 }, npc)).toBe(false)
  expect(dialogue.update({ x: 60, y: 0 }, npc)).toBe(true)
  expect(dialogue.update({ x: 40, y: 0 }, npc)).toBe(false)
  expect(dialogue.update({ x: 65, y: 0 }, npc)).toBe(false)
  expect(dialogue.update({ x: 59, y: 0 }, npc)).toBe(false)
  expect(dialogue.update({ x: 81, y: 0 }, npc)).toBe(false)
  expect(dialogue.update({ x: 50, y: 0 }, npc)).toBe(true)
})
