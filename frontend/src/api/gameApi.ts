export interface Profile { id: string; starterSelected: boolean; primaryColor: string; secondaryColor: string }
export interface Starter { id: string; name: string; archetype: string }
export interface RosterPlayer {
  id: string; playerDefinitionId: string; name: string; level: number; xp: number
  xpToNextLevel: number | null; wins: number; draws: number; losses: number
  archetype: 'DRIBBLER' | 'FINISHER' | 'PLAYMAKER' | 'MARKER'
  preferredRole: 'DEFENDER' | 'MIDFIELDER' | 'ATTACKER'
  stats: Record<'speed' | 'dribbling' | 'passing' | 'finishing' | 'defending' | 'physical', number>
}
export interface ChallengeInfo {
  id: string; name: string; level: number; recruitable: boolean
  recruitmentStatus: 'LOCKED' | 'AVAILABLE' | 'RECRUITED'
}
export type EventType = 'POSSESSION' | 'DRIBBLE_SUCCESS' | 'TACKLE' | 'SHOT' | 'SHOT_MISSED' | 'GOAL' | 'PASS' | 'SAVE' | 'PENALTY_GOAL' | 'PENALTY_MISSED'
export interface MatchEvent {
  sequence: number; minute: number; type: EventType; side: 'HOME' | 'AWAY'; actorPlayerId: string
  homeScore: number; awayScore: number
  metadata?: Record<string, string>
}
export interface Participant { playerId: string; playerDefinitionId?: string; name: string; level: number }
export interface DuelResponse {
  match: {
    id: string; sourceId?: string; home: Participant[]; away: Participant[]; homeScore: number; awayScore: number
    outcome: 'WIN' | 'DRAW' | 'LOSS'; events: MatchEvent[]
  }
  rewards: {
    ownedPlayerId: string; xpAwarded: number; previousLevel: number; currentLevel: number
    previousXp: number; currentXp: number; xpToNextLevel: number | null
    challengerProgress: { attempts: number; wins: number; draws: number; losses: number }
    recruitmentUnlocked?: boolean
  } | null
}

export class ApiError extends Error {
  constructor(public readonly code: string, public readonly status = 0) { super(code) }
  get rejected(): boolean { return this.status >= 400 && this.status < 500 }
}

export async function request<T>(path: string, body?: unknown, key?: string, method?: 'PUT'): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    signal: AbortSignal.timeout(15_000),
    method: method ?? (body === undefined ? 'GET' : 'POST'), credentials: 'same-origin',
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(key ? { 'Idempotency-Key': key } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { code?: string }
    throw new ApiError(error.code ?? 'NETWORK_ERROR', response.status)
  }
  return response.json() as Promise<T>
}

export const teamApi = {
  roster: () => request<RosterPlayer[]>('/roster'),
  challenge: (id: string) => request<ChallengeInfo>(`/challenges/${id}`),
  recruit: (id: string) => request<{ challengerId: string; ownedPlayerId: string }>(`/challenges/${id}/recruit`, {}),
}

export type TrainingFocus = 'SPEED' | 'DRIBBLING' | 'PASSING' | 'FINISHING' | 'DEFENDING' | 'PHYSICAL'
export interface TrainingResult {
  ownedPlayerId: string; focus: TrainingFocus; xpAwarded: number
  previousLevel: number; currentLevel: number; previousXp: number; currentXp: number
  xpToNextLevel: number | null; nextAvailableAt: string
  statBefore: number | null; statAfter: number | null
  progressBefore: number | null; progressAfter: number | null
}

export interface TrainingStatus {
  cooldowns: { ownedPlayerId: string; nextAvailableAt: string }[]
  progress: { ownedPlayerId: string; focus: TrainingFocus; completed: number }[]
}

export const trainingApi = {
  status: () => request<TrainingStatus>('/training/status'),
}

export class TrainingCommand {
  private pending?: { ownedPlayerId: string; focus: TrainingFocus; key: string }
  async train(ownedPlayerId: string, focus: TrainingFocus): Promise<TrainingResult> {
    if (!this.pending) this.pending = { ownedPlayerId, focus, key: crypto.randomUUID() }
    if (this.pending.ownedPlayerId !== ownedPlayerId || this.pending.focus !== focus) throw new Error('Recupere o treino pendente primeiro.')
    try {
      const result = await request<TrainingResult>('/training/sessions', { ownedPlayerId, focus }, this.pending.key)
      this.pending = undefined
      return result
    } catch (error) {
      if (error instanceof ApiError && error.rejected) this.pending = undefined
      throw error
    }
  }
}

const eventTypes: string[] = ['POSSESSION', 'DRIBBLE_SUCCESS', 'TACKLE', 'SHOT', 'SHOT_MISSED', 'GOAL', 'PASS', 'SAVE', 'PENALTY_GOAL', 'PENALTY_MISSED']
export function parseDuel(value: DuelResponse): DuelResponse {
  const match = value?.match
  if (!match || !Array.isArray(match.events) || !match.events.length ||
    !Number.isInteger(match.homeScore) || match.homeScore < 0 ||
    !Number.isInteger(match.awayScore) || match.awayScore < 0 ||
    !['WIN', 'DRAW', 'LOSS'].includes(match.outcome) ||
    !Array.isArray(match.home) || !Array.isArray(match.away)) throw new Error('Resposta de partida inválida.')
  const participants = [...match.home, ...match.away]
  if (participants.length !== 2 || participants.some(p => typeof p.playerId !== 'string' || typeof p.name !== 'string')) throw new Error('Participantes inválidos.')
  let previousMinute = 0
  for (const [index, event] of match.events.entries()) {
    if (event.sequence !== index + 1 || !Number.isInteger(event.minute) || event.minute < previousMinute ||
      !Number.isInteger(event.homeScore) || event.homeScore < 0 || !Number.isInteger(event.awayScore) || event.awayScore < 0 ||
      !eventTypes.includes(event.type) || !participants.some(p => p.playerId === event.actorPlayerId)) throw new Error('Timeline inválida.')
    previousMinute = event.minute
  }
  const reward = value.rewards
  if (reward !== null && (!reward || !Number.isInteger(reward.xpAwarded) || reward.xpAwarded < 0 ||
    !Number.isInteger(reward.currentLevel) || reward.currentLevel < 1 || reward.currentLevel > 15 ||
    !Number.isInteger(reward.currentXp) || reward.currentXp < 0 || !reward.challengerProgress)) throw new Error('Recompensa inválida.')
  return value
}

// Retain the same command after an uncertain response; success or definite rejection clears it.
export class DuelCommand {
  private pending?: { challengerId: string; ownedPlayerId: string; key: string }

  async play(challengerId: string, ownedPlayerId: string): Promise<DuelResponse> {
    if (!this.pending) this.pending = { challengerId, ownedPlayerId, key: crypto.randomUUID() }
    const command = this.pending
    if (command.challengerId !== challengerId || command.ownedPlayerId !== ownedPlayerId) throw new Error('Repita o desafio pendente primeiro.')
    try {
      const result = parseDuel(await request<DuelResponse>(`/challenges/${challengerId}/matches`, { ownedPlayerId }, command.key))
      this.pending = undefined
      return result
    } catch (error) {
      // A rejected command made no new progress. Network/server failures remain uncertain.
      if (error instanceof ApiError && error.rejected) this.pending = undefined
      throw error
    }
  }
}

export interface StadiumInfo {
  id: string; name: string; spawnKey: string; mapId: string
  status: 'AVAILABLE' | 'LOCKED' | 'COMPLETED'
  missingTrophies: string[]; opponentLineup: Participant[]
  trophy: { id: string; name: string; description: string }
  series: SeriesProgress | null
}
export interface SeriesProgress { id: string; played: number; wins: number; finished: boolean }
export interface StadiumResponse {
  match: DuelResponse['match'] & { mode: 'STADIUM_1V1'; penalties: { home: number; away: number } | null }
  rewards: {
    players: { ownedPlayerId: string; xpAwarded: number; previousLevel: number; currentLevel: number; currentXp: number }[]
    trophy: { id: string; name: string } | null
    series: SeriesProgress
  }
}
export const stadiumApi = {
  list: () => request<StadiumInfo[]>('/stadiums'),
  get: (id: string) => request<StadiumInfo>(`/stadiums/${id}`),
}

export function parseStadium(value: StadiumResponse): StadiumResponse {
  const match = value?.match
  if (!match || match.mode !== 'STADIUM_1V1' || match.home?.length !== 1 || match.away?.length !== 1 ||
    !['WIN', 'LOSS'].includes(match.outcome) || !Number.isInteger(match.homeScore) || match.homeScore < 0 ||
    !Number.isInteger(match.awayScore) || match.awayScore < 0 || !Array.isArray(match.events) || !match.events.length) throw new Error('Partida de estádio inválida.')
  const ids = [...match.home, ...match.away].map(p => p.playerId)
  if (new Set(ids).size !== 2) throw new Error('Participantes inválidos.')
  let minute = 0
  for (const [index, event] of match.events.entries()) {
    if (event.sequence !== index + 1 || !Number.isInteger(event.minute) || event.minute < minute ||
      !eventTypes.includes(event.type) || !ids.includes(event.actorPlayerId) ||
      !Number.isInteger(event.homeScore) || event.homeScore < 0 || !Number.isInteger(event.awayScore) || event.awayScore < 0) throw new Error('Timeline inválida.')
    minute = event.minute
  }
  const penalties = match.penalties
  if (match.homeScore === match.awayScore) {
    if (!penalties || !Number.isInteger(penalties.home) || !Number.isInteger(penalties.away) ||
      penalties.home < 0 || penalties.away < 0 || penalties.home === penalties.away) throw new Error('Desempate inválido.')
  } else if (penalties !== null) throw new Error('Desempate inválido.')
  if (value.rewards?.players?.length !== 1 || value.rewards.players.some(p => !ids.slice(0, 1).includes(p.ownedPlayerId) ||
    !Number.isInteger(p.xpAwarded) || p.xpAwarded < 0 || !Number.isInteger(p.currentLevel) || p.currentLevel < 1 || p.currentLevel > 15)) throw new Error('Recompensas inválidas.')
  const series = value.rewards.series
  if (!series || typeof series.id !== 'string' || !Number.isInteger(series.played) || series.played < 1 || series.played > 5 ||
    !Number.isInteger(series.wins) || series.wins < 0 || series.wins > series.played ||
    series.finished !== (match.outcome === 'LOSS' || series.played === 5) ||
    series.wins !== series.played - (match.outcome === 'LOSS' ? 1 : 0) ||
    Boolean(value.rewards.trophy) !== (series.wins === 5)) throw new Error('Sequência inválida.')
  return value
}

export class StadiumCommand {
  private pending?: { id: string; ownedPlayerId: string; seriesId: string | null; roundNumber: number; key: string }
  async play(id: string, ownedPlayerId: string, seriesId: string | null, roundNumber: number): Promise<StadiumResponse> {
    if (!this.pending) this.pending = { id, ownedPlayerId, seriesId, roundNumber, key: crypto.randomUUID() }
    const pending = this.pending
    if (pending.id !== id || pending.ownedPlayerId !== ownedPlayerId || pending.seriesId !== seriesId || pending.roundNumber !== roundNumber) throw new Error('Recupere a partida pendente primeiro.')
    try {
      const value = parseStadium(await request<StadiumResponse>(`/stadiums/${id}/matches`, { ownedPlayerId, seriesId, roundNumber }, pending.key))
      this.pending = undefined
      return value
    } catch (error) {
      if (error instanceof ApiError && error.rejected) this.pending = undefined
      throw error
    }
  }
}
