import { describe, expect, it } from 'vitest'
import map from '../../assets/maps/benfica.json'
import { CHALLENGERS } from './interactions'
import { ChallengerPatrol, patrolEndpoint } from './ChallengerPatrol'

describe('challenger patrol', () => {
  const origin = { x: 100, y: 100 }
  const open = () => true

  it('walks out, pauses and returns along the same fixed route', () => {
    const patrol = new ChallengerPatrol(origin, { x: 164, y: 100 }, 0)
    const directions = new Set<string>()
    let reachedEnd = false
    let returned = false
    for (let frame = 0; frame < 500; frame++) {
      patrol.update(20, false, open)
      expect(patrol.position.x).toBeGreaterThanOrEqual(100)
      expect(patrol.position.x).toBeLessThanOrEqual(164)
      expect(patrol.position.y).toBe(100)
      if (patrol.walking) directions.add(patrol.facing)
      if (patrol.position.x === 164) reachedEnd = true
      if (reachedEnd && patrol.position.x === 100) returned = true
    }
    expect(reachedEnd).toBe(true)
    expect(returned).toBe(true)
    expect(directions).toEqual(new Set(['right', 'left']))
  })

  it('freezes position and time while paused, then resumes without a jump', () => {
    const patrol = new ChallengerPatrol(origin, { x: 164, y: 100 }, 0)
    patrol.update(50, false, open)
    const before = { ...patrol.position }
    patrol.update(10000, true, open)
    expect(patrol.position).toEqual(before)
    expect(patrol.walking).toBe(false)
    expect(patrol.stepOffset).toBe(0)
    patrol.update(10000, false, open)
    expect(patrol.position.x - before.x).toBeCloseTo(1.3)
  })

  it('waits for another NPC to clear the route', () => {
    const patrol = new ChallengerPatrol(origin, { x: 164, y: 100 }, 0)
    patrol.update(50, false, () => false)
    expect(patrol.position).toEqual(origin)
    expect(patrol.walking).toBe(false)
    patrol.update(50, false, open)
    expect(patrol.position.x).toBeGreaterThan(origin.x)
  })

  it('shortens a route before a wall and uses another direction when necessary', () => {
    expect(patrolEndpoint(origin, 0, point => point.x < 125)).toEqual({ x: 124, y: 100 })
    expect(patrolEndpoint(origin, 0, point => point.x === 100)).toEqual({ x: 100, y: 164 })
    expect(patrolEndpoint(origin, 0, () => false)).toEqual(origin)
  })

  it('gives every authored challenger a walkable route for its entire foot collision body', () => {
    const collisions = map.layers.find(layer => layer.name === 'collisions')!.data!
    const objects = map.layers.find(layer => layer.name === 'interactions')!.objects! as {
      x: number; y: number; properties?: { name: string; value: string }[]
    }[]
    const walkable = (point: { x: number; y: number }) => {
      for (const x of [point.x - 9, point.x + 9 - 0.001]) {
        for (const y of [point.y + 6, point.y + 20 - 0.001]) {
          const column = Math.floor(x / map.tilewidth), row = Math.floor(y / map.tileheight)
          if (column < 0 || row < 0 || column >= map.width || row >= map.height ||
              collisions[row * map.width + column] !== 0) return false
        }
      }
      return true
    }
    for (const [index, challenger] of CHALLENGERS.entries()) {
      const point = objects.find(object => object.properties?.some(property => property.value === challenger.spawnKey))!
      const endpoint = patrolEndpoint(point, index, walkable)
      expect(Math.hypot(endpoint.x - point.x, endpoint.y - point.y), challenger.name).toBeGreaterThanOrEqual(16)
      const patrol = new ChallengerPatrol(point, endpoint, index)
      for (let frame = 0; frame < 500; frame++) {
        patrol.update(20, false, walkable)
        expect(walkable(patrol.position), challenger.name).toBe(true)
      }
    }
  })
})
