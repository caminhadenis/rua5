import { describe, expect, it } from 'vitest'
import { ApproachDialogue, canDetectChallenger, canInteract, INTERACTION_RADIUS } from './interactions'

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
  expect(dialogue.update({ x: 100, y: 0 }, npc, 'right')).toBe(false)
  expect(dialogue.update({ x: 60, y: 0 }, npc, 'right')).toBe(true)
  expect(dialogue.update({ x: 40, y: 0 }, npc, 'right')).toBe(false)
  expect(dialogue.update({ x: 65, y: 0 }, npc, 'right')).toBe(false)
  expect(dialogue.update({ x: 59, y: 0 }, npc, 'right')).toBe(false)
  expect(dialogue.update({ x: 81, y: 0 }, npc, 'right')).toBe(false)
  expect(dialogue.update({ x: 50, y: 0 }, npc, 'right')).toBe(true)
})

describe('challenger facing detection', () => {
  const npc = { x: 100, y: 100 }
  it.each([
    ['up', { x: 100, y: 50 }], ['down', { x: 100, y: 150 }],
    ['left', { x: 50, y: 100 }], ['right', { x: 150, y: 100 }],
  ] as const)('detects in front when facing %s', (facing, player) => {
    expect(canDetectChallenger(player, npc, facing)).toBe(true)
  })
  it.each([
    ['up', { x: 100, y: 150 }], ['down', { x: 100, y: 50 }],
    ['left', { x: 150, y: 100 }], ['right', { x: 50, y: 100 }],
    ['right', { x: 100, y: 130 }],
  ] as const)('ignores behind or beside when facing %s', (facing, player) => {
    expect(canDetectChallenger(player, npc, facing)).toBe(false)
  })
  it('does not re-trigger during a single approach', () => {
    const approach = new ApproachDialogue()
    expect(approach.update({ x: 150, y: 100 }, npc, 'right')).toBe(true)
    expect(approach.update({ x: 140, y: 100 }, npc, 'right')).toBe(false)
    expect(approach.update({ x: 19, y: 100 }, npc, 'right')).toBe(false)
    expect(approach.update({ x: 121, y: 100 }, npc, 'right')).toBe(true)
  })
})
