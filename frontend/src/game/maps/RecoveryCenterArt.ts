import Phaser from 'phaser'
import { RECOVERY_STATIONS, type RecoveryStation } from './recoveryCenter'
import { addWalkingTexture, ownedPlayerUniformUrl } from '../team/teamColors'
import type { RosterPlayer } from '../../api/gameApi'

/** Original pixel furniture; clinical staff and athletes keep the game's avatar proportions. */
export class RecoveryCenterArt {
  private readonly patients = new Map<string, Phaser.GameObjects.Sprite>()
  private readonly visitors = new Map<string, Phaser.GameObjects.Sprite>()
  private readonly captions = new Map<string, Phaser.GameObjects.Text>()
  private generation = 0
  private readonly loading = new Map<string, Promise<void>>()

  constructor(private readonly scene: Phaser.Scene, coach: Phaser.Physics.Arcade.Sprite) {
    scene.add.text(395, 153, 'DESCANSO ASSISTIDO', {
      fontFamily: 'monospace', fontSize: '17px', color: '#203b43',
    }).setOrigin(0.5)
    scene.add.text(775, 153, 'BANHOS DE GELO', {
      fontFamily: 'monospace', fontSize: '15px', color: '#203b43',
    }).setOrigin(0.5)
    for (const station of RECOVERY_STATIONS) {
      this.drawStation(station)
      const solid = scene.add.rectangle(station.x, station.y, station.method === 'REST' ? 112 : 78, 54, 0xffffff, 0)
      scene.physics.add.existing(solid, true)
      scene.physics.add.collider(coach, solid)
      const caption = scene.add.text(station.x, station.y + 45, station.label, {
        fontFamily: 'monospace', fontSize: '12px', color: '#203b43', align: 'center',
      }).setOrigin(0.5).setDepth(2)
      this.captions.set(station.id, caption)
    }
    // Other clinic visitors provide ambience without being entries in the coach's roster.
    for (const station of RECOVERY_STATIONS.slice(0, 2)) {
      const visitor = scene.add.sprite(station.x, station.y - 7, 'player', 'front-0').setAngle(-90).setDepth(2)
      visitor.setTint(station.x === 200 ? 0xb5d1ed : 0xf1b2b0)
      this.visitors.set(station.id, visitor)
      scene.tweens.add({ targets: visitor, scaleY: { from: 1, to: 1.035 }, duration: 1400, yoyo: true, repeat: -1 })
    }
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.generation++ })
  }

  async showPatients(assignments: { stationId: string; player: RosterPlayer }[]): Promise<void> {
    const generation = ++this.generation
    for (const sprite of this.patients.values()) { this.scene.tweens.killTweensOf(sprite); sprite.destroy() }
    this.patients.clear()
    for (const station of RECOVERY_STATIONS) {
      this.visitors.get(station.id)?.setVisible(!assignments.some(item => item.stationId === station.id))
      this.captions.get(station.id)?.setText(station.label)
    }
    for (const { stationId, player } of assignments) {
      const station = RECOVERY_STATIONS.find(item => item.id === stationId)
      if (!station) continue
      const key = `recovery-athlete-${this.scene.registry.get('profileId')}-${player.playerDefinitionId}`
      if (!this.scene.textures.exists(key)) {
        let load = this.loading.get(key)
        if (!load) { load = addWalkingTexture(this.scene, key, ownedPlayerUniformUrl(player.playerDefinitionId)); this.loading.set(key, load) }
        try { await load } finally { this.loading.delete(key) }
      }
      if (generation !== this.generation || !this.scene.scene.isActive()) return
      const sprite = this.scene.add.sprite(station.x, station.y - (station.method === 'REST' ? 7 : 25), key, 'front-0')
        .setDepth(station.method === 'REST' ? 2 : 4)
      if (station.method === 'REST') sprite.setAngle(-90)
      else sprite.setCrop(0, 0, 32, 24)
      this.scene.tweens.add({ targets: sprite, scaleY: { from: 1, to: 1.035 }, duration: 1400, yoyo: true, repeat: -1 })
      this.patients.set(stationId, sprite)
      this.captions.get(stationId)?.setText(`${station.label}\n${player.name}`)
    }
  }

  private drawStation({ x, y, method }: RecoveryStation): void {
    const art = this.scene.add.graphics().setDepth(1)
    if (method === 'REST') {
      art.fillStyle(0x557b82).fillRect(x - 55, y - 27, 110, 54)
      art.fillStyle(0xf5f3e8).fillRect(x - 51, y - 23, 102, 43)
      art.fillStyle(0x8fbdc2).fillRect(x - 48, y - 19, 20, 34)
      art.fillStyle(0x34545d).fillRect(x - 47, y + 27, 6, 10).fillRect(x + 41, y + 27, 6, 10)
      art.fillStyle(0x6b9d99).fillRect(x - 19, y - 23, 4, 43)
    } else {
      art.fillStyle(0x34545d).fillRoundedRect(x - 40, y - 30, 80, 64, 10)
      art.fillStyle(0x8db7c4).fillRoundedRect(x - 35, y - 27, 70, 54, 8)
      art.fillStyle(0x387b9b).fillEllipse(x, y - 17, 69, 25)
      art.fillStyle(0xebf9fa)
      for (const [dx, dy] of [[-22, -21], [17, -19], [-9, -13], [27, -13]]) art.fillRect(x + dx!, y + dy!, 7, 5)
      art.lineStyle(3, 0xcce6ed).strokeEllipse(x, y - 17, 73, 27)
      const shimmer = this.scene.add.rectangle(x, y - 13, 18, 2, 0xebf9fa).setDepth(3)
      this.scene.tweens.add({ targets: shimmer, alpha: { from: 0.25, to: 0.9 }, duration: 900, yoyo: true, repeat: -1 })
    }
  }
}
