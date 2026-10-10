import coachSheet from '../../assets/placeholders/coach.svg?raw'

/** Reuse the coach's actual limb poses; retain each original NPC's front artwork and palette. */
export function npcWalkingSheet(source: string, appearance: string): string {
  const paths = [...source.matchAll(/<path\b[^>]*fill="(#[0-9a-f]{6})"[^>]*d="([^"]+)"[^>]*\/>/gi)]
  const color = (pattern: RegExp): string => {
    const path = paths.find(path => pattern.test(path[2]!))
    if (!path) throw new Error(`Missing walking palette for ${appearance}`)
    return path[1]!
  }
  const skin = color(/M10 [567]h13/)
  const hair = color(/M[89] [23]h(?:14|16|17)/)
  const pants = color(/^M(?:8|9|10) (?:25|27|28)h/)
  const shoes = color(/^M(?:7|9) 35h/)
  const shirt = paths.filter(path => /^M8 (?:18|19|20|21)h17/.test(path[2]!) && /v(?:10|11|12)H8z|l4 15H4z/.test(path[2]!)).at(-1)![1]!
  const inner = source.replace(/^[\s\S]*?<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '')
  const shade = (color: string) => `#${[1, 3, 5].map(index =>
    Math.round(parseInt(color.slice(index, index + 2), 16) * 0.75).toString(16).padStart(2, '0')).join('')}`
  const palette: Record<string, string> = {
    '#24354a': pants, '#a66e49': skin, '#111820': hair, '#eff1df': shirt,
    '#c5cebf': shirt, '#f5ead2': shoes, '#b7c5bc': shade(shoes), '#8a593b': shade(pants),
  }
  let sheet = coachSheet.replace(/fill="(#[0-9a-f]{6})"/gi, (match, fill: string) =>
    palette[fill] ? `fill="${palette[fill]}"` : match)
  // Long trousers replace the coach's bare calves, with exactly the same leg geometry.
  sheet = sheet.replace(new RegExp(`<path fill="${skin}" d="(M(?:9|14|16) 27[^"]+)"/>`, 'g'),
    (_match, path: string) => `<path fill="${pants}" d="${path}"/>`)
  const front = '<g id="front-body" clip-path="url(#npc-body-clip)"><use href="#npc-source"/></g>'
  const back = `<g id="back-body"><path fill="${shirt}" d="M8 18h17v13H8z"/>
    <use href="#npc-source" clip-path="url(#npc-head-clip)"/>
    <path fill="${hair}" d="M10 9h13v9H10z"/>
    <path fill="${shirt}" d="M13 18h7v2h-7z"/></g>`
  const beard = appearance.includes('beard') || appearance.endsWith('elder')
    ? `<path fill="${hair}" d="M14 15h10v4H14z"/>` : ''
  const side = `<g id="side-body"><path fill="${shirt}" d="M11 18h12v13H11z"/>
    <use href="#npc-source" clip-path="url(#npc-head-clip)"/>
    <path fill="${skin}" d="M12 10h12v8H12zM23 10h3v4h-3z"/>
    <path fill="${hair}" d="M21 11h2v2h-2z"/>${beard}</g>`
  for (const [direction, body] of [['front', front], ['side', side], ['back', back]]) {
    sheet = sheet.replace(new RegExp(`<g id="${direction}-body">[\\s\\S]*?</g>`), body!)
  }
  // Sleeves swing with the same arms used by the coach, rather than floating on the torso.
  sheet = sheet.replace(/(<path fill="[^"]+" d="M4 (\d+)h5v11H4zM24 (\d+)h5v11h-5z"\/>)/g,
    (_match, arms: string, left: string, right: string) => `${arms}<path fill="${shirt}" d="M4 ${left}h5v6H4zM24 ${right}h5v6h-5z"/>`)
  return sheet.replace('</defs>', `<g id="npc-source">${inner}</g>
    <clipPath id="npc-body-clip"><rect width="32" height="18"/><rect x="8" y="18" width="17" height="14"/></clipPath>
    <clipPath id="npc-head-clip"><rect width="32" height="18"/></clipPath></defs>`)
}

const sources = {
  ...import.meta.glob<string>('../../assets/placeholders/challenger*.svg', { query: '?raw', import: 'default', eager: true }),
}

export const npcWalkingSheets = Object.fromEntries(Object.entries(sources).map(([path, source]) => {
  const key = path.split('/').at(-1)!.replace('.svg', '')
  return [key, npcWalkingSheet(source, key)]
}))

export const residentWalkingKeys = ['resident', ...['elder', 'student', 'sport', 'physio', 'masseur',
  'dress', 'beard', 'braid', 'cap', 'curly'].map(variant => `resident-${variant}`)]
