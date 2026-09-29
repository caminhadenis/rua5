import type { MatchEvent, Participant } from '../../api/gameApi'

/** Presentation clock only: never derives score, outcome or rewards from events. */
export class Playback {
  private elapsed = 0
  private count = 0
  private finished: boolean
  speed = 1
  constructor(readonly events: readonly MatchEvent[], private readonly durationMs = 30_000) {
    this.finished = events.length === 0
  }
  get complete(): boolean { return this.finished }
  advance(deltaMs: number): readonly MatchEvent[] {
    if (this.complete) return []
    this.elapsed += Math.max(0, deltaMs)
    const current = this.events[this.count - 1]
    const interval = (current?.type === 'GOAL' || current?.type === 'PENALTY_GOAL')
      ? Math.max(900, 1800 / this.speed)
      : this.durationMs / this.events.length / this.speed
    if (this.elapsed < interval) return []
    // Present at most one new event per frame. A delayed frame cannot swallow a goal celebration.
    this.elapsed = 0
    if (this.count === this.events.length) {
      this.finished = true
      return []
    }
    return [this.events[this.count++]!]
  }
  skip(): readonly MatchEvent[] {
    const rest = this.events.slice(this.count)
    this.count = this.events.length
    this.finished = true
    return rest
  }
}

export function presentEvent(event: MatchEvent, participants: Participant[]): string {
  const actor = participants.find(player => player.playerId === event.actorPlayerId)?.name ?? 'Jogador'
  const text = {
    PASS: 'completou o passe!', SAVE: 'teve o chute defendido pelo goleiro!',
    PENALTY_GOAL: 'converteu o pênalti!', PENALTY_MISSED: 'perdeu o pênalti!',
    POSSESSION: 'ficou com a bola.', DRIBBLE_SUCCESS: 'passou pelo marcador!',
    TACKLE: 'roubou a bola!', SHOT: 'chutou…', SHOT_MISSED: 'chutou para fora!', GOAL: 'marcou um GOL!',
  }[event.type]
  return `${event.minute}' ${actor} ${text}`
}
