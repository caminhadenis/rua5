import type { DirectionInput } from './movement'

export type TouchAction = 'confirm' | 'back' | 'team'

/** Each finger owns its directions; releasing one never releases another. */
export class TouchInput {
  private readonly pointers = new Map<number, Partial<DirectionInput>>()
  private readonly actions = new Set<TouchAction>()

  hold(pointerId: number, directions: Partial<DirectionInput>): void {
    this.pointers.set(pointerId, directions)
  }

  release(pointerId: number): void { this.pointers.delete(pointerId) }

  get directions(): DirectionInput {
    const held = [...this.pointers.values()]
    return {
      left: held.some(input => input.left), right: held.some(input => input.right),
      up: held.some(input => input.up), down: held.some(input => input.down),
    }
  }

  press(action: TouchAction): void { this.actions.add(action) }

  consume(action: TouchAction): boolean {
    return this.actions.delete(action)
  }

  reset(): void { this.pointers.clear(); this.actions.clear() }
}

/** A narrow desktop window alone must never enable phone controls. */
export function isPhoneDevice(coarsePointer: boolean, screenWidth: number, screenHeight: number): boolean {
  return coarsePointer && Math.min(screenWidth, screenHeight) > 0 && Math.min(screenWidth, screenHeight) <= 600
}
