import { describe, expect, it } from 'vitest'
import { INTERIORS } from './locations'
import { TACTICS_COACH_STOP, TACTICS_HOUSE_KEY, TACTICS_PLAYER_STOP, tacticsRoomWalkable } from './tacticsRoom'
import { walkingRoute } from './walkingRoute'

describe('Amélia guided room clearance', () => {
  const room = INTERIORS.find(location => location.key === TACTICS_HOUSE_KEY)!
  const coach = room.people.find(person => person.role === 'tactics-coach')!
  const route = (from: { x: number; y: number }, to: { x: number; y: number }) =>
    walkingRoute(from, to, 960, 540, point => tacticsRoomWalkable(room, point), 16)

  it('has a clear reception and two routes to the mural without crossing furniture or Elisa', () => {
    const entrance = { x: 480, y: 435 }
    const greeting = { x: 432, y: 435 }
    for (const path of [route(coach, greeting), route(greeting, TACTICS_COACH_STOP), route(entrance, TACTICS_PLAYER_STOP)]) {
      expect(path.length).toBeGreaterThan(1)
      expect(path.every(point => tacticsRoomWalkable(room, point))).toBe(true)
    }
  })

  it('can receive a visitor resuming by the mural and walk them back to the lesson', () => {
    const greeting = { x: TACTICS_PLAYER_STOP.x - 48, y: TACTICS_PLAYER_STOP.y }
    expect(route(coach, greeting).length).toBeGreaterThan(1)
    expect(route(greeting, TACTICS_COACH_STOP).length).toBeGreaterThan(1)
    expect(route(TACTICS_PLAYER_STOP, TACTICS_PLAYER_STOP).length).toBeGreaterThan(0)
    expect(tacticsRoomWalkable(room, { x: 173, y: 180 })).toBe(false)
    expect(tacticsRoomWalkable(room, { x: 650, y: 340 })).toBe(false)
    expect(tacticsRoomWalkable(room, { x: 480, y: 202 })).toBe(false)
  })
})
