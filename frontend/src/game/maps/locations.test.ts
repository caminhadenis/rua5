import { describe, expect, it } from 'vitest'
import { INTERIORS } from './locations'
import { RESIDENTS } from './residents'
import { CHALLENGERS } from './interactions'
import { TRAINING_SECTORS } from './trainingCenter'

describe('Benfica interior content', () => {
  it('gives each room its own plan, positions and visual identity', () => {
    expect(new Set(INTERIORS.map(room => room.wallLabel)).size).toBe(INTERIORS.length)
    expect(new Set(INTERIORS.map(room => room.furniture.map(item => `${item.kind}:${item.x},${item.y}`).join('|'))).size).toBe(INTERIORS.length)
    expect(new Set(INTERIORS.map(room => room.people.map(person => `${person.x},${person.y}`).join('|'))).size).toBe(INTERIORS.length)
    expect(new Set(INTERIORS.flatMap(room => room.people.map(person => person.sprite))).size).toBeGreaterThanOrEqual(4)
    for (const room of INTERIORS) {
      expect(room.people).toHaveLength(room.kind === 'gym' ? 1 : room.kind === 'stadium' ? 5 : room.kind === 'university' ? 3 : 2)
      for (const person of room.people) {
        expect(person.x).toBeGreaterThan(110)
        expect(person.x).toBeLessThan(850)
        expect(person.y).toBeGreaterThan(room.kind === 'stadium' ? 160 : 240)
        expect(person.y).toBeLessThan(450)
        expect(room.furniture.some(item => Math.abs(person.x - item.x) < item.width / 2 + 20 &&
          Math.abs(person.y - item.y) < item.height / 2 + 20)).toBe(false)
      }
    }
    expect(TRAINING_SECTORS.map(sector => sector.focus)).toEqual([
      'SPEED', 'DRIBBLING', 'FINISHING', 'DEFENDING', 'PHYSICAL',
    ])
    expect(new Set(TRAINING_SECTORS.map(sector => `${sector.x},${sector.y}`)).size).toBe(5)
    expect(TRAINING_SECTORS.every(sector => sector.coach && sector.dialogue)).toBe(true)
  })

  it('gives different people distinct names across streets, interiors, training and the stadium', () => {
    const names = [...RESIDENTS.map(p => p.name), ...CHALLENGERS.map(p => p.name),
      ...INTERIORS.flatMap(room => room.people.map(p => p.name)), ...TRAINING_SECTORS.map(p => p.coach),
      'Miguel', 'Íris', 'Tito', 'Lia', 'Ivo', 'Mara']
    const canonical = names.map(name => name.replace(/^(Dona|Seu|Professor|Professora|Treinador|Treinadora|Formando|Formanda|Reitor|Fisioterapeuta|Massagista) /, '').split(' ')[0])
    expect(new Set(canonical).size).toBe(canonical.length)
    expect(new Set(RESIDENTS.map(p => p.sprite)).size).toBe(RESIDENTS.length)
    expect(new Set(TRAINING_SECTORS.map(p => p.sprite)).size).toBe(5)
  })

  it('foreshadows the actual stadium lineup and coach through residents', () => {
    const dialogue = [...RESIDENTS.map(resident => resident.dialogue),
      ...INTERIORS.flatMap(room => room.people.map(person => person.dialogue))].join(' ')
    for (const name of ['Dimas', 'Íris', 'Tito', 'Lia', 'Ivo', 'Mara']) expect(dialogue).toContain(name)
    expect(new Set(RESIDENTS.map(resident => resident.sprite)).size).toBeGreaterThanOrEqual(2)
  })
})
