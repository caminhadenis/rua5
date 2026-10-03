import { describe, expect, it } from 'vitest'
import type { MatchEvent } from '../../api/gameApi'
import { choreographyFor } from './DuelChoreography'

const event = (type: MatchEvent['type'], side: MatchEvent['side'], sequence = 1): MatchEvent => ({
  sequence, minute: sequence, type, side, actorPlayerId: side, homeScore: 0, awayScore: 0,
})

describe('duel choreography', () => {
  it('moves possession toward the correct opponent goal and attaches the ball to its actor', () => {
    const home = choreographyFor(event('POSSESSION', 'HOME'))
    const away = choreographyFor(event('POSSESSION', 'AWAY'))
    expect(home.ball.owner).toBe('home')
    expect(away.ball.owner).toBe('away')
    expect(home.home.x).toBeLessThan(home.away.x)
    expect(away.away.x).toBeGreaterThan(away.home.x)
  })

  it('stages dribbles, tackles and shots with distinct actions', () => {
    expect(choreographyFor(event('DRIBBLE_SUCCESS', 'HOME')).home.action).toBe('dribble')
    expect(choreographyFor(event('DRIBBLE_SUCCESS', 'HOME')).away.action).toBe('stumble')
    expect(choreographyFor(event('TACKLE', 'AWAY')).away.action).toBe('tackle')
    expect(choreographyFor(event('GOAL', 'HOME')).home.action).toBe('shoot')
  })

  it('uses different lanes without random state', () => {
    const lanes = [1, 2, 3, 4].map(sequence => choreographyFor(event('POSSESSION', 'HOME', sequence)).home.y)
    expect(lanes).toEqual([36, 50, 64, 36])
  })
})
