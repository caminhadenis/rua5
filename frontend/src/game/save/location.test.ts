import { afterEach, describe, expect, it, vi } from 'vitest'
import type Phaser from 'phaser'
import { loadLocation, parseLocation, trackLocation } from './location'

afterEach(() => vi.unstubAllGlobals())

describe('profile location checkpoint', () => {
  it('restores a valid world or interior location', () => {
    const world = { worldX: 208, worldY: 400 }
    const room = { ...world, interior: { key: 'benfica.gym.entry', x: 480, y: 435 } }
    expect(parseLocation(world)).toEqual(world)
    expect(parseLocation(room)).toEqual(room)
    const recovery = { worldX: 496, worldY: 2456, interior: { key: 'benfica.recovery.entry', x: 480, y: 435 } }
    expect(parseLocation(recovery)).toEqual(recovery)
    const edge = { ...world, interior: { key: 'benfica.school.entry', x: 89, y: 94 } }
    expect(parseLocation(edge)).toEqual(edge)
  })
  it('rejects malformed, unknown and out of bounds locations', () => {
    for (const value of [null, {}, { worldX: NaN, worldY: 400 }, { worldX: 208, worldY: 2689 },
      { worldX: '208', worldY: 400 }, { worldX: 208, worldY: 400, interior: { key: 'unknown', x: 480, y: 435 } },
      { worldX: 208, worldY: 400, interior: { key: 'benfica.gym.entry', x: 480, y: 999 } }]) {
      expect(parseLocation(value)).toBeUndefined()
    }
  })
  it('returning to the same street position replaces an interior checkpoint', () => {
    const storage = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    })
    vi.stubGlobal('window', new EventTarget())
    vi.stubGlobal('document', new EventTarget())
    const makeScene = () => {
      let tick = () => {}
      const target = new EventTarget()
      const events = {
        on: (name: string, action: () => void) => target.addEventListener(name, action),
        once: (name: string, action: () => void) => target.addEventListener(name, action, { once: true }),
        off: (name: string, action: () => void) => target.removeEventListener(name, action),
        emit: (name: string) => target.dispatchEvent(new Event(name)),
      }
      const scene = {
        registry: { get: () => 'profile' }, events, scene: { isActive: () => true },
        time: { addEvent: (config: { callback: () => void }) => { tick = config.callback; return { remove: () => {} } } },
      } as unknown as Phaser.Scene
      return { scene, events, tick: () => tick() }
    }
    const world = makeScene()
    const interior = makeScene()
    const street = { worldX: 1936, worldY: 1336 }
    const room = { ...street, interior: { key: 'benfica.stadium.entry', x: 720, y: 307 } }
    trackLocation(world.scene, () => street)
    trackLocation(interior.scene, () => room)
    world.events.emit('sleep')
    interior.tick()
    expect(loadLocation('profile')).toEqual(room)
    world.events.emit('wake')
    expect(loadLocation('profile')).toEqual(street)
    world.events.emit('shutdown')
    interior.events.emit('shutdown')
  })
})
