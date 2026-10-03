import { expect, it } from 'vitest'
import { coachGreeting, coachVerdict } from './stadiumPresentation'
import type { StadiumResponse } from '../../api/gameApi'

function result(won: boolean, played: number): StadiumResponse {
  return {
    match: { id: 'm', home: [], away: [], mode: 'STADIUM_1V1', homeScore: won ? 1 : 0, awayScore: won ? 0 : 1,
      outcome: won ? 'WIN' : 'LOSS', penalties: null, events: [] },
    rewards: { players: [], trophy: won && played === 5 ? { id: 'cup', name: 'Taça do Benfica' } : null,
      series: { id: 's', played, wins: played - (won ? 0 : 1), finished: !won || played === 5 } },
  }
}
it('coach explains five consecutive individual wins and resets on loss', () => {
  expect(coachGreeting.join(' ')).toContain('cinco')
  expect(coachGreeting.join(' ')).toContain('mais forte')
  expect(coachVerdict(result(true, 1)).join(' ')).toContain('1/5')
  expect(coachVerdict(result(true, 3)).join(' ')).not.toContain('Receba')
  expect(coachVerdict(result(true, 5)).join(' ')).toContain('Taça do Benfica')
  expect(coachVerdict(result(false, 4)).join(' ')).toContain('primeiro adversário')
})
it('coach announces the actual next opponent and reserves strongest-player wording for the last duel', () => {
  const next = { playerId: 'tito', name: 'Tito', level: 6 }
  const lines = coachVerdict(result(true, 1), next).join(' ')
  expect(lines).toContain('Gostei do que vi')
  expect(lines).toContain('Agora vou colocar Tito')
  expect(lines).not.toContain('mais forte')
  expect(coachVerdict(result(true, 4), next).join(' ')).toContain('meu jogador mais forte')
  expect(coachVerdict(result(false, 1), next).join(' ')).not.toContain('Agora vou colocar')
  expect(coachVerdict(result(true, 5), next).join(' ')).not.toContain('próximo duelo')
})
