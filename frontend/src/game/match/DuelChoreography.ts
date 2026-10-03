import type { MatchEvent } from '../../api/gameApi'

export type DuelSide = 'home' | 'away'
export type DuelAction = 'carry' | 'defend' | 'dribble' | 'stumble' | 'tackle' | 'shoot' | 'react'

export interface DuelChoreography {
  home: { x: number; y: number; action: DuelAction }
  away: { x: number; y: number; action: DuelAction }
  ball: { x: number; y: number; owner?: DuelSide }
}

const lanes = [36, 50, 64] as const

/**
 * Converts an authoritative match event into presentation coordinates.
 * Coordinates intentionally vary by event sequence, while score and event outcome remain server-owned.
 */
export function choreographyFor(event: MatchEvent): DuelChoreography {
  const actor = event.side.toLowerCase() as DuelSide
  const defender: DuelSide = actor === 'home' ? 'away' : 'home'
  const direction = actor === 'home' ? 1 : -1
  const lane = lanes[(event.sequence - 1) % lanes.length]!
  const attackX = event.type === 'POSSESSION' || event.type === 'PASS' ? 34 :
    event.type === 'DRIBBLE_SUCCESS' || event.type === 'TACKLE' ? 50 : 68
  const actorX = actor === 'home' ? attackX : 100 - attackX
  const defenderX = actorX + direction * 13
  const actions: Record<DuelSide, DuelAction> = { [actor]: 'carry', [defender]: 'defend' } as Record<DuelSide, DuelAction>

  if (event.type === 'DRIBBLE_SUCCESS') {
    actions[actor] = 'dribble'
    actions[defender] = 'stumble'
  } else if (event.type === 'TACKLE') {
    actions[actor] = 'tackle'
    actions[defender] = 'stumble'
  } else if (['SHOT', 'SHOT_MISSED', 'GOAL', 'SAVE', 'PENALTY_GOAL', 'PENALTY_MISSED'].includes(event.type)) {
    actions[actor] = 'shoot'
    actions[defender] = 'react'
  }

  const positions = {
    [actor]: { x: actorX, y: lane, action: actions[actor] },
    [defender]: { x: defenderX, y: Math.min(70, lane + 8), action: actions[defender] },
  } as Record<DuelSide, { x: number; y: number; action: DuelAction }>
  return {
    home: positions.home,
    away: positions.away,
    ball: { x: actorX + direction * 5, y: lane + 13, owner: actor },
  }
}
