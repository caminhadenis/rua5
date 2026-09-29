import { describe, expect, it } from 'vitest'
import { actingPosition, coachVerdict, pitchPosition } from './stadiumPresentation'
import type { StadiumResponse } from '../../api/gameApi'

const home = Array.from({ length: 5 }, (_, i) => ({ playerId: `home${i}`, name: `Casa ${i}`, level: 5 }))
const away = Array.from({ length: 5 }, (_, i) => ({ playerId: `away${i}`, name: `Fora ${i}`, level: 6 }))
function result(outcome: 'WIN' | 'LOSS', type: 'SHOT_MISSED' | 'PASS' = 'PASS', penalties: StadiumResponse['match']['penalties'] = null): StadiumResponse {
  return {
    match: { id: 'match', home, away, mode: 'STADIUM_5V5', homeScore: outcome === 'WIN' ? 2 : 0, awayScore: outcome === 'WIN' ? 1 : 2, outcome, penalties,
      events: [{ sequence: 1, minute: 10, type, side: 'HOME', actorPlayerId: 'home2', homeScore: 0, awayScore: 0 }] },
    rewards: { players: [], trophy: outcome === 'WIN' ? { id: 'cup', name: 'Taça do Benfica' } : null },
  }
}

describe('stadium presentation', () => {
  it('ties victory and defeat dialogue to the authoritative result and observed events', () => {
    expect(coachVerdict(result('WIN')).join(' ')).toContain('Taça do Benfica')
    expect(coachVerdict(result('LOSS', 'SHOT_MISSED')).join(' ')).toContain('finalização')
    expect(coachVerdict(result('LOSS')).join(' ')).toContain('defesa')
    expect(coachVerdict(result('LOSS', 'PASS', { home: 3, away: 4 })).join(' ')).toContain('pênaltis')
  })
  it('places both teams and moves only the recorded actor towards the ball', () => {
    expect(pitchPosition('HOME', 0).x).toBeLessThan(50)
    expect(pitchPosition('AWAY', 0).x).toBeGreaterThan(50)
    expect(actingPosition(result('WIN').match.events[0]!, [...home, ...away])).toEqual({ x: 47, y: 24 })
  })
})
