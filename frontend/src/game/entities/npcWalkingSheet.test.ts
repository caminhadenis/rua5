import { expect, it } from 'vitest'
import { npcWalkingSheet, npcWalkingSheets, residentWalkingKeys } from './npcWalkingSheet'

it('supplies complete directional sheets for every NPC silhouette, using the coach stride geometry', () => {
  const sources = import.meta.glob<string>('../../../public/assets/placeholders/resident*.svg', { query: '?raw', import: 'default', eager: true })
  const residents = Object.fromEntries(Object.entries(sources).map(([path, source]) => {
    const key = path.split('/').at(-1)!.replace('.svg', '')
    return [key, npcWalkingSheet(source, key)]
  }))
  expect(Object.keys(residents)).toEqual(expect.arrayContaining(residentWalkingKeys))
  const sheets = { ...npcWalkingSheets, ...residents }
  expect(Object.keys(sheets)).toHaveLength(17)
  for (const [key, sheet] of Object.entries(sheets)) {
    expect(sheet, key).toContain('width="128" height="120"')
    expect(sheet).not.toContain('undefined')
    for (const direction of ['front', 'side', 'back']) expect(sheet).toContain(`id="${direction}-body"`)
    // Both planted feet, alternating forward/back contact, and the bent profile strides.
    expect(sheet).toContain('M7 36h8v3H7zM18 32h8v3h-8z')
    expect(sheet).toContain('M7 32h8v3H7zM18 36h8v3h-8z')
    expect(sheet).toContain('M14 27h6v5h-7v4H7v-4h7z')
    expect(sheet).toContain('M16 27h6v5h3v4h-6v-4h-3z')
  }
  expect(npcWalkingSheets['challenger-curls']).toContain('#9e6246')
  expect(npcWalkingSheets['challenger-curls']).toContain('#5d9c74')
  expect(npcWalkingSheets['challenger-bun']).toContain('M12 0h9v5h-9z')
  expect(sheets['resident-cap']).toContain('M8 2h16v6H8zM20 6h9v3h-9z')
})
