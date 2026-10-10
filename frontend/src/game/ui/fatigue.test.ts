import { describe, expect, it } from 'vitest'
import { fatigueReceiptText, fatigueRecoveryText, fatigueText } from './fatigue'
import type { FatigueStatus } from '../../api/gameApi'

const fatigue: FatigueStatus = {
  value: 68, condition: 'VERY_TIRED', penaltyPercent: 10,
  nextConditionAt: '2026-10-05T12:02:00Z', fullyRecoveredAt: '2026-10-05T12:17:00Z',
}

describe('fatigue presentation', () => {
  it('explains the authoritative condition and temporary attribute penalty', () => {
    expect(fatigueText(fatigue)).toBe('Muito cansado · 68/100 · atributos −10%')
    expect(fatigueRecoveryText(fatigue, Date.parse('2026-10-05T12:00:00Z'))).toBe('Melhora de condição em 2min00s.')
  })
  it('handles historical receipts and elapsed recovery times', () => {
    expect(fatigueText()).toBe('Disposto · desempenho normal')
    expect(fatigueText({ ...fatigue, value: 29.999, condition: 'RESTED', penaltyPercent: 0 })).toContain('29/100 · desempenho normal')
    expect(fatigueRecoveryText(fatigue, Date.parse('2026-10-05T13:00:00Z'))).toContain('atualizando condição')
    expect(fatigueReceiptText({ before: fatigue, after: fatigue, gained: 18, policyVersion: '1' })).toContain('Desgaste +18')
  })
})
