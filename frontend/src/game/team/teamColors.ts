import type Phaser from 'phaser'
import playerUrl from '../../assets/placeholders/player.svg?no-inline'
import challengerUrl from '../../assets/placeholders/challenger.svg?no-inline'
import emotionsUrl from '../../assets/placeholders/duel-emotions.svg?no-inline'
import playerSvg from '../../assets/placeholders/player.svg?raw'
import challengerSvg from '../../assets/placeholders/challenger.svg?raw'
import emotionsSvg from '../../assets/placeholders/duel-emotions.svg?raw'

export interface TeamColors { primaryColor: string; secondaryColor: string }
export const DEFAULT_TEAM_COLORS: TeamColors = { primaryColor: '#f7d154', secondaryColor: '#24354a' }
export const originalUniformUrls = { player: playerUrl, challenger: challengerUrl, 'duel-emotions': emotionsUrl }
type UniformAsset = 'player' | 'challenger' | 'duel-emotions'
const starterFeatures: Record<string, { skin: string; hair: string }> = {
  starter_leo: { skin: '#c58b61', hair: '#654335' },
  starter_rafa: { skin: '#986445', hair: '#d8a83e' },
  starter_breno: { skin: '#e3af81', hair: '#111820' },
}
const sources = { player: playerSvg, challenger: challengerSvg, 'duel-emotions': emotionsSvg }
let currentColors = DEFAULT_TEAM_COLORS
const urls = new Map<string, string>()

/** Replace clothing only: skin, hair, shoes and the identity of each player stay intact. */
export function uniformSvg(asset: UniformAsset, colors: TeamColors): string {
  if (![colors.primaryColor, colors.secondaryColor].every(color => /^#[0-9a-f]{6}$/i.test(color))) {
    throw new Error('Invalid team colors')
  }
  let source = sources[asset]
  if (asset === 'duel-emotions') {
    return source.replace(/--shirt:#[0-9a-f]{6}/g, `--shirt:${colors.primaryColor}`)
      .replace(/--(?:trim|shorts):#[0-9a-f]{6}/g, match => `${match.split(':')[0]}:${colors.secondaryColor}`)
  }
  const primary = asset === 'player' ? '#f7d154' : '#de725a'
  const secondary = asset === 'player' ? ['#e6ae3b', '#24354a', '#1b293a'] : ['#ad5146']
  // One pass prevents a chosen color matching an original color from being replaced twice.
  source = source.replace(/fill="(#[0-9a-f]{6})"/g, (match, color: string) =>
    color === primary ? `fill="${colors.primaryColor}"` : secondary.includes(color) ? `fill="${colors.secondaryColor}"` : match)
  if (asset === 'challenger') {
    source = source.replace('fill="#f5ead2" d="M9 27', `fill="${colors.secondaryColor}" d="M9 27`)
  }
  return source
}

export function uniformUrl(asset: UniformAsset, colors: TeamColors = currentColors): string {
  const key = `${asset}:${colors.primaryColor}:${colors.secondaryColor}`
  let url = urls.get(key)
  if (!url) {
    url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(uniformSvg(asset, colors))}`
    urls.set(key, url)
  }
  return url
}

export function starterUniformUrl(id: string, colors: TeamColors = currentColors): string {
  const features = starterFeatures[id]
  if (!features) throw new Error(`Unknown starter: ${id}`)
  const key = `starter:${id}:${colors.primaryColor}:${colors.secondaryColor}`
  let url = urls.get(key)
  if (!url) {
    const svg = uniformSvg('player', colors)
      .replaceAll('#c58b61', features.skin).replaceAll('#293139', features.hair)
      .replaceAll('data-starter-mustache=""', id === 'starter_leo' ? 'fill="#3b291f"' : 'display="none"')
    url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    urls.set(key, url)
  }
  return url
}

export async function applyStarterAppearance(scene: Phaser.Scene, id: string): Promise<string> {
  const key = `team-${id}`
  if (scene.textures.exists(key)) return key
  const image = new Image()
  image.src = starterUniformUrl(id)
  await image.decode()
  const texture = scene.textures.addImage(key, image)
  if (!texture) throw new Error('Unable to load starter appearance')
  for (const [row, direction] of ['front', 'side', 'back'].entries()) {
    for (let frame = 0; frame < 4; frame++) texture.add(`${direction}-${frame}`, 0, frame * 32, row * 40, 32, 40)
  }
  return key
}

export async function applyTeamColors(scene: Phaser.Scene, colors: TeamColors): Promise<void> {
  currentColors = colors
  const source = new Image()
  source.src = uniformUrl('player')
  await source.decode()
  if (scene.textures.exists('team-player')) scene.textures.remove('team-player')
  const texture = scene.textures.addImage('team-player', source)
  if (!texture) throw new Error('Unable to load team uniform')
  for (const [row, direction] of ['front', 'side', 'back'].entries()) {
    for (let frame = 0; frame < 4; frame++) {
      texture.add(`${direction}-${frame}`, 0, frame * 32, row * 40, 32, 40)
    }
  }
}
