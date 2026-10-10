import type Phaser from 'phaser'
import { INTERIORS } from '../maps/locations'

export interface SavedLocation {
  worldX: number; worldY: number
  interior?: { key: string; x: number; y: number }
}
const coordinate = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max

export function parseLocation(value: unknown): SavedLocation | undefined {
  if (!value || typeof value !== 'object') return
  const location = value as SavedLocation
  if (!coordinate(location.worldX, 16, 2288) || !coordinate(location.worldY, 20, 2668)) return
  if (location.interior && (!INTERIORS.some(room => room.key === location.interior!.key) ||
    !coordinate(location.interior.x, 89, 871) || !coordinate(location.interior.y, 94, 470))) return
  return location
}

export function loadLocation(profileId: string): SavedLocation | undefined {
  try { return parseLocation(JSON.parse(localStorage.getItem(`rua5.location.${profileId}`) ?? 'null')) }
  catch { return undefined }
}

/** Geometry is a cosmetic checkpoint; roster, XP, fatigue and trophies come from PostgreSQL. */
export function saveLocation(profileId: string, location: SavedLocation): void {
  if (!parseLocation(location)) return
  try {
    const key = `rua5.location.${profileId}`
    const serialized = JSON.stringify(location)
    if (localStorage.getItem(key) !== serialized) localStorage.setItem(key, serialized)
  }
  catch { /* Storage unavailable: the server still retains progression. */ }
}

export function trackLocation(scene: Phaser.Scene, read: () => SavedLocation): void {
  const save = () => {
    const id = scene.registry.get('profileId') as string | undefined
    if (!id) return
    const value = read()
    saveLocation(id, value)
  }
  const activeSave = () => { if (scene.scene.isActive()) save() }
  const timer = scene.time.addEvent({ delay: 500, loop: true, callback: activeSave })
  window.addEventListener('pagehide', activeSave)
  document.addEventListener('visibilitychange', activeSave)
  scene.events.on('sleep', save)
  scene.events.on('wake', save)
  scene.events.once('shutdown', () => {
    timer.remove()
    window.removeEventListener('pagehide', activeSave)
    document.removeEventListener('visibilitychange', activeSave)
    scene.events.off('sleep', save)
    scene.events.off('wake', save)
  })
}
