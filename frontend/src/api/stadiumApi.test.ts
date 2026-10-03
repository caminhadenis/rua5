import { afterEach, expect, it, vi } from 'vitest'
import { parseStadium, StadiumCommand, type StadiumResponse } from './gameApi'

const home = [{ playerId: 'h', name: 'Casa', level: 6 }]
const away = [{ playerId: 'a', name: 'Fora', level: 6 }]
const response: StadiumResponse = {
  match: { id: 'm', mode: 'STADIUM_1V1', home, away, homeScore: 1, awayScore: 1, outcome: 'WIN', penalties: { home: 5, away: 4 },
    events: [{ sequence: 1, minute: 21, type: 'PENALTY_GOAL', side: 'HOME', actorPlayerId: 'h', homeScore: 1, awayScore: 1 }] },
  rewards: { players: [{ ownedPlayerId: 'h', xpAwarded: 100, previousLevel: 6, currentLevel: 6, currentXp: 100 }],
    trophy: null, series: { id: 'series', played: 1, wins: 1, finished: false } },
}
afterEach(() => vi.unstubAllGlobals())
it('accepts one athlete on each side with penalties and validates series and trophy', () => {
  expect(parseStadium(response)).toBe(response)
  expect(() => parseStadium({ ...response, match: { ...response.match, penalties: null } })).toThrow('Desempate')
  expect(() => parseStadium({ ...response, match: { ...response.match, home: [...home, ...home] } })).toThrow()
  expect(() => parseStadium({ ...response, rewards: { ...response.rewards, players: [] } })).toThrow('Recompensas')
  expect(() => parseStadium({ ...response, rewards: { ...response.rewards, trophy: { id: 'cup', name: 'Taça' } } })).toThrow('Sequência')
  expect(parseStadium({ ...response, rewards: { ...response.rewards, trophy: { id: 'cup', name: 'Taça' },
    series: { id: 'series', played: 5, wins: 5, finished: true } } }).rewards.trophy).toBeTruthy()
  expect(parseStadium({ ...response, match: { ...response.match, outcome: 'LOSS', penalties: { home: 4, away: 5 } },
    rewards: { ...response.rewards, series: { id: 'series', played: 3, wins: 2, finished: true } } }).rewards.series.finished).toBe(true)
})
it('recovers uncertain commands with the same player, round, series and key', async () => {
  const fetch = vi.fn().mockRejectedValueOnce(new TypeError('lost response')).mockResolvedValue({ ok: true, json: async () => response })
  vi.stubGlobal('fetch', fetch)
  const command = new StadiumCommand()
  await expect(command.play('benfica_stadium', 'h', null, 1)).rejects.toThrow()
  await expect(command.play('other', 'h', null, 1)).rejects.toThrow('pendente')
  await expect(command.play('benfica_stadium', 'other-player', null, 1)).rejects.toThrow('pendente')
  expect(await command.play('benfica_stadium', 'h', null, 1)).toEqual(response)
  expect(fetch.mock.calls[0]![1].headers['Idempotency-Key']).toBe(fetch.mock.calls[1]![1].headers['Idempotency-Key'])
  expect(JSON.parse(fetch.mock.calls[0]![1].body)).toEqual({ ownedPlayerId: 'h', seriesId: null, roundNumber: 1 })
})
