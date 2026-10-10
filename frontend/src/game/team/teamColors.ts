import challengerBunUrl from '../../assets/placeholders/challenger-bun.svg?no-inline'
import challengerBunSvg from '../../assets/placeholders/challenger-bun.svg?raw'
import challengerCapUrl from '../../assets/placeholders/challenger-cap.svg?no-inline'
import challengerCapSvg from '../../assets/placeholders/challenger-cap.svg?raw'
import challengerBeardUrl from '../../assets/placeholders/challenger-beard.svg?no-inline'
import challengerBeardSvg from '../../assets/placeholders/challenger-beard.svg?raw'
import type Phaser from 'phaser'
import playerUrl from '../../assets/placeholders/player.svg?no-inline'
import challengerUrl from '../../assets/placeholders/challenger.svg?no-inline'
import challengerCurlsUrl from '../../assets/placeholders/challenger-curls.svg?no-inline'
import challengerHeadbandUrl from '../../assets/placeholders/challenger-headband.svg?no-inline'
import emotionsUrl from '../../assets/placeholders/duel-emotions.svg?no-inline'
import playerSvg from '../../assets/placeholders/player.svg?raw'
import challengerSvg from '../../assets/placeholders/challenger.svg?raw'
import challengerCurlsSvg from '../../assets/placeholders/challenger-curls.svg?raw'
import challengerHeadbandSvg from '../../assets/placeholders/challenger-headband.svg?raw'
import emotionsSvg from '../../assets/placeholders/duel-emotions.svg?raw'

export interface TeamColors { primaryColor: string; secondaryColor: string }
export const DEFAULT_TEAM_COLORS: TeamColors = { primaryColor: '#f7d154', secondaryColor: '#24354a' }
export const originalUniformUrls = {
  player: playerUrl, challenger: challengerUrl, 'challenger-curls': challengerCurlsUrl,
  'challenger-headband': challengerHeadbandUrl, 'duel-emotions': emotionsUrl,
  'challenger-bun': challengerBunUrl, 'challenger-cap': challengerCapUrl, 'challenger-beard': challengerBeardUrl,
}
export type ChallengerAsset = 'challenger' | 'challenger-curls' | 'challenger-headband' | 'challenger-bun' | 'challenger-cap' | 'challenger-beard'
type UniformAsset = 'player' | ChallengerAsset | 'duel-emotions'
const starterFeatures: Record<string, { skin: string; hair: string }> = {
  starter_leo: { skin: '#c58b61', hair: '#654335' },
  starter_rafa: { skin: '#986445', hair: '#d8a83e' },
  starter_breno: { skin: '#e3af81', hair: '#111820' },
}
const sources = {
  player: playerSvg, challenger: challengerSvg, 'challenger-curls': challengerCurlsSvg,
  'challenger-headband': challengerHeadbandSvg, 'duel-emotions': emotionsSvg,
  'challenger-bun': challengerBunSvg, 'challenger-cap': challengerCapSvg, 'challenger-beard': challengerBeardSvg,
}
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
  const palettes: Record<Exclude<UniformAsset, 'duel-emotions'>, { primary: string; secondary: string[] }> = {
    player: { primary: '#f7d154', secondary: ['#e6ae3b', '#24354a', '#1b293a'] },
    challenger: { primary: '#de725a', secondary: ['#ad5146'] },
    'challenger-curls': { primary: '#5d9c74', secondary: ['#e0d7a6', '#f5ead2'] },
    'challenger-headband': { primary: '#536d9d', secondary: ['#f7d154', '#aebbd0'] },
    'challenger-bun': { primary: '#dd8b4c', secondary: ['#f5ead2'] },
    'challenger-cap': { primary: '#56a29c', secondary: ['#f5ead2'] },
    'challenger-beard': { primary: '#bd6d9d', secondary: ['#f5ead2'] },
  }
  const { primary, secondary } = palettes[asset]
  // One pass prevents a chosen color matching an original color from being replaced twice.
  source = source.replace(/fill="(#[0-9a-f]{6})"/g, (match, color: string) =>
    color === primary ? `fill="${colors.primaryColor}"` : secondary.includes(color) ? `fill="${colors.secondaryColor}"` : match)
  if (asset === 'challenger') {
    source = source.replace('fill="#f5ead2" d="M9 27', `fill="${colors.secondaryColor}" d="M9 27`)
  }
  return source
}

const challengerAppearances: Record<string, ChallengerAsset> = {
  npc_nilo_01: 'challenger', npc_cora_01: 'challenger-curls', npc_davi_01: 'challenger-headband',
  npc_bia_01: 'challenger-bun', npc_rui_01: 'challenger-beard', npc_sol_01: 'challenger-cap',
  npc_teca_01: 'challenger-cap', npc_zeca_01: 'challenger-curls', npc_iris_01: 'challenger-headband',
  npc_bento_01: 'challenger-beard', npc_lua_01: 'challenger-bun', npc_caue_01: 'challenger-headband',
  npc_nina_01: 'challenger-bun', npc_beto_01: 'challenger-beard', npc_joca_01: 'challenger-headband',
  npc_maiara_01: 'challenger-cap',
}

export function challengerAsset(id: string | undefined): ChallengerAsset {
  return id ? challengerAppearances[id] ?? 'challenger' : 'challenger'
}

export function originalChallengerUrl(id: string | undefined): string {
  return id?.startsWith('starter_') ? starterUniformUrl(id, DEFAULT_TEAM_COLORS) : originalUniformUrls[challengerAsset(id)]
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

/** Resolve an owned athlete's uniform without losing the visual identity of starters. */
export function ownedPlayerUniformUrl(id: string | undefined, colors: TeamColors = currentColors): string {
  if (id?.startsWith('starter_')) return starterUniformUrl(id, colors)
  return uniformUrl(id?.startsWith('npc_') ? challengerAsset(id) : 'player', colors)
}

/** Keep a starter's skin and hair in the emotional poses used at the end of a duel. */
export function ownedPlayerEmotionUrl(id: string | undefined, colors: TeamColors = currentColors): string {
  if (!id?.startsWith('starter_')) return uniformUrl('duel-emotions', colors)
  const features = starterFeatures[id]
  if (!features) throw new Error(`Unknown starter: ${id}`)
  const key = `starter-emotions:${id}:${colors.primaryColor}:${colors.secondaryColor}`
  let url = urls.get(key)
  if (!url) {
    const mustache = id === 'starter_leo' ? '#3b291f' : 'transparent'
    const svg = uniformSvg('duel-emotions', colors)
      .replace('--skin:#c58b61', `--skin:${features.skin}`)
      .replace('--hair:#293139', `--hair:${features.hair}`)
      .replace('--mustache:transparent', `--mustache:${mustache}`)
    url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    urls.set(key, url)
  }
  return url
}

/** Upload fixed raster pixels rather than letting the mobile GPU size an SVG image. */
export async function addWalkingTexture(scene: Phaser.Scene, key: string, url: string): Promise<void> {
  const image = new Image()
  image.src = url
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 120
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Unable to rasterize walking animation')
  context.imageSmoothingEnabled = false
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const texture = scene.textures.addCanvas(key, canvas)
  if (!texture) throw new Error('Unable to load walking animation')
  for (const [row, direction] of ['front', 'side', 'back'].entries()) {
    for (let frame = 0; frame < 4; frame++) texture.add(`${direction}-${frame}`, 0, frame * 32, row * 40, 32, 40)
  }
}

export async function applyStarterAppearance(scene: Phaser.Scene, id: string): Promise<string> {
  const key = `team-${id}`
  if (scene.textures.exists(key)) return key
  await addWalkingTexture(scene, key, starterUniformUrl(id))
  return key
}

export async function applyTeamColors(scene: Phaser.Scene, colors: TeamColors): Promise<void> {
  currentColors = colors
  if (scene.textures.exists('team-player')) scene.textures.remove('team-player')
  await addWalkingTexture(scene, 'team-player', uniformUrl('player'))
}
