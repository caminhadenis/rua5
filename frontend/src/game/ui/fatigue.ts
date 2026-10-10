import type { FatigueChange, FatigueStatus } from '../../api/gameApi'

const conditions = { RESTED: 'Disposto', TIRED: 'Cansado', VERY_TIRED: 'Muito cansado', EXHAUSTED: 'Exausto' }

export function fatigueText(fatigue?: FatigueStatus): string {
  if (!fatigue) return 'Disposto · desempenho normal'
  const performance = fatigue.penaltyPercent ? `atributos −${fatigue.penaltyPercent}%` : 'desempenho normal'
  return `${conditions[fatigue.condition]} · ${Math.floor(fatigue.value)}/100 · ${performance}`
}

export function compactFatigueText(fatigue?: FatigueStatus): string {
  return `${conditions[fatigue?.condition ?? 'RESTED']}${fatigue?.penaltyPercent ? ` −${fatigue.penaltyPercent}%` : ''}`
}

export function fatigueRecoveryText(fatigue?: FatigueStatus, now = Date.now()): string {
  if (!fatigue?.fullyRecoveredAt) return 'Recupera 4 pontos por minuto, inclusive fora do jogo.'
  const target = fatigue.nextConditionAt ?? fatigue.fullyRecoveredAt
  const seconds = Math.max(0, Math.ceil((Date.parse(target) - now) / 1000))
  if (!seconds) return 'Recuperando… atualizando condição.'
  const time = `${Math.floor(seconds / 60)}min${String(seconds % 60).padStart(2, '0')}s`
  return `${fatigue.nextConditionAt ? 'Melhora de condição' : 'Descanso completo'} em ${time}.`
}

export function fatigueReceiptText(change: FatigueChange): string {
  return `Desgaste +${change.gained} · ${fatigueText(change.after)}`
}
