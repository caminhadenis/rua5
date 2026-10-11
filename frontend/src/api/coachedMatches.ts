import { ApiError, parseDuel, parseStadium, request, type DuelResponse, type StadiumResponse } from './gameApi'
import { createIdempotencyKey } from './idempotencyKey'

export type MatchTempo = 'SLOW' | 'NORMAL' | 'FAST'
export type MatchPosture = 'DEFENSIVE' | 'BALANCED' | 'OFFENSIVE'
export interface CoachInstruction { tempo: MatchTempo; posture: MatchPosture }
export interface CoachedResponse {
  match: Omit<DuelResponse['match'], 'outcome'> & {
    outcome: DuelResponse['match']['outcome'] | null
    mode: 'DUEL_1V1' | 'STADIUM_1V1'; sourceId: string; penalties: StadiumResponse['match']['penalties']
  }
  step: number; totalSteps: number; elapsedSeconds: number; finished: boolean
  instruction: CoachInstruction; homeFatigue: number; awayFatigue: number; roundNumber: number | null
  rewards: DuelResponse['rewards']; stadiumRewards: StadiumResponse['rewards'] | null
}

export function parseCoached(value: CoachedResponse): CoachedResponse {
  if (!value || value.totalSteps !== 5 || !Number.isInteger(value.step) || value.step < 0 || value.step > 5 ||
    value.elapsedSeconds !== value.step * 240 || value.finished !== (value.step === 5) ||
    !['SLOW', 'NORMAL', 'FAST'].includes(value.instruction?.tempo) ||
    !['DEFENSIVE', 'BALANCED', 'OFFENSIVE'].includes(value.instruction?.posture) ||
    ![value.homeFatigue, value.awayFatigue].every(n => Number.isFinite(n) && n >= 0 && n <= 100)) throw new Error('Trecho de partida inválido.')
  const match = value.match
  if (!match || !['DUEL_1V1', 'STADIUM_1V1'].includes(match.mode) || typeof match.id !== 'string' ||
    match.home?.length !== 1 || match.away?.length !== 1 || match.home[0]?.playerId === match.away[0]?.playerId ||
    !Number.isInteger(match.homeScore) || match.homeScore < 0 || !Number.isInteger(match.awayScore) || match.awayScore < 0 ||
    !Array.isArray(match.events)) throw new Error('Partida inválida.')
  const types = ['POSSESSION', 'DRIBBLE_SUCCESS', 'TACKLE', 'SHOT', 'SHOT_MISSED', 'GOAL', 'SAVE', 'PENALTY_GOAL', 'PENALTY_MISSED', 'HOLD', 'SHOT_BLOCKED']
  let minute = 0
  for (const [index, event] of match.events.entries()) {
    if (event.sequence !== index + 1 || !Number.isInteger(event.minute) || event.minute < minute ||
      !types.includes(event.type) || ![match.home[0]!.playerId, match.away[0]!.playerId].includes(event.actorPlayerId) ||
      !['HOME', 'AWAY'].includes(event.side) || !Number.isInteger(event.homeScore) || event.homeScore < 0 ||
      !Number.isInteger(event.awayScore) || event.awayScore < 0) throw new Error('Timeline inválida.')
    minute = event.minute
  }
  if (!value.finished) {
    if (match.outcome !== null || value.rewards !== null || value.stadiumRewards !== null || match.penalties !== null) throw new Error('Resultado antecipado inválido.')
  } else if (match.mode === 'DUEL_1V1') {
    if (!value.rewards) throw new Error('Recompensa ausente.')
    parseDuel({ match: match as DuelResponse['match'], rewards: value.rewards })
  } else parseStadium({ match: match as StadiumResponse['match'], rewards: value.stadiumRewards! })
  return value
}

export const coachedApi = {
  active: async () => {
    const { active: value } = await request<{ active: CoachedResponse | null }>('/coached-matches/active')
    return value === null ? null : parseCoached(value)
  },
  get: async (id: string) => parseCoached(await request<CoachedResponse>(`/coached-matches/${id}`)),
}

/** Holds both key and body until the server's answer is certain. */
export class CoachedCommand {
  private pending?: { path: string; body: unknown; key: string }
  challenge(challengerId: string, ownedPlayerId: string): Promise<CoachedResponse> {
    return this.execute(`/challenges/${challengerId}/coached-matches`, { ownedPlayerId })
  }
  stadium(id: string, ownedPlayerId: string, seriesId: string | null, roundNumber: number): Promise<CoachedResponse> {
    return this.execute(`/stadiums/${id}/coached-matches`, { ownedPlayerId, seriesId, roundNumber })
  }
  advance(id: string, step: number, instruction: CoachInstruction): Promise<CoachedResponse> {
    return this.execute(`/coached-matches/${id}/advance`, { step, instruction })
  }
  retry(): Promise<CoachedResponse> {
    if (!this.pending) throw new Error('Nenhum comando pendente.')
    return this.execute(this.pending.path, this.pending.body)
  }
  private async execute(path: string, body: unknown): Promise<CoachedResponse> {
    if (!this.pending) this.pending = { path, body: structuredClone(body), key: createIdempotencyKey() }
    const pending = this.pending
    if (pending.path !== path || JSON.stringify(pending.body) !== JSON.stringify(body)) throw new Error('Recupere o comando pendente primeiro.')
    try {
      const value = parseCoached(await request<CoachedResponse>(path, pending.body, pending.key))
      this.pending = undefined
      return value
    } catch (error) {
      if (error instanceof ApiError && error.rejected) this.pending = undefined
      throw error
    }
  }
}
