import Phaser from 'phaser'
import { gameAudio } from '../audio/GameAudio'
import { ApiError, stadiumApi, teamApi, type RosterPlayer, type ReleasedPlayer, type DismissalLocation } from '../../api/gameApi'
import { createIdempotencyKey } from '../../api/idempotencyKey'
import type { WorldScene } from './WorldScene'
import { CHALLENGERS } from '../maps/interactions'
import { PlayerCards } from '../ui/PlayerCards'
import { fatigueText, fatigueRecoveryText } from '../ui/fatigue'
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
  private released: ReleasedPlayer[] = []
  private returnScene = 'WorldScene'
  private location!: DismissalLocation
  constructor() { super('TeamScene') }

  init(data: { returnScene?: string } = {}): void {
    this.returnScene = data.returnScene ?? 'WorldScene'
    const world = this.scene.get('WorldScene') as WorldScene
    this.location = { mapId: 'benfica', x: Math.max(16, Math.min(2288, world.player.x)), y: Math.max(16, Math.min(2672, world.player.y)) }
  }

  create(): void {
    gameAudio.setMusic('city')
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
      const [roster, released] = await Promise.all([teamApi.roster(), teamApi.released()])
      if (!this.scene.isActive()) return
      this.roster = roster
      this.released = released
      this.scene.get('WorldScene').events.emit('released-updated', released)
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
    this.scene.wake(this.returnScene)
    this.scene.stop()
  }

  private render(): void {
    this.panel.replaceChildren()
    const title = document.createElement('h2')
    title.textContent = 'Seu time'
    this.panel.append(title)
    paragraph(this.panel, `Elenco: ${this.roster.length}/5 jogadores. Para contratar com o time cheio, dispense um atleta.`).className = 'roster-capacity'
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
    let managingDismissal = false
    const renderDetails = () => {
      if (managingDismissal) return
      const player = this.roster.find(p => p.id === cards.selectedId)
      details.replaceChildren()
      if (!player) return
      paragraph(details, `${player.name} · ${archetypes[player.archetype]} · ${roles[player.preferredRole]}`)
      if (player.recovery) paragraph(details, `Em recuperação no centro · disponível às ${new Date(player.recovery.completesAt).toLocaleTimeString('pt-BR')}.`).className = 'recovery-status'
      paragraph(details, fatigueText(player.fatigue)).className = 'fatigue-status'
      paragraph(details, fatigueRecoveryText(player.fatigue)).className = 'fatigue-recovery'
      const list = document.createElement('dl')
      for (const [key, label] of Object.entries(stats)) {
        const term = document.createElement('dt')
        term.textContent = label
        const value = document.createElement('dd')
        const stat = key as keyof RosterPlayer['stats']
        value.textContent = player.stats[stat].toLocaleString('pt-BR')
        if (player.fatigue?.penaltyPercent && player.matchStats) value.textContent += ` → ${player.matchStats[stat].toLocaleString('pt-BR', { maximumFractionDigits: 2 })} em partida`
        list.append(term, value)
      }
      details.append(list)
      const dismiss = button(details, `Dispensar ${player.name}`, () => {
        dismiss.disabled = true
        managingDismissal = true
        cards.disabled = true
        back.disabled = true
        const invites = [...this.panel.querySelectorAll<HTMLButtonElement>('.recruitment-panel button')].filter(button => !button.disabled)
        invites.forEach(button => { button.disabled = true })
        const confirmation = document.createElement('div')
        details.append(confirmation)
        paragraph(confirmation, `Dispensar ${player.name}? Ele ficará como desafiante neste ponto do bairro e poderá ser convidado novamente. Nível, XP e treinos serão preservados.`)
        const status = paragraph(confirmation, '')
        status.setAttribute('role', 'status')
        const key = createIdempotencyKey()
        let committed = false
        const cancel = button(confirmation, 'Cancelar dispensa', () => { managingDismissal = false; confirmation.remove(); dismiss.disabled = false; cards.disabled = false; back.disabled = false; invites.forEach(button => { button.disabled = false }) })
        const confirm = button(confirmation, 'Confirmar dispensa', () => {
          cards.disabled = true
          confirm.disabled = true
          cancel.disabled = true
          back.disabled = true
          status.textContent = committed ? 'Atualizando equipe…' : 'Dispensando jogador…'
          void (async () => {
            if (!committed) { await teamApi.dismiss(player.id, this.location, key); committed = true }
            const [roster, released] = await Promise.all([teamApi.roster(), teamApi.released()])
            if (!this.scene.isActive()) return
            this.roster = roster
            this.released = released
            const world = this.scene.get('WorldScene')
            world.events.emit('released-updated', released)
            world.events.emit('roster-updated', roster)
            gameAudio.play('confirm')
            this.render()
            paragraph(this.panel, `${player.name} foi dispensado e agora é um desafiante neste ponto do bairro.`).setAttribute('role', 'status')
          })().catch((error: unknown) => {
            if (!this.scene.isActive() || !status.isConnected) return
            status.textContent = committed ? 'A dispensa foi confirmada. Tente atualizar a equipe.'
              : error instanceof ApiError && error.rejected ? 'Não foi possível dispensar este atleta. Atualize a equipe.'
              : 'Não foi possível confirmar a dispensa. Repetir é seguro.'
            confirm.textContent = committed ? 'Atualizar equipe' : 'Tentar dispensa novamente'
            confirm.disabled = false
            if (!committed && error instanceof ApiError && error.rejected) {
              confirm.remove()
              button(confirmation, 'Atualizar equipe', () => { void this.loadTeam() })
              cards.disabled = false
              back.disabled = false
            }
          })
        })
      })
      dismiss.disabled = Boolean(player.recovery)
    }
    const renderCards = () => {
      rosterPanel.replaceChildren()
      cards = new PlayerCards(this.roster, true)
      rosterPanel.append(cards.element)
      cards.element.addEventListener('change', renderDetails)
      cards.element.addEventListener('fatigue-updated', renderDetails)
      renderDetails()
    }
    const actions = document.createElement('div')
    actions.className = 'selection-actions'
    this.panel.append(actions)
    const back = button(actions, this.returnScene === 'WorldScene' ? 'Voltar ao bairro' : 'Voltar ao interior', () => this.back())
    renderCards()
    const invitations = new Map([...CHALLENGERS, ...this.released].map(challenger => [challenger.id, challenger]))
    for (const challenger of invitations.values()) recruitmentPanel(this.panel, challenger.id, async () => {
      await this.loadTeam()
    })
  }
}
