import { ownedPlayerUniformUrl } from '../team/teamColors'
import { teamApi, type RosterPlayer } from '../../api/gameApi'
import { fatigueText, fatigueRecoveryText, compactFatigueText } from './fatigue'

/** Native radios provide one selection and keyboard navigation; the cards are presentation only. */
export class PlayerCards {
  readonly element = document.createElement('fieldset')
  private readonly choices: HTMLInputElement[] = []

  constructor(private readonly roster: RosterPlayer[], private readonly allowRecovering = false) {
    this.element.className = 'player-cards'
    const legend = document.createElement('legend')
    legend.textContent = 'Seu elenco'
    this.element.append(legend)
    const grid = document.createElement('div')
    grid.className = 'player-card-grid'
    this.element.append(grid)
    for (const [index, player] of roster.entries()) {
      const label = document.createElement('label')
      label.className = 'player-card'
      const input = document.createElement('input')
      input.type = 'radio'
      input.name = 'duel-player'
      input.value = player.id
      input.checked = index === roster.findIndex(item => allowRecovering || !item.recovery)
      input.disabled = !allowRecovering && Boolean(player.recovery)
      input.setAttribute('aria-label', `${player.name}, nível ${player.level}`)
      this.choices.push(input)
      const face = document.createElement('span')
      face.className = 'player-card-face'
      // Static framing; all player content from the API is inserted with textContent.
      face.innerHTML = '<span class="player-card-marker" aria-hidden="true">◆ SELECIONADO</span><span class="player-card-portrait" aria-hidden="true"><span class="player-card-sprite"></span></span>'
      const sprite = face.querySelector<HTMLElement>('.player-card-sprite')!
      const asset = player.playerDefinitionId?.startsWith('npc_') ? 'challenger' : 'player'
      sprite.dataset.asset = asset
      sprite.style.backgroundImage = `url("${ownedPlayerUniformUrl(player.playerDefinitionId)}")`
      const name = document.createElement('strong')
      name.textContent = player.name
      const level = document.createElement('span')
      level.className = 'player-card-level'
      level.textContent = `Nível ${player.level}`
      const xp = document.createElement('span')
      xp.className = 'player-card-xp'
      xp.textContent = player.xpToNextLevel === null ? 'Nível máximo' : `${player.xp} / ${player.xpToNextLevel} XP`
      const fatigue = document.createElement('span')
      fatigue.className = 'player-card-fatigue'
      fatigue.dataset.playerId = player.id
      fatigue.innerHTML = '<span class="fatigue-full"></span><span class="fatigue-compact"></span>'
      fatigue.querySelector('.fatigue-full')!.textContent = player.recovery ? 'Em recuperação · indisponível' : fatigueText(player.fatigue)
      fatigue.querySelector('.fatigue-compact')!.textContent = player.recovery ? 'Em recuperação' : compactFatigueText(player.fatigue)
      fatigue.title = fatigueRecoveryText(player.fatigue)
      face.append(name, level, xp, fatigue)
      label.append(input, face)
      grid.append(label)
    }
    const recovery = document.createElement('p')
    recovery.className = 'fatigue-recovery'
    const showRecovery = () => { recovery.textContent = fatigueRecoveryText(this.roster.find(player => player.id === this.selectedId)?.fatigue) }
    this.element.append(recovery)
    this.element.addEventListener('change', showRecovery)
    this.element.addEventListener('fatigue-updated', showRecovery)
    showRecovery()
    // Refresh authoritative recovery while a selection remains open. Detached cards stop polling.
    const refresh = async () => {
      if (!this.element.isConnected) return
      try {
        const updated = await teamApi.roster()
        if (!this.element.isConnected) return
        this.updateFatigue(updated)
      } catch { /* Retain the last server snapshot; commands still validate on the server. */ }
      if (this.element.isConnected) window.setTimeout(() => { void refresh() }, 15_000)
    }
    window.setTimeout(() => { void refresh() }, 15_000)
    if (!allowRecovering && roster.length && roster.every(player => player.recovery)) {
      const unavailable = document.createElement('p')
      unavailable.textContent = 'Todos os atletas estão no Centro de Recuperação. Aguarde o tratamento ou interrompa-o no centro.'
      this.element.append(unavailable)
    }
    if (!roster.length) {
      const empty = document.createElement('p')
      empty.textContent = 'Seu elenco está vazio. Convide um atleta dispensado na Equipe para voltar a jogar.'
      this.element.append(empty)
    }
  }

  updateFatigue(updated: RosterPlayer[]): void {
    for (const player of this.roster) {
      const current = updated.find(item => item.id === player.id)
      if (!current) continue
      player.fatigue = current.fatigue
      player.matchStats = current.matchStats
      player.recovery = current.recovery
      const choice = this.choices.find(item => item.value === player.id)
      if (choice) choice.disabled = !this.allowRecovering && Boolean(player.recovery)
      const badge = [...this.element.querySelectorAll<HTMLElement>('.player-card-fatigue')].find(item => item.dataset.playerId === player.id)
      if (badge) {
        badge.querySelector('.fatigue-full')!.textContent = player.recovery ? 'Em recuperação · indisponível' : fatigueText(player.fatigue)
        badge.querySelector('.fatigue-compact')!.textContent = player.recovery ? 'Em recuperação' : compactFatigueText(player.fatigue)
        badge.title = fatigueRecoveryText(player.fatigue)
      }
    }
    if (!this.selectedId) {
      const available = this.choices.find(choice => !choice.disabled)
      if (available) { available.checked = true; this.element.dispatchEvent(new Event('change')) }
    }
    this.element.dispatchEvent(new Event('fatigue-updated'))
  }

  get selectedId(): string | undefined { return this.choices.find(choice => choice.checked && !choice.disabled)?.value }
  set disabled(value: boolean) { this.element.disabled = value }
}
