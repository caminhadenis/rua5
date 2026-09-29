import { describe, expect, it } from 'vitest'
import type { MatchEvent } from '../../api/gameApi'
import { Playback, presentEvent } from './Playback'

const events: MatchEvent[] = [
  { sequence: 1, minute: 1, type: 'POSSESSION', side: 'HOME', actorPlayerId: 'a', homeScore: 0, awayScore: 0 },
  { sequence: 2, minute: 1, type: 'GOAL', side: 'HOME', actorPlayerId: 'a', homeScore: 0, awayScore: 0 },
  { sequence: 3, minute: 2, type: 'SHOT_MISSED', side: 'AWAY', actorPlayerId: 'b', homeScore: 0, awayScore: 0 },
]
describe('Playback', () => {
  it('emits ordered events and keeps a goal longer even at four times speed', () => {
    const playback = new Playback(events, 3000)
    expect(playback.advance(999)).toEqual([])
    expect(playback.advance(1)).toEqual([events[0]])
    playback.speed = 4
    expect(playback.advance(250)).toEqual([events[1]])
    expect(playback.advance(899)).toEqual([])
    expect(playback.advance(1)).toEqual([events[2]])
    expect(playback.complete).toBe(false)
    playback.advance(250)
    expect(playback.complete).toBe(true)
    expect(playback.advance(50)).toEqual([])
  })
  it('holds the final goal before finishing and does not swallow it after a delayed frame', () => {
    const playback = new Playback(events.slice(0, 2), 2000)
    expect(playback.advance(10_000)).toEqual([events[0]])
    expect(playback.advance(10_000)).toEqual([events[1]])
    expect(playback.complete).toBe(false)
    expect(playback.advance(1799)).toEqual([])
    expect(playback.complete).toBe(false)
    playback.advance(1)
    expect(playback.complete).toBe(true)
  })
  it('can skip during a final goal celebration and handles an empty timeline', () => {
    const playback = new Playback([events[1]!], 1000)
    playback.advance(1000)
    expect(playback.complete).toBe(false)
    expect(playback.skip()).toEqual([])
    expect(playback.complete).toBe(true)
    expect(new Playback([]).complete).toBe(true)
  })
  it('skip before or during playback drains once and keeps original input intact', () => {
    const playback = new Playback(events, 3000)
    expect(playback.advance(1000)).toEqual(events.slice(0, 1))
    expect(playback.skip()).toEqual(events.slice(1))
    expect(playback.skip()).toEqual([])
    expect(playback.advance(10_000)).toEqual([])
    expect(events).toHaveLength(3)
    expect(new Playback(events).skip()).toEqual(events)
  })
  it('uses the event actor (including defending actors) and Portuguese event text', () => {
    for (const type of ['POSSESSION', 'DRIBBLE_SUCCESS', 'TACKLE', 'SHOT', 'SHOT_MISSED', 'GOAL'] as const) {
      const text = presentEvent({ ...events[0]!, actorPlayerId: 'b', type }, [{ playerId: 'b', name: 'Nilo', level: 1 }])
      expect(text).toMatch(/^1' Nilo /)
      expect(text).not.toContain('undefined')
    }
    expect(presentEvent(events[1]!, [{ playerId: 'a', name: 'Cabeleira', level: 1 }])).toBe("1' Cabeleira marcou um GOL!")
  })
})
