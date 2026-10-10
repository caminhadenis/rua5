import type { Position } from './interactions'

export interface FeetBounds { left: number; right: number; top: number; bottom: number }

/** A narrow threshold: being within conversational range is not touching the door. */
export function touchesDoor(feet: FeetBounds, door: Position, width = 32, height = 12): boolean {
  return feet.right >= door.x - width / 2 && feet.left <= door.x + width / 2 &&
    feet.bottom >= door.y - height / 2 && feet.top <= door.y + height / 2
}

export function outsideDoor(key: string, door: Position): Position {
  // These two entrances face north; the remaining buildings face south.
  return { x: door.x, y: door.y + (key === 'benfica.university.entry' || key === 'benfica.stadium.entry' ? -44 : 32) }
}
