import type { FatigueStatus } from '../../api/gameApi'

const conditions = { RESTED: 'Disposto', TIRED: 'Cansado', VERY_TIRED: 'Muito cansado', EXHAUSTED: 'Exausto' }

/** Backend fatigue still grows; the battery displays the remaining energy instead. */
export function remainingEnergy(fatigue?: FatigueStatus): number {
  return 100 - Math.min(100, Math.max(0, fatigue?.value ?? 0))
}

export function energyIndicator(fatigue?: FatigueStatus, recovering = false): HTMLElement {
  const indicator = document.createElement('span')
  indicator.className = 'energy-indicator'
  // Only static markup; authoritative values are assigned as properties below.
  indicator.innerHTML = '<span class="energy-battery" role="img"><span class="energy-fill" aria-hidden="true"></span></span><span class="energy-recovery"></span>'
  updateEnergyIndicator(indicator, fatigue, recovering)
  return indicator
}

export function updateEnergyIndicator(indicator: HTMLElement, fatigue?: FatigueStatus, recovering = false): void {
  const condition = fatigue?.condition ?? 'RESTED'
  const label = recovering ? `Em recuperação · ${conditions[condition]}` : conditions[condition]
  const battery = indicator.querySelector<HTMLElement>('.energy-battery')!
  battery.dataset.condition = condition
  battery.style.setProperty('--energy-level', `${remainingEnergy(fatigue)}%`)
  battery.setAttribute('aria-label', `Energia: ${label}`)
  battery.title = label
  const recovery = indicator.querySelector<HTMLElement>('.energy-recovery')!
  recovery.textContent = recovering ? 'Em recuperação' : ''
  recovery.hidden = !recovering
}

export function fatigueRecoveryText(fatigue?: FatigueStatus, now = Date.now()): string {
  if (!fatigue?.fullyRecoveredAt) return 'Recupera energia com o descanso, inclusive fora do jogo.'
  const target = fatigue.nextConditionAt ?? fatigue.fullyRecoveredAt
  const seconds = Math.max(0, Math.ceil((Date.parse(target) - now) / 1000))
  if (!seconds) return 'Recuperando… atualizando condição.'
  const time = `${Math.floor(seconds / 60)}min${String(seconds % 60).padStart(2, '0')}s`
  return `${fatigue.nextConditionAt ? 'Melhora de condição' : 'Descanso completo'} em ${time}.`
}
