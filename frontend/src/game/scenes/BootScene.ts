import Phaser from 'phaser'
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
    this.load.svg('resident', `${base}assets/placeholders/resident.svg`)
    for (const variant of ['elder', 'student', 'sport']) {
      this.load.svg(`resident-${variant}`, `${base}assets/placeholders/resident-${variant}.svg`)
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
    this.scene.start('MainMenuScene')
  }
}
