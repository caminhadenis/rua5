import { describe, expect, it } from 'vitest'
import map from '../../assets/maps/benfica.json'
import { CHALLENGERS } from './interactions'
import { RESIDENTS } from './residents'
import { INTERIORS } from './locations'

interface MapPoint {
  id: number
  x: number
  y: number
  properties?: { name: string; value: string }[]
}

describe('authored neighborhood', () => {
  const obstacles = map.layers.find(layer => layer.name === 'collisions')!.data!
  const points = map.layers.flatMap<MapPoint>(layer => layer.objects ?? [])
    .filter(point => point.properties?.some(property => property.name === 'spawnKey'))
  const entry = points.find(point => point.properties?.some(property => property.value === 'benfica.entry'))!
  const npcs = CHALLENGERS.map(challenger => points.find(point => point.properties?.some(property => property.value === challenger.spawnKey))!)
  const tileIndex = (point: { x: number; y: number }) =>
    Math.floor(point.y / map.tileheight) * map.width + Math.floor(point.x / map.tilewidth)

  it('has complete tile layers and unique stable map object IDs', () => {
    expect(map.properties).toContainEqual({ name: 'mapId', type: 'string', value: 'benfica' })
    for (const layer of map.layers.filter(layer => layer.type === 'tilelayer')) {
      expect(layer.data).toHaveLength(map.width * map.height)
      expect(layer.data!.every(id => id >= 0 && id <= map.tilesets[0].tilecount)).toBe(true)
    }
    const keys = points.flatMap(point => point.properties!.map(property => property.value))
    expect(new Set(keys).size).toBe(keys.length)
    const objectIds = map.layers.flatMap(layer => layer.objects ?? []).map(object => object.id)
    expect(new Set(objectIds).size).toBe(objectIds.length)
    expect(entry).toBeDefined()
    expect(map.width).toBeGreaterThanOrEqual(72)
    expect(map.height).toBeGreaterThanOrEqual(50)
    expect(points.find(point => point.properties?.some(property => property.value === 'benfica.training.01'))).toBeUndefined()
    for (const location of INTERIORS) {
      expect(points.find(point => point.properties?.some(property => property.value === location.key))).toBeDefined()
      expect(location.people.length).toBeGreaterThanOrEqual(location.kind === 'gym' ? 1 : 2)
    }
    expect(map.layers.find(layer => layer.name === 'landmarks')?.objects?.map(object => object.name))
      .toEqual(expect.arrayContaining(['court', 'stadium', 'lake', 'eastCourt', 'southSquare']))
    expect(map.layers.find(layer => layer.name === 'buildings')?.objects?.map(object => object.type))
      .toEqual(expect.arrayContaining(['school', 'gym', 'apartment']))
    for (const resident of RESIDENTS) {
      expect(points.find(point => point.properties?.some(property => property.value === resident.spawnKey))).toBeDefined()
    }
    const houses = map.layers.find(layer => layer.name === 'houses')!.objects!
    expect(houses).toHaveLength(4)
    for (const house of houses) {
      for (let y = house.y; y < house.y + house.height; y += map.tileheight) {
        for (let x = house.x; x < house.x + house.width; x += map.tilewidth) {
          expect(obstacles[tileIndex({ x, y })]).toBe(4)
        }
      }
    }
    expect(npcs).toHaveLength(16)
    npcs.forEach(npc => expect(npc).toBeDefined())
    expect(new Set(CHALLENGERS.map(npc => npc.id)).size).toBe(16)
    expect(npcs.slice(8).map(({ x, y }) => [x, y])).toEqual([
      [1888, 480], // quadra leste
      [320, 880], // lago
      [1120, 1168], // praça sul
      [480, 752], // rua a oeste
      [1200, 112], // norte
      [144, 496], // oeste
      [1616, 592], // centro-leste
      [1968, 1104], // sudeste
    ])
  })

  it('keeps the entry and challenger on walkable tiles with a connected route', () => {
    const start = tileIndex(entry)
    expect(obstacles[start]).toBe(0)
    const visited = new Set([start])
    const queue = [start]
    for (let head = 0; head < queue.length; head++) {
      const index = queue[head]
      const x = index % map.width
      const y = Math.floor(index / map.width)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nextX = x + dx
        const nextY = y + dy
        const next = nextY * map.width + nextX
        if (nextX >= 0 && nextX < map.width && nextY >= 0 && nextY < map.height &&
          obstacles[next] === 0 && !visited.has(next)) {
          visited.add(next)
          queue.push(next)
        }
      }
    }
    for (const point of points) {
      expect(obstacles[tileIndex(point)]).toBe(0)
      expect(visited.has(tileIndex(point))).toBe(true)
    }
  })

  it('isolates the recovery center behind a long walkable forest trail from training and the stadium', () => {
    const recovery = points.find(point => point.properties?.some(property => property.value === 'benfica.recovery.entry'))!
    expect(recovery.y).toBeGreaterThan(2300)
    expect(map.layers.find(layer => layer.name === 'buildings')?.objects?.find(object => object.type === 'recovery')).toBeDefined()
    for (const key of ['benfica.gym.entry', 'benfica.stadium.entry']) {
      const origin = points.find(point => point.properties?.some(property => property.value === key))!
      const distance = new Map([[tileIndex(origin), 0]])
      const queue = [tileIndex(origin)]
      for (let head = 0; head < queue.length; head++) {
        const index = queue[head]!
        const x = index % map.width
        const y = Math.floor(index / map.width)
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx!, ny = y + dy!, next = ny * map.width + nx
          if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height || obstacles[next] !== 0 || distance.has(next)) continue
          distance.set(next, distance.get(index)! + 1)
          queue.push(next)
        }
      }
      expect(distance.get(tileIndex(recovery))! * map.tilewidth).toBeGreaterThan(2800)
    }
  })

  it('places stronger challengers progressively closer to the stadium', () => {
    const stadium = points.find(point => point.properties?.some(property => property.value === 'benfica.stadium.entry'))!
    const distance = (point: MapPoint) => Math.hypot(point.x - stadium.x, point.y - stadium.y)
    const distances = npcs.slice(0, 8).map(distance)
    for (let index = 1; index < distances.length; index++) {
      expect(distances[index]).toBeLessThan(distances[index - 1]!)
    }
    expect(distance(entry)).toBeGreaterThan(distances[0]!)
  })
})
