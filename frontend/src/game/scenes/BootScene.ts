import Phaser from 'phaser'
import { npcWalkingSheet, npcWalkingSheets, residentWalkingKeys } from '../entities/npcWalkingSheet'
import coachUrl from '../../assets/placeholders/coach.svg?no-inline'
import { addWalkingTexture } from '../team/teamColors'
import neighborhoodUrl from '../../assets/maps/benfica.json?url&no-inline'
import { originalUniformUrls } from '../team/teamColors'

export class BootScene extends Phaser.Scene {
  private loadFailed = false

  constructor() {
    super('BootScene')
  }

  preload(): void {
    this.loadFailed = false
    const message = this.add.text(48, 48, 'Carregando o bairro…', {
      fontFamily: 'monospace', fontSize: '24px', color: '#f7d154',
    })
    this.load.on('loaderror', () => {
      this.loadFailed = true
      message.setText('Não foi possível carregar o bairro.\nRecarregue a página para tentar novamente.')
    })
    const base = import.meta.env.BASE_URL
    this.load.tilemapTiledJSON('benfica', neighborhoodUrl)
    this.load.svg('neighborhood-tiles', `${base}assets/placeholders/tiles.svg`)
    this.load.svg('player', originalUniformUrls['player'])
    this.load.svg('duel-emotions', originalUniformUrls['duel-emotions'])
    this.load.svg('house', `${base}assets/placeholders/house.svg`)
    for (const key of residentWalkingKeys) this.load.svg(key, `${base}assets/placeholders/${key}.svg`)
    for (const variant of ['challenger-bun', 'challenger-cap', 'challenger-beard'] as const) {
      this.load.svg(variant, originalUniformUrls[variant])
    }
    this.load.svg('challenger', originalUniformUrls['challenger'])
    this.load.svg('challenger-curls', originalUniformUrls['challenger-curls'])
    this.load.svg('challenger-headband', originalUniformUrls['challenger-headband'])
  }

  create(): void {
    if (this.loadFailed) return
    const playerTexture = this.textures.get('player')
    for (const [row, direction] of ['front', 'side', 'back'].entries()) {
      for (let frame = 0; frame < 4; frame++) {
        playerTexture.add(`${direction}-${frame}`, 0, frame * 32, row * 40, 32, 40)
      }
    }
    void Promise.all([addWalkingTexture(this, 'coach', coachUrl),
      ...Object.entries(npcWalkingSheets).map(([key, svg]) => addWalkingTexture(this, `walking-${key}`,
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)),
      ...residentWalkingKeys.map(async key => {
        const response = await fetch(`${import.meta.env.BASE_URL}assets/placeholders/${key}.svg`, { signal: AbortSignal.timeout(15_000) })
        if (!response.ok) throw new Error(`Unable to load ${key}`)
        const svg = npcWalkingSheet(await response.text(), key)
        await addWalkingTexture(this, `walking-${key}`, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
      }),
    ]).then(() => {
      this.scene.start('MainMenuScene')
    }).catch(() => {
      this.add.text(48, 110, 'Não foi possível carregar o treinador. Recarregue para tentar novamente.')
    })
  }
}
