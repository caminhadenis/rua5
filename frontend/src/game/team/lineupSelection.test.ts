import { describe, expect, it } from 'vitest'
import { assignSlot } from './lineupSelection'

describe('lineup editing', () => {
  it('assigns a reserve without mutating the saved lineup', () => {
    const saved = ['a', null, 'b', null, null]
    expect(assignSlot(saved, 3, 'c')).toEqual(['a', null, 'b', 'c', null])
    expect(saved).toEqual(['a', null, 'b', null, null])
  })
  it('moves an assigned player and returns the replaced player to reserves', () => {
    expect(assignSlot(['a', 'b', 'c', 'd', 'e'], 2, 'a')).toEqual([null, 'b', 'a', 'd', 'e'])
  })
  it('clears only the requested slot and rejects invalid slots', () => {
    expect(assignSlot(['a', 'b', null, null, null], 1, null)).toEqual(['a', null, null, null, null])
    expect(() => assignSlot([null], 0, 'a')).toThrow()
    expect(() => assignSlot(Array(5).fill(null), 5, 'a')).toThrow()
  })
})
