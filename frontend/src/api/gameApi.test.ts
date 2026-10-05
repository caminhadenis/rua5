import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, DuelCommand, parseDuel, request, type DuelResponse } from './gameApi'

export const response: DuelResponse = {
  match: {
    id: 'match', home: [{ playerId: 'a', name: 'Cabeleira', level: 1 }], away: [{ playerId: 'b', name: 'Nilo', level: 1 }],
    homeScore: 7, awayScore: 2, outcome: 'WIN',
    events: [{ sequence: 1, minute: 1, type: 'POSSESSION', side: 'HOME', actorPlayerId: 'a', homeScore: 0, awayScore: 0 }],
  },
  rewards: { ownedPlayerId: 'a', xpAwarded: 63, previousLevel: 1, currentLevel: 2, previousXp: 80, currentXp: 43,
    xpToNextLevel: 255, challengerProgress: { attempts: 1, wins: 1, draws: 0, losses: 0 } },
}
afterEach(() => vi.unstubAllGlobals())
describe('API boundary', () => {
  it('preserves server result and reward without deriving them from events', () => {
    expect(parseDuel(response)).toBe(response)
    expect(parseDuel(response).match.homeScore).toBe(7)
    expect(parseDuel(response).rewards!.xpAwarded).toBe(63)
    expect(() => parseDuel({ ...response, match: { ...response.match, events: [{ ...response.match.events[0]!, sequence: 2 }] } })).toThrow('Timeline')
  })
  it('reuses the key after network failure and issues a fresh key only for the next match', async () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) })
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('lost response'))
      .mockResolvedValue({ ok: true, json: async () => response })
    vi.stubGlobal('fetch', fetch)
    const command = new DuelCommand()
    await expect(command.play('npc', 'a')).rejects.toThrow()
    await expect(command.play('npc', 'other')).rejects.toThrow('pendente')
    expect(await command.play('npc', 'a')).toEqual(response)
    await command.play('npc', 'a')
    const calls = fetch.mock.calls
    expect(calls[0]![1].headers['Idempotency-Key']).toBe(calls[1]![1].headers['Idempotency-Key'])
    expect(calls[2]![1].headers['Idempotency-Key']).not.toBe(calls[1]![1].headers['Idempotency-Key'])
    expect(JSON.parse(calls[0]![1].body)).toEqual({ ownedPlayerId: 'a' })
  })
  it('permits a new selection after a definite rejected command', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ code: 'OWNED_PLAYER_NOT_FOUND' }) })
      .mockResolvedValue({ ok: true, json: async () => response })
    vi.stubGlobal('fetch', fetch)
    const command = new DuelCommand()
    await expect(command.play('npc', 'missing')).rejects.toThrow()
    await expect(command.play('npc', 'a')).resolves.toEqual(response)
  })
  it('retains the server error code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ code: 'PLAYER_NOT_OWNED' }) }))
    await expect(request('/roster')).rejects.toEqual(new ApiError('PLAYER_NOT_OWNED', 403))
  })
})
