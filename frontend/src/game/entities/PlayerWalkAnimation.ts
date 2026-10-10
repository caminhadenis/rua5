interface WalkingSprite {
  x: number; y: number
  setFrame(frame: string): unknown
  setFlipX(flip: boolean): unknown
  body?: { velocity?: { x: number; y: number } } | null
}

type Facing = 'front' | 'side' | 'back'

// A complete left/right stride spans 64 world pixels, independent of frame rate.
const STRIDE_LENGTH = 64

export class PlayerWalkAnimation {
  private facing: Facing = 'front'
  private distance = 0
  private stationaryMs = 0
  private previousX: number
  private previousY: number

  constructor(private readonly player: WalkingSprite) {
    this.previousX = player.x
    this.previousY = player.y
  }

  // Called after Arcade Physics has applied movement and resolved collisions.
  update(paused: boolean, deltaMs: number, moving = Boolean(this.player.body?.velocity?.x || this.player.body?.velocity?.y)): void {
    const dx = this.player.x - this.previousX
    const dy = this.player.y - this.previousY
    this.previousX = this.player.x
    this.previousY = this.player.y
    const travelled = Math.hypot(dx, dy)

    if (paused || !moving) {
      this.stop()
      return
    }
    // Rendering can run faster than the fixed physics step. Keep the pose between steps.
    if (travelled < 0.01) {
      this.stationaryMs += deltaMs
      if (this.stationaryMs >= 50) this.stop()
      return
    }
    this.stationaryMs = 0

    const facing = Math.abs(dx) >= Math.abs(dy) ? 'side' : dy < 0 ? 'back' : 'front'
    if (facing !== this.facing) this.distance = 0
    this.facing = facing
    this.player.setFlipX(facing === 'side' && dx < 0)
    this.distance = (this.distance + travelled) % STRIDE_LENGTH
    this.player.setFrame(`${facing}-${Math.floor(this.distance / STRIDE_LENGTH * 4)}`)
  }

  stop(): void {
    this.distance = 0
    this.player.setFrame(`${this.facing}-0`)
  }

  face(direction: 'up' | 'down' | 'left' | 'right'): void {
    this.facing = direction === 'up' ? 'back' : direction === 'down' ? 'front' : 'side'
    this.player.setFlipX(direction === 'left')
    this.stop()
  }
}
