import { describe, expect, it } from 'vitest'
import { fatigueRecoveryText, remainingEnergy } from './fatigue'
import type { FatigueStatus } from '../../api/gameApi'

const fatigue: FatigueStatus = {
  value: 68, condition: 'VERY_TIRED', penaltyPercent: 10,
  nextConditionAt: '2026-10-05T12:02:00Z', fullyRecoveredAt: '2026-10-05T12:17:00Z',
}

describe('fatigue presentation', () => {
  it('empties the battery with fatigue and refills it with recovery', () => {
    expect(remainingEnergy({ ...fatigue, value: 0 })).toBe(100)
    expect(remainingEnergy({ ...fatigue, value: 30 })).toBe(70)
    expect(remainingEnergy(fatigue)).toBe(32)
    expect(remainingEnergy({ ...fatigue, value: 100 })).toBe(0)
    expect(remainingEnergy({ ...fatigue, value: 10 })).toBeGreaterThan(remainingEnergy(fatigue))
    expect(fatigueRecoveryText(fatigue, Date.parse('2026-10-05T12:00:00Z'))).toBe('Melhora de condição em 2min00s.')
  })
  it('handles missing historical fatigue and bounds the battery', () => {
    expect(remainingEnergy()).toBe(100)
    expect(remainingEnergy({ ...fatigue, value: -1 })).toBe(100)
    expect(remainingEnergy({ ...fatigue, value: 101 })).toBe(0)
    expect(fatigueRecoveryText(fatigue, Date.parse('2026-10-05T13:00:00Z'))).toContain('atualizando condição')
  })
})
