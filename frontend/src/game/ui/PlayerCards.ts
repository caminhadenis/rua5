import { ownedPlayerUniformUrl } from '../team/teamColors'
import type { RosterPlayer } from '../../api/gameApi'

/** Native radios provide one selection and keyboard navigation; the cards are presentation only. */
export class PlayerCards {
  readonly element = document.createElement('fieldset')
  private readonly choices: HTMLInputElement[] = []

  constructor(roster: RosterPlayer[]) {
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
      input.checked = index === 0
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
      face.append(name, level, xp)
      label.append(input, face)
      grid.append(label)
    }
    if (!roster.length) {
      const empty = document.createElement('p')
      empty.textContent = 'Seu elenco está vazio. Escolha um starter para entrar em quadra.'
      this.element.append(empty)
    }
  }

  get selectedId(): string | undefined { return this.choices.find(choice => choice.checked)?.value }
  set disabled(value: boolean) { this.element.disabled = value }
}
