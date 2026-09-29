import Phaser from 'phaser'
import { ApiError, stadiumApi, teamApi, type RosterPlayer } from '../../api/gameApi'
import { CHALLENGERS } from '../maps/interactions'
import { assignSlot } from '../team/lineupSelection'
import { PlayerCards } from '../ui/PlayerCards'
import { recruitmentPanel } from '../ui/RecruitmentPanel'
import { button, paragraph, scenePanel } from '../ui/ScenePanel'

const archetypes = { DRIBBLER: 'Driblador', FINISHER: 'Finalizador', PLAYMAKER: 'Armador', MARKER: 'Marcador' }
const roles = { DEFENDER: 'Defesa', MIDFIELDER: 'Meio-campo', ATTACKER: 'Ataque' }
const stats: Record<keyof RosterPlayer['stats'], string> = {
  speed: 'Velocidade', dribbling: 'Drible', passing: 'Passe', finishing: 'Finalização', defending: 'Defesa', physical: 'Físico',
}

export class TeamScene extends Phaser.Scene {
  private panel!: HTMLElement
  private roster: RosterPlayer[] = []
  private slots: (string | null)[] = []
  private saved: (string | null)[] = []
  private busy = false
  private pendingSave?: (string | null)[]
  constructor() { super('TeamScene') }

  create(): void {
    this.busy = false
    this.pendingSave = undefined
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
      const [roster, lineup] = await Promise.all([teamApi.roster(), teamApi.lineup()])
      if (!this.scene.isActive()) return
      this.roster = roster
      this.scene.get('WorldScene').events.emit('roster-updated', roster)
      this.slots = [...lineup.ownedPlayerIds]
      this.saved = [...lineup.ownedPlayerIds]
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
    if (this.busy || this.pendingSave) return
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
    paragraph(this.panel, 'Escolha um jogador do elenco e clique no slot em que ele vai jogar.').className = 'selection-description'
    const lineup = document.createElement('div')
    lineup.className = 'lineup-slots'
    lineup.setAttribute('aria-label', 'Escalação com cinco slots')
    this.panel.append(lineup)
    const state = paragraph(this.panel, '')
    state.setAttribute('role', 'status')
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
        value.textContent = String(player.stats[key as keyof RosterPlayer['stats']])
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
    const back = button(actions, 'Voltar ao bairro', () => this.back())
    const save = button(actions, 'Salvar escalação', () => { void persist() })
    const dirty = () => this.slots.some((id, index) => id !== this.saved[index])
    const update = () => {
      const frozen = this.busy || this.pendingSave !== undefined
      lineup.replaceChildren()
      this.slots.forEach((id, index) => {
        const slot = document.createElement('div')
        slot.className = 'lineup-slot'
        slot.dataset.testid = `lineup-slot-${index + 1}`
        const player = this.roster.find(p => p.id === id)
        const choose = button(slot, `Slot ${index + 1} · ${player?.name ?? 'Vazio'}`, () => {
          if (!cards.selectedId || frozen) return
          this.slots = assignSlot(this.slots, index, cards.selectedId)
          update()
        })
        choose.disabled = frozen || !this.roster.length
        if (player) {
          const remove = button(slot, `Retirar ${player.name} do slot ${index + 1}`, () => {
            this.slots = assignSlot(this.slots, index, null)
            update()
          })
          remove.className = 'remove-player'
          remove.disabled = frozen
        }
        lineup.append(slot)
      })
      const count = this.slots.filter(Boolean).length
      state.textContent = `${count} / 5 escalados · ${dirty() ? 'Alterações ainda não salvas' : 'Escalação salva'}`
      save.disabled = this.busy || !dirty()
      back.disabled = frozen
      back.textContent = dirty() ? 'Voltar sem salvar' : 'Voltar ao bairro'
      cards.disabled = frozen
    }
    const persist = async () => {
      if (this.busy) return
      this.busy = true
      this.pendingSave ??= [...this.slots]
      update()
      state.textContent = 'Salvando escalação…'
      try {
        const result = await teamApi.saveLineup(this.pendingSave)
        if (!this.scene.isActive()) return
        this.slots = [...result.ownedPlayerIds]
        this.saved = [...result.ownedPlayerIds]
        this.busy = false
        this.pendingSave = undefined
        save.textContent = 'Salvar escalação'
        update()
      } catch (error) {
        if (!this.scene.isActive()) return
        this.busy = false
        if (error instanceof ApiError && error.rejected) {
          this.pendingSave = undefined
          update()
          state.textContent = 'A escalação foi recusada. Confira seu elenco e tente novamente.'
        } else {
          // Keep the exact selection frozen until this idempotent PUT is recovered.
          state.textContent = 'Não foi possível confirmar a escalação. Tente salvar novamente.'
          save.disabled = false
          save.textContent = 'Tentar salvar novamente'
        }
      }
    }
    update()
    for (const challenger of CHALLENGERS) recruitmentPanel(this.panel, challenger.id, async () => {
      const roster = await teamApi.roster()
      if (!this.scene.isActive()) return
      this.roster = roster
      this.scene.get('WorldScene').events.emit('roster-updated', roster)
      renderCards()
      update()
    })
  }
}
