import type { Facing, Position } from './interactions'

const MAX_DISTANCE = 64
const SAMPLE_DISTANCE = 4
const ENDPOINT_PAUSE_MS = 800
const DIRECTIONS: Position[] = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }]

/** A short, repeatable route through walkable space, starting at the current position. */
export function patrolEndpoint(origin: Position, index: number, canOccupy: (point: Position) => boolean): Position {
  for (let attempt = 0; attempt < DIRECTIONS.length; attempt++) {
    const direction = DIRECTIONS[(index + attempt) % DIRECTIONS.length]!
    let distance = 0
    for (let step = SAMPLE_DISTANCE; step <= MAX_DISTANCE; step += SAMPLE_DISTANCE) {
      if (!canOccupy({ x: origin.x + direction.x * step, y: origin.y + direction.y * step })) break
      distance = step
    }
    if (distance >= 16) return { x: origin.x + direction.x * distance, y: origin.y + direction.y * distance }
  }
  return { ...origin }
}

/** Scene-local presentation: no timers run while the scene or patrol is paused. */
export class ChallengerPatrol {
  readonly position: Position
  facing: Facing = 'down'
  walking = false
  private returning = false
  private pauseMs: number
  private distance = 0

  constructor(private readonly origin: Position, private readonly endpoint: Position, private readonly index: number) {
    this.position = { ...origin }
    this.pauseMs = index % 5 * 170
  }

  get stepOffset(): number { return this.walking ? Math.abs(Math.sin(this.distance / 5)) : 0 }

  update(deltaMs: number, paused: boolean, canOccupy: (point: Position) => boolean): void {
    this.walking = false
    if (paused) return
    // Avoid jumping across geometry after a suspended browser tab resumes.
    const elapsed = Math.max(0, Math.min(deltaMs, 50))
    if (this.pauseMs > 0) { this.pauseMs -= elapsed; return }
    const target = this.returning ? this.origin : this.endpoint
    const dx = target.x - this.position.x, dy = target.y - this.position.y
    const remaining = Math.hypot(dx, dy)
    if (remaining < 0.01) {
      this.returning = !this.returning
      this.pauseMs = ENDPOINT_PAUSE_MS
      return
    }
    const step = Math.min(remaining, (26 + this.index % 3 * 3) * elapsed / 1000)
    const next = { x: this.position.x + dx / remaining * step, y: this.position.y + dy / remaining * step }
    if (!canOccupy(next)) return
    this.facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down')
    this.position.x = next.x
    this.position.y = next.y
    this.distance += step
    this.walking = step > 0
  }
}
