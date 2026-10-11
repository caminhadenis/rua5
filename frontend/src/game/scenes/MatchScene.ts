import { DEFAULT_TEAM_COLORS, originalChallengerUrl, ownedPlayerEmotionUrl, ownedPlayerUniformUrl } from '../team/teamColors'
import Phaser from 'phaser'
import { gameAudio } from '../audio/GameAudio'
import { request, type DuelResponse, type MatchEvent, type RosterPlayer, type StadiumResponse } from '../../api/gameApi'
import { surroundWithStands } from '../match/StadiumAudience'
import { emotionsForOutcome, type DuelEmotion } from '../match/duelEmotions'
import { Playback, presentEvent } from '../match/Playback'
import { onGoalArrival } from '../match/goalArrival'
import { choreographyFor, type DuelAction, type DuelSide } from '../match/DuelChoreography'
import { button, paragraph, scenePanel } from '../ui/ScenePanel'
import { ApiError } from '../../api/gameApi'
import { coachedApi, CoachedCommand, type CoachedResponse } from '../../api/coachedMatches'
import { CoachControls } from '../match/CoachControls'
import { recruitmentPanel } from '../ui/RecruitmentPanel'
import { energyIndicator } from '../ui/fatigue'
import coachUrl from '../../assets/placeholders/coach.svg?no-inline'

// Instructions are offered before kickoff and once at halftime. The five
// authoritative chunks still run on the backend; the current instruction is
// reused for chunks between these two pauses.
const instructionPauseSteps = new Set([0, 3])

export class MatchScene extends Phaser.Scene {
  private result!: Omit<DuelResponse, 'match'> & { match: Omit<DuelResponse['match'], 'outcome'> & { outcome: DuelResponse['match']['outcome'] | null } }
  private coached?: CoachedResponse
  private coach?: CoachControls
  private command = new CoachedCommand()
  private paused = false
  private busy = false
  private speed = 1
  private stadium?: StadiumResponse
  private playback!: Playback
  private panel!: HTMLElement
  private caption!: HTMLElement
  private clock!: HTMLElement
  private progress!: HTMLProgressElement
  private controls!: HTMLElement
  private finished = false
  private pendingGoal?: () => void
  constructor() { super('MatchScene') }
  init(data: (DuelResponse & { stadium?: StadiumResponse }) | { coached: CoachedResponse }): void {
    this.pendingGoal?.()
    this.pendingGoal = undefined
    this.coached = 'coached' in data ? data.coached : undefined
    this.coach = undefined
    this.command = new CoachedCommand()
    this.paused = this.coached !== undefined && instructionPauseSteps.has(this.coached.step)
    this.busy = false
    this.speed = 1
    this.stadium = 'coached' in data ? undefined : data.stadium
    this.result = 'coached' in data ? { match: data.coached.match, rewards: data.coached.rewards } : data
    this.playback = new Playback(this.coached ? [] : this.result.match.events)
    this.finished = false
  }
  create(): void {
    // Let the DOM command buttons receive Enter/Space instead of Phaser consuming them.
    const keyboard = this.input.keyboard
    const capture = keyboard?.manager.preventDefault
    keyboard?.disableGlobalCapture()
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (keyboard && capture !== undefined) keyboard.manager.preventDefault = capture
    })
    gameAudio.setMusic('duel')
    gameAudio.play('whistle')
    this.panel = scenePanel(this, 'Partida')
    this.panel.classList.add('duel-panel')
    // Static markup only. All names and messages from the API are assigned with textContent.
    this.panel.innerHTML = `
      <header class="duel-heading"><span>QUADRA DA ESQUINA</span><span class="duel-badge">DUELO 1 × 1</span></header>
      <div class="duel-scoreboard">
        <div class="duel-player home"><small>SEU JOGADOR</small><strong data-player="home"></strong><span data-level="home"></span></div>
        <div class="duel-score" role="group" aria-label="Placar atual"><span data-testid="home-score">0</span><span class="score-divider">×</span><span data-testid="away-score">0</span></div>
        <div class="duel-player away"><small>DESAFIANTE</small><strong data-player="away"></strong><span data-level="away"></span></div>
      </div>
      <div class="duel-arena" aria-hidden="true">
        <div class="court-lines"></div><div class="court-circle"></div>
        <div class="duel-goal goal-home" aria-hidden="true"></div><div class="duel-goal goal-away" aria-hidden="true"></div>
        <div class="duelist home"><div class="duel-sprite"></div><div class="duel-platform"></div></div>
        <span class="duel-versus">VS</span>
        <div class="duelist away"><div class="duel-sprite"></div><div class="duel-platform"></div></div>
        <span class="duel-ball"></span>
        <div class="coach-sideline"></div>
        <div class="duel-coach" data-testid="sideline-coach" hidden>
          <span class="coach-talk" aria-hidden="true">···</span><div class="duel-coach-sprite"></div>
        </div>
      </div>
      <div class="duel-time"><span data-clock>PREPARADOS?</span><progress aria-label="Andamento do duelo" value="0" max="100"></progress><span>1 × 1</span></div>
      <div class="duel-commentary"><span class="commentary-marker" aria-hidden="true">◆</span><p data-testid="current-event" role="status" aria-live="polite">Bola no centro. Vai começar o duelo!</p></div>
      <div class="duel-controls"></div>`
    if (this.stadium || this.coached?.match.mode === 'STADIUM_1V1') this.drawStadiumAudience()
    const { home, away } = this.result.match
    for (const side of ['home', 'away'] as const) {
      const player = (side === 'home' ? home : away)[0]!
      this.panel.querySelector(`[data-player="${side}"]`)!.textContent = player.name
      this.panel.querySelector(`[data-level="${side}"]`)!.textContent = `Nv. ${player.level}`
      const duelist = this.panel.querySelector<HTMLElement>(`.duelist.${side}`)!
      duelist.dataset.avatar = player.playerDefinitionId?.startsWith('starter_') ? 'player'
        : player.playerDefinitionId?.startsWith('npc_') || side === 'away' ? 'challenger' : 'player'
      duelist.dataset.playerDefinitionId = player.playerDefinitionId ?? ''
      this.showEmotion(side, 'neutral')
    }
    this.placeDuelist('home', 32, 50, 'carry')
    this.placeDuelist('away', 68, 50, 'defend')
    this.caption = this.panel.querySelector('[data-testid="current-event"]')!
    this.clock = this.panel.querySelector('[data-clock]')!
    this.progress = this.panel.querySelector('progress')!
    this.controls = this.panel.querySelector('.duel-controls')!
    if (this.coached) {
      this.panel.classList.add('coached-duel-panel')
      this.coach = new CoachControls(this.coached, () => { void this.advanceCoached() })
      this.controls.append(this.coach.element)
      this.showScore(this.coached.match.homeScore, this.coached.match.awayScore)
      this.clock.textContent = `${this.coached.elapsedSeconds / 60}' · ORIENTAÇÃO`
      this.progress.value = this.coached.step * 20
      this.panel.querySelector<HTMLElement>('.duel-coach-sprite')!.style.backgroundImage = `url("${coachUrl}")`
      this.showOrientation(this.paused)
      const resize = new ResizeObserver(() => {
        if (this.panel.classList.contains('is-orienting')) this.positionOrientation()
      })
      resize.observe(this.panel.querySelector('.duel-arena')!)
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => resize.disconnect())
    }
    const playbackControls = document.createElement('div')
    playbackControls.className = 'playback-controls'
    this.controls.append(playbackControls)
    const accelerate = button(playbackControls, 'Acelerar · 1×', () => {
      this.speed = this.speed === 1 ? 4 : 1
      this.playback.speed = this.speed
      accelerate.textContent = `Acelerar · ${this.speed}×`
    })
    button(playbackControls, 'Pular', () => {
      if (this.coached) { void this.advanceCoached(true); return }
      this.showEvents(this.playback.skip())
      this.finish()
    })
    // Resuming between the two scheduled instruction moments continues without
    // introducing an extra pause.
    if (this.coached && !this.paused) {
      this.showOrientation(false)
      void this.advanceCoached()
    }
  }
  update(_time: number, delta: number): void {
    if (this.finished || this.paused || this.busy) return
    this.showEvents(this.playback.advance(delta))
    if (this.playback.complete) {
      if (!this.coached || this.coached.finished) this.finish()
      else {
        this.paused = true
        this.clock.textContent = `${this.coached.elapsedSeconds / 60}' · ORIENTAÇÃO`
        this.coach!.update(this.coached, true)
        if (this.coach!.autoPause && instructionPauseSteps.has(this.coached.step)) this.showOrientation(true)
        else void this.advanceCoached()
      }
    }
  }

  private async advanceCoached(skip = false, retry = false): Promise<void> {
    if (!this.coached || this.busy || this.finished) return
    let coached = this.coached
    this.busy = true
    this.paused = true
    this.pendingGoal?.()
    this.pendingGoal = undefined
    this.controls.querySelector('[data-coach-retry]')?.remove()
    this.coach!.busy(true)
    this.controls.querySelectorAll<HTMLButtonElement>('.playback-controls button').forEach(el => { el.disabled = true })
    try {
      do {
        const previousCount = coached.match.events.length
        if (!coached.finished) {
          const next: CoachedResponse = retry ? await this.command.retry() : await this.command.advance(coached.match.id, coached.step, this.coach!.instruction)
          retry = false
          if (!this.scene.isActive()) return
          this.coached = coached = next
          this.showOrientation(false)
          this.result = { match: next.match, rewards: next.rewards }
          if (next.stadiumRewards) this.stadium = { match: next.match as StadiumResponse['match'], rewards: next.stadiumRewards }
          this.playback = new Playback(next.match.events.slice(previousCount), 6000)
          this.playback.speed = this.speed
          this.coach!.update(next, false)
        }
        if (skip) this.showEvents(this.playback.skip())
      } while (skip && !coached.finished)
      if (skip || coached.finished && this.playback.complete) this.finish()
      else this.paused = false
    } catch (error) {
      if (!this.scene.isActive()) return
      this.paused = true
      this.showOrientation(true)
      const rejected = error instanceof ApiError && error.rejected
      this.coach!.error(rejected ? 'A partida mudou. Atualize para retomar.' : 'Resposta não recebida. Recupere o mesmo trecho.')
      button(this.controls, rejected ? 'Atualizar partida' : 'Recuperar trecho', () => {
        if (rejected) void coachedApi.get(this.coached!.match.id).then(next => {
          if (!this.scene.isActive()) return
          this.coached = next
          this.result = { match: next.match, rewards: next.rewards }
          if (next.stadiumRewards) this.stadium = { match: next.match as StadiumResponse['match'], rewards: next.stadiumRewards }
          this.showScore(next.match.homeScore, next.match.awayScore)
          this.progress.value = next.step * 20
          this.clock.textContent = `${next.elapsedSeconds / 60}' · ORIENTAÇÃO`
          const shouldPause = instructionPauseSteps.has(next.step)
          this.paused = shouldPause
          this.coach!.update(next, shouldPause)
          this.showOrientation(shouldPause && !next.finished)
          this.coach!.busy(false)
          this.controls.querySelector('[data-coach-retry]')?.remove()
          if (next.finished) this.finish()
          else if (!shouldPause) void this.advanceCoached()
        }).catch(() => this.coach!.error('Não foi possível atualizar. Tente novamente.'))
        else void this.advanceCoached(skip, true)
      }).dataset.coachRetry = ''
    } finally {
      this.busy = false
      if (this.scene.isActive() && !this.controls.querySelector('[data-coach-retry]')) this.coach?.busy(false)
      if (this.scene.isActive()) this.controls.querySelectorAll<HTMLButtonElement>('.playback-controls button').forEach(el => { el.disabled = false })
    }
  }
  private showOrientation(visible: boolean): void {
    this.panel.classList.toggle('is-orienting', visible)
    this.panel.querySelector<HTMLElement>('.duel-coach')!.hidden = !visible
    if (visible) {
      this.panel.classList.remove('is-goal')
      for (const side of ['home', 'away'] as const) {
        this.showEmotion(side, 'neutral')
        this.panel.querySelector(`.duelist.${side}`)!.classList.remove('is-active')
      }
      this.positionOrientation()
      this.placeDuelist('away', 72, 35, 'defend')
      this.caption.textContent = `${this.result.match.home[0]!.name} recebe suas orientações na lateral.`
      this.caption.title = this.caption.textContent
    } else {
      this.placeDuelist('home', 32, 50, 'carry')
      this.placeDuelist('away', 68, 50, 'defend')
    }
  }
  private positionOrientation(): void {
    const arena = this.panel.querySelector<HTMLElement>('.duel-arena')!
    // Keep both original avatars' feet inside the sideline, even on a small phone.
    const height = Math.max(1, arena.clientHeight)
    const scale = Math.min(.7, Math.max(.28, (height - 20) / 96))
    arena.style.setProperty('--orientation-scale', String(scale))
    this.placeDuelist('home', 42, (height - 8 - 48 * scale) / height * 100, 'defend')
  }
  private showEvents(events: readonly MatchEvent[]): void {
    const event = events.at(-1)
    if (!event) return
    this.pendingGoal?.()
    this.pendingGoal = undefined
    const participants = [...this.result.match.home, ...this.result.match.away]
    this.panel.dataset.side = event.side.toLowerCase()
    this.panel.dataset.event = event.type.toLowerCase()
    this.panel.classList.remove('is-goal')
    const ball = this.panel.querySelector<HTMLElement>('.duel-ball')!
    const choreography = choreographyFor(event)
    this.placeDuelist('home', choreography.home.x, choreography.home.y, choreography.home.action)
    this.placeDuelist('away', choreography.away.x, choreography.away.y, choreography.away.action)
    ball.style.setProperty('--ball-x', `${choreography.ball.x}%`)
    ball.style.setProperty('--ball-y', `${choreography.ball.y}%`)
    ball.dataset.owner = choreography.ball.owner ?? ''
    // Restart a repeated kick animation even when consecutive events have the same type.
    ball.dataset.shot = 'reset'
    void ball.offsetWidth
    ball.dataset.shot = event.type === 'GOAL' ? event.side.toLowerCase() :
      event.type === 'SHOT_MISSED' ? `${event.side.toLowerCase()}-miss` :
        event.type === 'SAVE' || event.type === 'SHOT_BLOCKED' ? `${event.side.toLowerCase()}-save` : 'reset'
    ball.dataset.sequence = String(event.sequence)
    this.panel.querySelectorAll<HTMLElement>('.duelist').forEach(duelist => {
      const side = duelist.classList.contains('home') ? 'home' : 'away'
      const acting = side === event.side.toLowerCase()
      duelist.classList.toggle('is-active', acting)
      this.showEmotion(side, 'neutral')
    })
    const reveal = () => {
      if (!this.scene.isActive() || this.finished) return
      this.caption.textContent = presentEvent(event, participants)
      this.caption.title = this.caption.textContent
      this.caption.dataset.sequence = String(event.sequence)
      this.clock.textContent = `${event.minute}' · ${event.type.startsWith('PENALTY') ? 'PÊNALTIS' : 'EM JOGO'}`
      if (this.stadium && event.metadata?.homePenalties !== undefined) {
        this.panel.querySelector('[data-penalties]')!.textContent = `Pênaltis ${event.metadata.homePenalties} × ${event.metadata.awayPenalties}`
      }
      this.progress.value = this.coached ? Math.min(100, event.minute / 20 * 100) : event.sequence / this.result.match.events.length * 100
      // The backend supplies the score at this exact event. Never count goals in the client.
      this.showScore(event.homeScore, event.awayScore)
      if (event.type === 'GOAL') {
        this.panel.classList.add('is-goal')
        this.showEmotion(event.side.toLowerCase() as 'home' | 'away', 'happy')
        gameAudio.play('goal')
      }
    }
    if (event.type === 'GOAL') {
      this.caption.textContent = presentEvent({ ...event, type: 'SHOT' }, participants)
      this.caption.title = this.caption.textContent
      this.pendingGoal = onGoalArrival(ball, reveal)
    } else reveal()
  }
  private placeDuelist(side: DuelSide, x: number, y: number, action: DuelAction): void {
    const duelist = this.panel.querySelector<HTMLElement>(`.duelist.${side}`)!
    duelist.style.setProperty('--duelist-x', `${x}%`)
    duelist.style.setProperty('--duelist-y', `${y}%`)
    duelist.dataset.action = action
  }
  private showEmotion(side: 'home' | 'away', emotion: DuelEmotion): void {
    const duelist = this.panel.querySelector<HTMLElement>(`.duelist.${side}`)!
    duelist.dataset.emotion = emotion
    const avatar = duelist.dataset.avatar === 'challenger' ? 'challenger' : 'player'
    const sprite = duelist.querySelector<HTMLElement>('.duel-sprite')!
    const playerDefinitionId = duelist.dataset.playerDefinitionId || undefined
    const usesEmotionSheet = emotion !== 'neutral' && avatar === 'player'
    duelist.dataset.poseSheet = usesEmotionSheet ? 'emotion' : 'base'
    const homeUrl = !usesEmotionSheet
      ? ownedPlayerUniformUrl(playerDefinitionId)
      : ownedPlayerEmotionUrl(playerDefinitionId)
    const awayUrl = usesEmotionSheet ? ownedPlayerEmotionUrl(playerDefinitionId, DEFAULT_TEAM_COLORS) : originalChallengerUrl(playerDefinitionId)
    sprite.style.backgroundImage = `url("${side === 'home' ? homeUrl : awayUrl}")`
    sprite.style.backgroundSize = usesEmotionSheet ? '128px 160px' : (avatar === 'player' ? '256px 240px' : '64px 80px')
    sprite.style.backgroundPosition = !usesEmotionSheet
      ? (avatar === 'player' ? '0 -80px' : '0 0')
      : `${emotion === 'sad' ? '-64px' : '0'} 0`
  }
  private showScore(home: number, away: number): void {
    this.panel.querySelector('[data-testid="home-score"]')!.textContent = String(home)
    this.panel.querySelector('[data-testid="away-score"]')!.textContent = String(away)
  }
  private finish(): void {
    if (this.finished) return
    if (this.result.match.outcome === null) return
    this.pendingGoal?.()
    this.pendingGoal = undefined
    this.finished = true
    this.panel.classList.remove('is-orienting')
    this.panel.querySelector<HTMLElement>('.duel-coach')!.hidden = true
    this.panel.classList.add('is-finished')
    this.panel.classList.remove('is-goal')
    this.controls.replaceChildren()
    this.clock.textContent = 'FIM DO DUELO'
    gameAudio.setMusic(null)
    const outcomeCue = { WIN: 'win', LOSS: 'loss', DRAW: 'draw' } as const
    gameAudio.play(this.stadium?.rewards.trophy ? 'trophy' : outcomeCue[this.result.match.outcome])
    const { rewards } = this.result
    const match = this.result.match as DuelResponse['match']
    this.showScore(match.homeScore, match.awayScore)
    const emotions = emotionsForOutcome(match.outcome)
    for (const side of ['home', 'away'] as const) {
      this.showEmotion(side, emotions[side])
      this.panel.querySelector(`.duelist.${side}`)!.classList.remove('is-active')
    }
    const outcome = { WIN: 'Vitória!', DRAW: 'Empate', LOSS: 'Derrota' }[match.outcome]
    this.caption.textContent = `${outcome} ${match.home[0]!.name} ${match.homeScore} × ${match.awayScore} ${match.away[0]!.name}`
    if (this.stadium?.match.penalties) {
      const { home, away } = this.stadium.match.penalties
      this.panel.querySelector('[data-penalties]')!.textContent = `Pênaltis ${home} × ${away}`
      this.caption.textContent += ` · Pênaltis ${home} × ${away}`
    }
    this.caption.title = this.caption.textContent
    this.caption.dataset.testid = 'match-result'
    if (this.stadium) { this.finishStadium(); return }
    if (rewards) {
      const reward = paragraph(this.controls, `+${rewards.xpAwarded} XP · Nível ${rewards.currentLevel} · ${rewards.currentXp} / ${rewards.xpToNextLevel ?? 'máximo'} XP`)
      reward.dataset.testid = 'reward'
      reward.className = 'duel-reward'
      if (rewards.fatigue) {
        const energy = energyIndicator(rewards.fatigue.after)
        energy.classList.add('fatigue-status')
        this.controls.append(energy)
      }
      if (rewards.currentLevel > rewards.previousLevel) paragraph(this.controls, `Subiu de nível! ${rewards.previousLevel} → ${rewards.currentLevel}`).className = 'level-up'
      const progress = rewards.challengerProgress
      paragraph(this.controls, `${progress.wins} V · ${progress.draws} E · ${progress.losses} D contra este adversário`).className = 'duel-history'
    } else paragraph(this.controls, 'Partida histórica sem recompensa.')
    if (rewards?.recruitmentUnlocked) paragraph(this.controls, 'Novo convite desbloqueado!').className = 'level-up'
    if (match.sourceId) recruitmentPanel(this.controls, match.sourceId, async () => {
      if (this.scene.isActive()) this.scene.start('TeamScene')
    })
    const status = paragraph(this.controls, '')
    const back = button(this.controls, 'Voltar ao bairro', () => {
      back.disabled = true
      status.textContent = 'Atualizando elenco…'
      void request<RosterPlayer[]>('/roster').then(roster => {
        if (!this.scene.isActive()) return
        this.scene.get('WorldScene').events.emit('roster-updated', roster)
        // Show the dialogue only after WorldScene has restored its keyboard on wake.
        this.scene.get('WorldScene').events.once(Phaser.Scenes.Events.WAKE, () => {
          this.scene.get('WorldScene').events.emit('duel-finished', match.outcome, match.away[0]!.name)
        })
        this.scene.wake('WorldScene')
        this.scene.stop()
      }).catch(() => {
        status.textContent = 'Não foi possível atualizar o elenco. Tente novamente.'
        back.disabled = false
      })
    })
  }

  private drawStadiumAudience(): void {
    this.panel.classList.add('stadium-duel-panel')
    this.panel.querySelector('.duel-heading span')!.textContent = `ESTÁDIO DO BENFICA · DUELO ${this.coached?.roundNumber ?? this.stadium!.rewards.series.played}/5`
    const penalties = document.createElement('small')
    penalties.dataset.penalties = ''
    penalties.className = 'duel-penalties'
    this.panel.querySelector('.duel-scoreboard')!.append(penalties)
    const arena = this.panel.querySelector<HTMLElement>('.duel-arena')!
    surroundWithStands(arena)
  }

  private finishStadium(): void {
    // End playback before showing the coach, so conversations never cover the court.
    this.scene.start('StadiumScene', { id: this.stadium!.match.sourceId!, result: this.stadium })
  }
}
