import { afterEach, expect, it, vi } from 'vitest'
import { parseStadium, StadiumCommand, type StadiumResponse } from './gameApi'
import { presentEvent } from '../game/match/Playback'

const home = Array.from({ length: 5 }, (_, i) => ({ playerId: `h${i}`, name: `Casa ${i}`, level: 6 }))
const away = Array.from({ length: 5 }, (_, i) => ({ playerId: `a${i}`, name: `Fora ${i}`, level: 6 }))
const response: StadiumResponse = {
  match: { id: 'm', mode: 'STADIUM_5V5', home, away, homeScore: 1, awayScore: 1, outcome: 'WIN', penalties: { home: 5, away: 4 },
    events: [{ sequence: 1, minute: 31, type: 'PENALTY_GOAL', side: 'HOME', actorPlayerId: 'h0', homeScore: 1, awayScore: 1 }] },
  rewards: { players: home.map(p => ({ ownedPlayerId: p.playerId, xpAwarded: 100, previousLevel: 6, currentLevel: 6, currentXp: 100 })), trophy: { id: 'trophy_benfica', name: 'Taça' } },
}
afterEach(() => vi.unstubAllGlobals())
it('accepts authoritative tied regulation with penalties and five rewards', () => {
  expect(parseStadium(response)).toBe(response)
  expect(() => parseStadium({ ...response, match: { ...response.match, penalties: null } })).toThrow('Desempate')
  expect(() => parseStadium({ ...response, match: { ...response.match, home: home.slice(0, 4) } })).toThrow()
  expect(() => parseStadium({ ...response, rewards: { ...response.rewards, players: [] } })).toThrow('Recompensas')
  expect(presentEvent(response.match.events[0]!, home)).toContain('Casa 0 converteu o pênalti')
})
it('recovers an uncertain stadium response with the same key and sends no client lineup or result', async () => {
  const fetch = vi.fn().mockRejectedValueOnce(new TypeError('lost response')).mockResolvedValue({ ok: true, json: async () => response })
  vi.stubGlobal('fetch', fetch)
  const command = new StadiumCommand()
  await expect(command.play('benfica_stadium')).rejects.toThrow()
  await expect(command.play('other')).rejects.toThrow('pendente')
  expect(await command.play('benfica_stadium')).toEqual(response)
  expect(fetch.mock.calls[0]![1].headers['Idempotency-Key']).toBe(fetch.mock.calls[1]![1].headers['Idempotency-Key'])
  expect(fetch.mock.calls[0]![1].body).toBe('{}')
})
