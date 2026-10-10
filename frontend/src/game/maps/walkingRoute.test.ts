import { describe, expect, it } from 'vitest'
import map from '../../assets/maps/benfica.json'
import { GuidedWalk, walkingRoute } from './walkingRoute'
import { RESIDENTS } from './residents'
import { CHALLENGERS } from './interactions'

describe('Miguel guided walk', () => {
  it('finds a real route from the university to training that keeps feet out of buildings and people', () => {
    const collision = map.layers.find(layer => layer.name === 'collisions')!.data!
    const points = map.layers.find(layer => layer.name === 'interactions')!.objects! as { x: number; y: number; properties?: { value: string }[] }[]
    const point = (key: string) => points.find(object => object.properties?.some(p => p.value === key))!
    const npcs = [...RESIDENTS, ...CHALLENGERS].map(npc => point(npc.spawnKey))
    const walkable = (p: { x: number; y: number }) => {
      for (const x of [p.x - 9, p.x + 9 - .001]) for (const y of [p.y + 6, p.y + 20 - .001]) {
        if (collision[Math.floor(y / 32) * map.width + Math.floor(x / 32)] !== 0) return false
      }
      return !npcs.some(npc => Math.abs(npc.x - p.x) < 28 && Math.abs(npc.y - p.y) < 22)
    }
    const gym = point('benfica.gym.entry')
    const route = walkingRoute({ x: 464, y: 400 }, { x: gym.x, y: gym.y + 64 }, map.width * 32, map.height * 32, walkable)
    expect(route.length).toBeGreaterThan(20)
    const walk = new GuidedWalk(route)
    let ticks = 0
    while (!walk.finished && ticks++ < 2000) {
      walk.step(16)
      expect(walkable(walk.position)).toBe(true)
    }
    expect(walk.finished).toBe(true)
    expect(walk.position).toEqual({ x: gym.x, y: gym.y + 64 })
    expect(walk.distance).toBeGreaterThan(1000)
  })
  it('handles disconnected destinations and follows turns without skipping corners on slow frames', () => {
    expect(walkingRoute({ x: 16, y: 16 }, { x: 80, y: 16 }, 96, 32, p => p.x < 32 || p.x >= 64)).toEqual([])
    const walk = new GuidedWalk([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }], 100)
    walk.step(1000)
    expect(walk.position).toEqual({ x: 5, y: 0 })
    expect(walk.finished).toBe(false)
    walk.step(50)
    expect(walk.finished).toBe(true)
    expect(walk.position).toEqual({ x: 5, y: 5 })
  })
})
