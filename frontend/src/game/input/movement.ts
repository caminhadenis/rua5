export const WALK_SPEED = 160

export interface DirectionInput {
  left: boolean
  right: boolean
  up: boolean
  down: boolean
}

export function movementVelocity(input: DirectionInput, blocked = false) {
  const x = Number(input.right) - Number(input.left)
  const y = Number(input.down) - Number(input.up)
  const length = Math.hypot(x, y)
  if (blocked || length === 0) return { x: 0, y: 0 }
  return { x: x / length * WALK_SPEED, y: y / length * WALK_SPEED }
}
