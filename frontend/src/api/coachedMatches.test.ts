import { afterEach, expect, it, vi } from 'vitest'
import { CoachedCommand, parseCoached, type CoachedResponse } from './coachedMatches'

const start: CoachedResponse = {
  match: { id: 'match', mode: 'DUEL_1V1', sourceId: 'npc', home: [{ playerId: 'h', name: 'Home', level: 1 }], away: [{ playerId: 'a', name: 'Away', level: 1 }], homeScore: 0, awayScore: 0, outcome: null, events: [], penalties: null },
  step: 0, totalSteps: 5, elapsedSeconds: 0, finished: false, instruction: { tempo: 'NORMAL', posture: 'BALANCED' }, homeFatigue: 0, awayFatigue: 0, roundNumber: null, rewards: null, stadiumRewards: null,
}
afterEach(() => vi.unstubAllGlobals())

it('accepts a paused match without events or future result and rejects premature rewards', () => {
  expect(parseCoached(start)).toBe(start)
  expect(() => parseCoached({ ...start, match: { ...start.match, outcome: 'WIN' } })).toThrow('antecipado')
  expect(() => parseCoached({ ...start, step: 1 })).toThrow('Trecho')
  expect(() => parseCoached({ ...start, homeFatigue: NaN })).toThrow('Trecho')
})

it('retries the exact instruction and key after a lost response even if a caller changes its object', async () => {
  const fetch = vi.fn().mockRejectedValueOnce(new TypeError('lost')).mockResolvedValue({ ok: true, json: async () => start })
  vi.stubGlobal('fetch', fetch)
  const command = new CoachedCommand()
  const instruction = { tempo: 'FAST' as const, posture: 'OFFENSIVE' as const }
  await expect(command.advance('match', 0, instruction)).rejects.toThrow('lost')
  await expect(command.advance('match', 0, { tempo: 'SLOW', posture: 'DEFENSIVE' })).rejects.toThrow('pendente')
  await command.retry()
  expect(fetch.mock.calls[0]![1].body).toBe(fetch.mock.calls[1]![1].body)
  expect(fetch.mock.calls[0]![1].headers['Idempotency-Key']).toBe(fetch.mock.calls[1]![1].headers['Idempotency-Key'])
  expect(JSON.parse(fetch.mock.calls[1]![1].body).instruction).toEqual(instruction)
})
