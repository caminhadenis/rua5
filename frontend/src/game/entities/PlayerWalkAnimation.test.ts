import { expect, it } from 'vitest'
import { PlayerWalkAnimation } from './PlayerWalkAnimation'

function sprite(dynamic: boolean) {
  return { x: 0, y: 0, frame: '', flipped: false,
    body: dynamic ? { velocity: { x: 160, y: 0 } } : undefined,
    setFrame(frame: string) { this.frame = frame },
    setFlipX(flipped: boolean) { this.flipped = flipped },
  }
}

it('uses identical distance-based steps and directions for the trainer, static NPCs and tweened characters', () => {
  const trainer = sprite(true)
  const npc = sprite(false)
  const trainerWalk = new PlayerWalkAnimation(trainer)
  const npcWalk = new PlayerWalkAnimation(npc)
  const frames = new Set<string>()
  for (const [dx, dy] of [[16, 0], [-16, 0], [0, -16], [0, 16]]) {
    for (let step = 0; step < 4; step++) {
      for (const actor of [trainer, npc]) { actor.x += dx!; actor.y += dy! }
      trainerWalk.update(false, 100)
      npcWalk.update(false, 100, true)
      frames.add(npc.frame)
      expect(npc.frame).toBe(trainer.frame)
      expect(npc.flipped).toBe(trainer.flipped)
    }
  }
  expect(frames.size).toBe(12)
  trainerWalk.update(true, 16)
  npcWalk.update(true, 16, false)
  expect(npc.frame).toBe(trainer.frame)
  expect(npc.frame).toMatch(/-0$/)
})

it('keeps the pose between physics ticks and stops when a character no longer moves', () => {
  const npc = sprite(false)
  const walk = new PlayerWalkAnimation(npc)
  npc.x = 16
  walk.update(false, 16, true)
  expect(npc.frame).toBe('side-1')
  walk.update(false, 8, true)
  expect(npc.frame).toBe('side-1')
  walk.update(false, 16, false)
  expect(npc.frame).toBe('side-0')
  walk.face('up')
  expect(npc.frame).toBe('back-0')
})
