import type { Position } from './interactions'

/** Find a four-direction route through authored walkable space, without cutting corners. */
export function walkingRoute(start: Position, destination: Position, width: number, height: number,
  walkable: (point: Position) => boolean, tileSize = 32): Position[] {
  const cell = (point: Position) => ({ x: Math.floor(point.x / tileSize), y: Math.floor(point.y / tileSize) })
  const center = (point: Position) => ({ x: (point.x + 0.5) * tileSize, y: (point.y + 0.5) * tileSize })
  const key = (point: Position) => `${point.x},${point.y}`
  const first = cell(start)
  const last = cell(destination)
  if (!walkable(start) || !walkable(destination) || !walkable(center(first)) || !walkable(center(last))) return []
  const queue = [first]
  const previous = new Map<string, Position | null>([[key(first), null]])
  for (let index = 0; index < queue.length; index++) {
    const point = queue[index]!
    if (key(point) === key(last)) {
      const route: Position[] = []
      for (let cursor: Position | null = point; cursor; cursor = previous.get(key(cursor)) ?? null) route.unshift(center(cursor))
      return [start, ...route, destination].filter((p, i, all) => i === 0 || p.x !== all[i - 1]!.x || p.y !== all[i - 1]!.y)
    }
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const next = { x: point.x + dx!, y: point.y + dy! }
      if (next.x < 0 || next.y < 0 || (next.x + 1) * tileSize > width || (next.y + 1) * tileSize > height ||
          previous.has(key(next)) || !walkable(center(next))) continue
      previous.set(key(next), point)
      queue.push(next)
    }
  }
  return []
}

export class GuidedWalk {
  private index = 1
  private travelled = 0
  readonly position: Position
  constructor(private readonly route: Position[], private readonly speed = 180) {
    if (route.length === 0) throw new Error('A guided walk requires a route')
    this.position = { ...route[0]! }
  }
  get finished(): boolean { return this.index >= this.route.length }
  get distance(): number { return this.travelled }
  step(deltaMs: number): void {
    let remaining = this.speed * Math.min(deltaMs, 50) / 1000
    while (remaining > 0 && !this.finished) {
      const target = this.route[this.index]!
      const distance = Math.hypot(target.x - this.position.x, target.y - this.position.y)
      const step = Math.min(remaining, distance)
      if (distance > 0) {
        this.position.x += (target.x - this.position.x) / distance * step
        this.position.y += (target.y - this.position.y) / distance * step
      }
      this.travelled += step
      remaining -= step
      if (step >= distance) this.index++
    }
  }
}
