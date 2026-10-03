import { describe, expect, it } from 'vitest'
import { ApproachDialogue, canDetectChallenger, canInteract, CHALLENGER_DETECTION_RADIUS, INTERACTION_RADIUS } from './interactions'

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
  expect(dialogue.update({ x: CHALLENGER_DETECTION_RADIUS + 25, y: 0 }, npc)).toBe(false)
  expect(dialogue.update({ x: CHALLENGER_DETECTION_RADIUS, y: 0 }, npc)).toBe(true)
  expect(dialogue.update({ x: 40, y: 0 }, npc)).toBe(false)
  expect(dialogue.update({ x: CHALLENGER_DETECTION_RADIUS + 9, y: 0 }, npc)).toBe(false)
  expect(dialogue.update({ x: CHALLENGER_DETECTION_RADIUS + 21, y: 0 }, npc)).toBe(false)
  expect(dialogue.update({ x: CHALLENGER_DETECTION_RADIUS - 26, y: 0 }, npc)).toBe(true)
})

describe('challenger proximity detection', () => {
  const npc = { x: 100, y: 100 }
  it.each([
    { x: 100, y: 100 - CHALLENGER_DETECTION_RADIUS },
    { x: 100, y: 100 + CHALLENGER_DETECTION_RADIUS },
    { x: 100 - CHALLENGER_DETECTION_RADIUS, y: 100 },
    { x: 100 + CHALLENGER_DETECTION_RADIUS, y: 100 },
  ])('detects a player at the radius boundary at %o', player => {
    expect(canDetectChallenger(player, npc)).toBe(true)
  })
  it('uses a circular boundary beyond the manual interaction range', () => {
    expect(CHALLENGER_DETECTION_RADIUS).toBeGreaterThan(INTERACTION_RADIUS)
    expect(canDetectChallenger({ x: 101 + CHALLENGER_DETECTION_RADIUS, y: 100 }, npc)).toBe(false)
    expect(canDetectChallenger({ x: 350, y: 350 }, npc)).toBe(false)
  })
  it('does not re-trigger during a single approach', () => {
    const approach = new ApproachDialogue()
    expect(approach.update({ x: 100 + CHALLENGER_DETECTION_RADIUS, y: 100 }, npc)).toBe(true)
    expect(approach.update({ x: 140, y: 100 }, npc)).toBe(false)
    expect(approach.update({ x: 100 + CHALLENGER_DETECTION_RADIUS + 21, y: 100 }, npc)).toBe(false)
    expect(approach.update({ x: 100 + CHALLENGER_DETECTION_RADIUS - 1, y: 100 }, npc)).toBe(true)
  })
})
