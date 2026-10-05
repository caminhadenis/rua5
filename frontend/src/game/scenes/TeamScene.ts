import Phaser from 'phaser'
import { stadiumApi, teamApi, type RosterPlayer } from '../../api/gameApi'
import { CHALLENGERS } from '../maps/interactions'
import { PlayerCards } from '../ui/PlayerCards'
import { recruitmentPanel } from '../ui/RecruitmentPanel'
import { button, paragraph, scenePanel } from '../ui/ScenePanel'

const archetypes = { DRIBBLER: 'Driblador', FINISHER: 'Finalizador', PLAYMAKER: 'Armador', MARKER: 'Marcador' }
const roles = { DEFENDER: 'Defesa', MIDFIELDER: 'Meio-campo', ATTACKER: 'Ataque' }
const stats: Record<keyof RosterPlayer['stats'], string> = {
  speed: 'Velocidade', dribbling: 'Drible', finishing: 'Finalização', defending: 'Defesa', physical: 'Físico',
}

export class TeamScene extends Phaser.Scene {
  private panel!: HTMLElement
  private roster: RosterPlayer[] = []
  constructor() { super('TeamScene') }

  create(): void {
    this.panel = scenePanel(this, 'Equipe')
    this.panel.classList.add('team-panel', 'player-selection-panel')
    const keyboard = this.input.keyboard!
    const captured = keyboard.manager.preventDefault
    keyboard.disableGlobalCapture()
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { keyboard.manager.preventDefault = captured })
    void this.loadTeam()
  }

  private async loadTeam(): Promise<void> {
    this.panel.replaceChildren()
    paragraph(this.panel, 'Carregando equipe…')
    try {
      const roster = await teamApi.roster()
      if (!this.scene.isActive()) return
      this.roster = roster
      this.scene.get('WorldScene').events.emit('roster-updated', roster)
      this.render()
    } catch {
      if (!this.scene.isActive()) return
      this.panel.replaceChildren()
      paragraph(this.panel, 'Não foi possível carregar a equipe.')
      button(this.panel, 'Tentar novamente', () => { void this.loadTeam() })
      button(this.panel, 'Voltar ao bairro', () => this.back())
    }
  }

  private back(): void {
    this.scene.wake('WorldScene')
    this.scene.stop()
  }

  private render(): void {
    this.panel.replaceChildren()
    const title = document.createElement('h2')
    title.textContent = 'Seu time'
    this.panel.append(title)
    const achievements = document.createElement('section')
    achievements.className = 'team-achievements'
    achievements.setAttribute('aria-label', 'Conquistas')
    const achievementsTitle = document.createElement('h3')
    achievementsTitle.textContent = 'Conquistas'
    achievements.append(achievementsTitle)
    paragraph(achievements, 'Carregando troféus…')
    this.panel.append(achievements)
    void stadiumApi.list().then(stadiums => {
      if (!this.scene.isActive() || !achievements.isConnected) return
      achievements.replaceChildren(achievementsTitle)
      const completed = stadiums.filter(stadium => stadium.status === 'COMPLETED')
      if (!completed.length) paragraph(achievements, 'Nenhum troféu ainda. Vença um estádio para conquistar o primeiro.')
      for (const stadium of completed) {
        const trophy = document.createElement('div')
        trophy.className = 'achievement-trophy'
        trophy.innerHTML = '<span aria-hidden="true">🏆</span><div><strong></strong><small></small></div>'
        trophy.querySelector('strong')!.textContent = stadium.trophy.name
        trophy.querySelector('small')!.textContent = stadium.trophy.description
        achievements.append(trophy)
      }
    }).catch(() => {
      if (this.scene.isActive() && achievements.isConnected) {
        achievements.querySelector('p')!.textContent = 'Não foi possível carregar as conquistas. Abra Equipe novamente para tentar.'
      }
    })
    paragraph(this.panel, 'Selecione um jogador para consultar seus atributos. Escolha quem vai jogar antes de cada duelo 1x1.').className = 'selection-description'
    const rosterPanel = document.createElement('div')
    this.panel.append(rosterPanel)
    let cards: PlayerCards
    const details = document.createElement('div')
    this.panel.append(details)
    details.className = 'player-details'
    const renderDetails = () => {
      const player = this.roster.find(p => p.id === cards.selectedId)
      details.replaceChildren()
      if (!player) return
      paragraph(details, `${player.name} · ${archetypes[player.archetype]} · ${roles[player.preferredRole]}`)
      const list = document.createElement('dl')
      for (const [key, label] of Object.entries(stats)) {
        const term = document.createElement('dt')
        term.textContent = label
        const value = document.createElement('dd')
        value.textContent = player.stats[key as keyof RosterPlayer['stats']].toLocaleString('pt-BR')
        list.append(term, value)
      }
      details.append(list)
    }
    const renderCards = () => {
      rosterPanel.replaceChildren()
      cards = new PlayerCards(this.roster)
      rosterPanel.append(cards.element)
      cards.element.addEventListener('change', renderDetails)
      renderDetails()
    }
    renderCards()
    const actions = document.createElement('div')
    actions.className = 'selection-actions'
    this.panel.append(actions)
    button(actions, 'Voltar ao bairro', () => this.back())
    for (const challenger of CHALLENGERS) recruitmentPanel(this.panel, challenger.id, async () => {
      const roster = await teamApi.roster()
      if (!this.scene.isActive()) return
      this.roster = roster
      this.scene.get('WorldScene').events.emit('roster-updated', roster)
      renderCards()
    })
  }
}
