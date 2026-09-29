import Phaser from 'phaser'
import { gameAudio } from '../audio/GameAudio'
import { ApiError, StadiumCommand, stadiumApi, teamApi, type MatchEvent, type Participant, type StadiumResponse } from '../../api/gameApi'
import { Playback, presentEvent } from '../match/Playback'
import { onGoalArrival } from '../match/goalArrival'
import { actingPosition, coachGreeting, coachVerdict, pitchPosition } from '../match/stadiumPresentation'
import { originalUniformUrls, uniformUrl } from '../team/teamColors'
import { button, paragraph, scenePanel } from '../ui/ScenePanel'

export class StadiumScene extends Phaser.Scene {
  private readonly command = new StadiumCommand()
  private id = ''
  private panel!: ReturnType<typeof scenePanel>
  private playback?: Playback
  private result?: StadiumResponse
  private score?: HTMLElement
  private event?: HTMLElement
  private clock?: HTMLElement
  private progress?: HTMLProgressElement
  private pitch?: HTMLElement
  private pendingGoal?: () => void
  constructor() { super('StadiumScene') }
  init(data: { id: string }): void {
    this.pendingGoal?.()
    this.pendingGoal = undefined
    this.id = data.id; this.playback = undefined; this.result = undefined
  }
  create(): void {
    this.panel = scenePanel(this, 'Estádio')
    this.panel.classList.add('stadium-panel')
    void this.loadStadium()
  }
  private leave(): void {
    this.scene.wake('WorldScene')
    void teamApi.roster().then(roster => this.scene.get('WorldScene').events.emit('roster-updated', roster)).catch(() => {})
    this.scene.stop()
  }
  private async loadStadium(): Promise<void> {
    this.panel.replaceChildren()
    paragraph(this.panel, 'Carregando estádio…')
    try {
      const info = await stadiumApi.get(this.id)
      if (!this.scene.isActive()) return
      this.panel.replaceChildren()
      const title = document.createElement('h2')
      title.textContent = info.name
      this.panel.append(title)
      const dialogue = document.createElement('div')
      dialogue.className = 'coach-dialogue'
      dialogue.innerHTML = '<span class="coach-portrait" aria-hidden="true"></span><div class="coach-lines"><strong>Professor Dimas · treinador</strong></div>'
      dialogue.querySelector<HTMLElement>('.coach-portrait')!.style.backgroundImage = `url("${import.meta.env.BASE_URL}assets/placeholders/resident-elder.svg")`
      const lines = dialogue.querySelector<HTMLElement>('.coach-lines')!
      this.panel.append(dialogue)
      let speech = 0
      const showSpeech = (message: string) => {
        lines.querySelector('p')?.remove()
        paragraph(lines, message)
      }
      showSpeech(info.status === 'COMPLETED'
        ? `A ${info.trophy.name} está com você. Essa vitória já entrou para suas conquistas.`
        : coachGreeting[speech])
      if (info.status !== 'COMPLETED') {
        const next = button(this.panel, 'Ouvir mais de Dimas', () => {
          speech = (speech + 1) % coachGreeting.length
          showSpeech(coachGreeting[speech])
        })
        next.className = 'coach-next'
      }
      paragraph(this.panel, `Time de Dimas: ${info.opponentLineup.map(p => `${p.name} · Nv. ${p.level}`).join(' / ')}`).className = 'stadium-opponents'
      const message = {
        AVAILABLE: 'Sua escalação está pronta para o 5 × 5. Empates são decididos nos pênaltis.',
        LINEUP_INCOMPLETE: 'Escale cinco jogadores na tela Equipe para entrar.',
        LOCKED: 'Estádio bloqueado. Conquiste os troféus necessários para entrar.',
        COMPLETED: `Conquistado · ${info.trophy.name}. Este estádio está concluído.`,
      }[info.status]
      paragraph(this.panel, message).setAttribute('role', 'status')
      const actions = document.createElement('div')
      actions.className = 'stadium-actions'
      this.panel.append(actions)
      const back = button(actions, 'Voltar ao bairro', () => this.leave())
      if (info.status !== 'AVAILABLE') return
      const status = paragraph(this.panel, '')
      const start = button(actions, 'Disputar 5 × 5', () => {
        start.disabled = true
        back.disabled = true
        status.textContent = 'Simulando partida…'
        void this.command.play(this.id).then(result => {
          if (!this.scene.isActive()) return
          this.result = result
          this.showPlayback()
        }).catch((error: unknown) => {
          if (!this.scene.isActive()) return
          if (error instanceof ApiError && error.rejected) {
            status.textContent = 'Não foi possível iniciar. Atualize as condições do estádio.'
            back.disabled = false
            button(actions, 'Atualizar estádio', () => { void this.loadStadium() })
          } else {
            status.textContent = 'Resposta não recebida. Recupere a mesma partida.'
            start.textContent = 'Recuperar partida'
            start.disabled = false
          }
        })
      })
    } catch {
      if (!this.scene.isActive()) return
      this.panel.replaceChildren()
      paragraph(this.panel, 'Não foi possível carregar o estádio.')
      button(this.panel, 'Tentar novamente', () => { void this.loadStadium() })
      button(this.panel, 'Voltar ao bairro', () => this.leave())
    }
  }
  private showPlayback(): void {
    const match = this.result!.match
    this.panel.replaceChildren()
    const heading = document.createElement('header')
    heading.className = 'stadium-heading'
    heading.innerHTML = '<h2>ESTÁDIO · 5 × 5</h2><span>AO VIVO</span>'
    this.panel.append(heading)
    const board = document.createElement('div')
    board.className = 'stadium-scoreboard'
    board.innerHTML = '<span>SEU TIME</span><strong role="status">0 × 0</strong><span>TIME DE DIMAS</span>'
    this.panel.append(board)
    this.score = board.querySelector('strong')!
    this.pitch = document.createElement('div')
    this.pitch.className = 'stadium-pitch'
    this.pitch.setAttribute('role', 'img')
    this.pitch.setAttribute('aria-label', `Quadra com ${match.home.map(p => p.name).join(', ')} contra ${match.away.map(p => p.name).join(', ')}`)
    this.pitch.innerHTML = '<div class="stadium-field-lines" aria-hidden="true"></div><div class="stadium-center-circle" aria-hidden="true"></div><div class="stadium-goal goal-home" aria-hidden="true"></div><div class="stadium-goal goal-away" aria-hidden="true"></div><div class="stadium-ball" aria-hidden="true"></div>'
    for (const side of ['HOME', 'AWAY'] as const) {
      const players = side === 'HOME' ? match.home : match.away
      players.forEach((player, index) => {
        const athlete = document.createElement('div')
        athlete.className = `stadium-athlete ${side.toLowerCase()}`
        athlete.dataset.playerId = player.playerId
        athlete.dataset.slot = String(index)
        const position = pitchPosition(side, index)
        athlete.style.left = `${position.x}%`
        athlete.style.top = `${position.y}%`
        const sprite = document.createElement('span')
        sprite.className = 'stadium-athlete-sprite'
        const asset = side === 'AWAY' ? originalUniformUrls.challenger
          : uniformUrl(player.playerDefinitionId?.startsWith('npc_') ? 'challenger' : 'player')
        sprite.style.backgroundImage = `url("${asset}")`
        sprite.dataset.asset = side === 'AWAY' ? 'challenger' : player.playerDefinitionId?.startsWith('npc_') ? 'challenger' : 'player'
        const label = document.createElement('span')
        label.className = 'stadium-athlete-name'
        label.textContent = player.name
        athlete.append(sprite, label)
        this.pitch!.append(athlete)
      })
    }
    this.panel.append(this.pitch)
    const timeline = document.createElement('div')
    timeline.className = 'stadium-timeline'
    timeline.innerHTML = '<span>00\' · EM JOGO</span><progress aria-label="Andamento da partida" value="0" max="100"></progress>'
    this.panel.append(timeline)
    this.clock = timeline.querySelector('span')!
    this.progress = timeline.querySelector('progress')!
    this.event = paragraph(this.panel, 'Bola no centro. Vai começar a partida!')
    this.event.className = 'stadium-event'
    this.event.setAttribute('role', 'status')
    this.event.setAttribute('aria-live', 'polite')
    this.playback = new Playback(match.events)
    const controls = document.createElement('div')
    controls.className = 'stadium-actions'
    this.panel.append(controls)
    const accelerate = button(controls, 'Acelerar · 1×', () => {
      this.playback!.speed = this.playback!.speed === 1 ? 3 : 1
      accelerate.textContent = `Acelerar · ${this.playback!.speed}×`
    })
    button(controls, 'Pular', () => { this.playback!.skip(); this.finish() })
  }
  update(_time: number, delta: number): void {
    if (!this.playback || !this.result) return
    for (const event of this.playback.advance(delta)) this.showEvent(event)
    if (this.playback.complete) this.finish()
  }
  private showEvent(event: MatchEvent): void {
    this.pendingGoal?.()
    this.pendingGoal = undefined
    const participants: Participant[] = [...this.result!.match.home, ...this.result!.match.away]
    this.clock!.textContent = `${event.minute}' · ${event.type.startsWith('PENALTY') ? 'PÊNALTIS' : 'EM JOGO'}`
    const acting = actingPosition(event, participants)
    this.pitch!.querySelectorAll<HTMLElement>('.stadium-athlete').forEach(athlete => {
      const active = athlete.dataset.playerId === event.actorPlayerId
      athlete.classList.toggle('is-active', active)
      if (active && acting) {
        athlete.style.left = `${acting.x}%`
        athlete.style.top = `${acting.y}%`
      } else {
        const base = pitchPosition(athlete.classList.contains('home') ? 'HOME' : 'AWAY', Number(athlete.dataset.slot))
        athlete.style.left = `${base.x}%`
        athlete.style.top = `${base.y}%`
      }
    })
    const ball = this.pitch!.querySelector<HTMLElement>('.stadium-ball')!
    if (acting) { ball.style.left = `${acting.x}%`; ball.style.top = `${acting.y}%` }
    ball.dataset.shot = event.type === 'GOAL' ? event.side.toLowerCase() :
      event.type === 'SHOT_MISSED' ? `${event.side.toLowerCase()}-miss` :
        event.type === 'SAVE' ? `${event.side.toLowerCase()}-save` : 'reset'
    ball.dataset.sequence = String(event.sequence)
    this.pitch!.classList.remove('is-goal')
    const reveal = () => {
      if (!this.scene.isActive() || !this.playback) return
      this.score!.textContent = `${event.homeScore} × ${event.awayScore}`
      if (event.metadata?.homePenalties !== undefined) this.score!.textContent += ` · Pênaltis ${event.metadata.homePenalties} × ${event.metadata.awayPenalties}`
      this.event!.textContent = presentEvent(event, participants)
      this.progress!.value = event.sequence / this.result!.match.events.length * 100
      this.pitch!.classList.toggle('is-goal', event.type === 'GOAL' || event.type === 'PENALTY_GOAL')
      if (event.type === 'GOAL') gameAudio.play('goal')
    }
    if (event.type === 'GOAL') {
      this.event!.textContent = presentEvent({ ...event, type: 'SHOT' }, participants)
      this.pendingGoal = onGoalArrival(ball, reveal)
    } else reveal()
  }
  private finish(): void {
    this.pendingGoal?.()
    this.pendingGoal = undefined
    this.playback = undefined
    if (this.result!.match.outcome === 'WIN') gameAudio.play('win')
    const { match, rewards } = this.result!
    this.panel.replaceChildren()
    const heading = document.createElement('h2')
    heading.textContent = match.outcome === 'WIN' ? 'Vitória no estádio!' : 'Derrota no estádio. Você pode tentar novamente.'
    this.panel.append(heading)
    paragraph(this.panel, `${match.homeScore} × ${match.awayScore}${match.penalties ? ` · Pênaltis ${match.penalties.home} × ${match.penalties.away}` : ''}`).className = 'stadium-final-score'
    const dialogue = document.createElement('div')
    dialogue.className = 'coach-dialogue'
    dialogue.innerHTML = '<span class="coach-portrait" aria-hidden="true"></span><div class="coach-lines"><strong>Professor Dimas · treinador</strong></div>'
    dialogue.querySelector<HTMLElement>('.coach-portrait')!.style.backgroundImage = `url("${import.meta.env.BASE_URL}assets/placeholders/resident-elder.svg")`
    const lines = dialogue.querySelector<HTMLElement>('.coach-lines')!
    for (const line of coachVerdict(this.result!)) paragraph(lines, line)
    this.panel.append(dialogue)
    if (rewards.trophy) {
      const trophy = document.createElement('div')
      trophy.className = 'stadium-trophy-award'
      trophy.innerHTML = '<span class="trophy-icon" aria-hidden="true">🏆</span><span></span>'
      trophy.querySelector('span:last-child')!.textContent = `Troféu conquistado: ${rewards.trophy.name}. Estádio concluído.`
      trophy.setAttribute('role', 'status')
      this.panel.append(trophy)
    }
    const awards = document.createElement('div')
    awards.className = 'stadium-awards'
    for (const reward of rewards.players) {
      const name = match.home.find(p => p.playerId === reward.ownedPlayerId)!.name
      paragraph(awards, `${name}: +${reward.xpAwarded} XP · Nv. ${reward.currentLevel}`)
    }
    this.panel.append(awards)
    const actions = document.createElement('div')
    actions.className = 'stadium-actions'
    this.panel.append(actions)
    if (rewards.trophy) button(actions, 'Ver conquistas', () => {
      this.scene.run('TeamScene')
      this.scene.stop()
    })
    button(actions, 'Voltar ao bairro', () => this.leave())
  }
}
