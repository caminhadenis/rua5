import Phaser from 'phaser'
import { PlayerWalkAnimation } from '../entities/PlayerWalkAnimation'
import { movementVelocity } from '../input/movement'
import { canInteract } from '../maps/interactions'
import { INTERIORS, type InteriorLocation } from '../maps/locations'
import { TRAINING_SECTORS } from '../maps/trainingCenter'
import { openTrainingPanel } from '../training/TrainingPanel'
import type { TrainingFocus } from '../../api/gameApi'

export class InteriorScene extends Phaser.Scene {
  player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  private location!: InteriorLocation
  private people: { name: string; dialogue: string; role?: 'trainer'; focus?: TrainingFocus; sprite: Phaser.Types.Physics.Arcade.ImageWithStaticBody }[] = []
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private keys!: Record<'W' | 'A' | 'S' | 'D' | 'E' | 'ENTER' | 'ESC', Phaser.Input.Keyboard.Key>
  private walk!: PlayerWalkAnimation
  private dialogue?: Phaser.GameObjects.Container
  private dialogueFocus?: TrainingFocus
  private trainingOpen = false

  constructor() { super('InteriorScene') }

  init(data: { key: string }): void {
    const location = INTERIORS.find(place => place.key === data.key)
    if (!location) throw new Error(`Unknown interior: ${data.key}`)
    this.location = location
  }

  create(): void {
    this.trainingOpen = false
    this.dialogueFocus = undefined
    this.dialogue = undefined
    const width = this.scale.width
    const height = this.scale.height
    this.add.rectangle(width / 2, height / 2, width, height, this.location.wallColor)
    this.add.rectangle(width / 2, 292, 832, 402, this.location.floorColor).setStrokeStyle(8, 0x26343b)
    const floor = this.add.graphics()
    floor.lineStyle(2, this.location.wallColor, 0.25)
    const gap = this.location.pattern === 'wood' ? 42 : this.location.pattern === 'mat' ? 80 : 64
    for (let x = 76; x < 900; x += gap) floor.lineBetween(x, 94, x, 490)
    for (let y = 94; y < 490; y += this.location.pattern === 'wood' ? 28 : gap) floor.lineBetween(76, y, 900, y)
    if (this.location.kind === 'gym') {
      this.add.text(480, 104, this.location.wallLabel, {
        fontFamily: 'monospace', fontSize: '15px', color: '#fff4ce', backgroundColor: '#152b32', padding: { x: 9, y: 3 },
      }).setOrigin(0.5)
    } else {
      this.add.rectangle(480, 126, 256, 40, this.location.accentColor).setStrokeStyle(3, 0x26343b)
      this.add.text(480, 126, this.location.wallLabel, {
        fontFamily: 'monospace', fontSize: '14px', color: '#152b32',
      }).setOrigin(0.5)
    }
    if (this.location.kind !== 'gym') this.add.rectangle(480, 354, 148, 76, this.location.accentColor, 0.34).setStrokeStyle(2, this.location.accentColor)
    this.add.text(480, 42, this.location.name.toUpperCase(), {
      fontFamily: 'monospace', fontSize: '26px', color: '#fff4ce', backgroundColor: '#152b32', padding: { x: 12, y: 5 },
    }).setOrigin(0.5)
    this.add.rectangle(480, 485, 90, 24, 0x594639)
    this.add.text(480, 478, 'SAÍDA · E', { fontFamily: 'monospace', fontSize: '16px', color: '#f7d154' }).setOrigin(0.5)
    this.add.text(16, height - 25, this.location.kind === 'gym'
      ? 'Setas / WASD: andar   E: conversar   Enter: iniciar após conversa   Esc: sair'
      : 'Setas / WASD: andar   E / Enter: conversar ou sair   Esc: sair', {
      fontFamily: 'monospace', fontSize: '15px', color: '#fff4ce', backgroundColor: '#152b32', padding: { x: 8, y: 3 },
    }).setDepth(100)

    this.physics.world.setBounds(80, 100, 800, 390)
    const world = this.scene.get('WorldScene') as Phaser.Scene & { player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody }
    this.player = this.physics.add.sprite(480, 435, world.player.texture.key, 'front-0')
      .setSize(18, 14).setOffset(7, 26).setCollideWorldBounds(true).setDepth(435)
    this.walk = new PlayerWalkAnimation(this.player)
    // Each room supplies its own furniture plan; items are solid and leave a central route.
    for (const item of this.location.furniture) {
      const { x, y, width: w, height: h, kind } = item
      const furniture = this.add.rectangle(x, y, w, h, this.location.accentColor).setStrokeStyle(3, 0x34424a)
      if (kind === 'sofa' || kind === 'bed') {
        this.add.rectangle(x, y - h / 4, w - 12, h / 3, 0xf5ead2, 0.6).setStrokeStyle(2, 0x34424a)
        this.add.rectangle(x, y + h / 5, w - 16, h / 3, this.location.wallColor, 0.7)
      } else if (kind === 'shelf') {
        for (let offset = -w / 3; offset <= w / 3; offset += 14) {
          this.add.rectangle(x + offset, y, 8, h - 12, [0x8e4d49, 0x3f6875, 0xd5ba79][Math.abs(Math.round(offset / 14)) % 3])
        }
      } else if (kind === 'plant') {
        this.add.circle(x, y - 8, Math.min(w, h) / 3, 0x356952)
        this.add.circle(x + 6, y - 11, Math.min(w, h) / 4, 0x7bad64)
      } else if (kind === 'rack') {
        this.add.rectangle(x, y, w - 18, 7, 0x26343b)
        this.add.circle(x - w / 3, y, 11, 0x26343b)
        this.add.circle(x + w / 3, y, 11, 0x26343b)
      } else {
        this.add.rectangle(x, y - 6, w - 16, 8, 0xf5ead2, 0.55)
        if (kind === 'desk') this.add.rectangle(x + 20, y + 9, 24, 16, 0x3f6875)
      }
      this.physics.add.existing(furniture, true)
      this.physics.add.collider(this.player, furniture)
    }
    if (this.location.kind === 'gym') this.drawTrainingCenter()
    const residents = this.location.kind === 'gym'
      ? [...this.location.people, ...TRAINING_SECTORS.map(sector => ({
        name: sector.coach, dialogue: sector.dialogue, role: 'trainer' as const, focus: sector.focus,
        sprite: 'resident-sport' as const, x: sector.x + 76, y: sector.y + 34,
      }))]
      : this.location.people
    this.people = residents.map((person, index) => {
      const sprite = this.physics.add.staticImage(person.x, person.y, person.sprite)
      sprite.body.setSize(18, 14).setOffset(7, 26)
      sprite.setDepth(person.y)
      this.physics.add.collider(this.player, sprite)
      this.tweens.add({ targets: sprite, y: person.y - 2, duration: 700 + index * 230, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      return { ...person, sprite }
    })
    const keyboard = this.input.keyboard!
    this.cursors = keyboard.createCursorKeys()
    this.keys = keyboard.addKeys('W,A,S,D,E,ENTER,ESC') as typeof this.keys
    const animate = (_time: number, delta: number) => this.walk.update(Boolean(this.dialogue?.visible), delta)
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, animate)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.POST_UPDATE, animate))
    if (this.location.kind === 'gym') {
      const trainer = this.people.find(person => person.role === 'trainer' && !person.focus)
      if (trainer) this.showDialogue(trainer.name, trainer.dialogue, 'Treinadora')
    }
  }

  update(): void {
    if (this.trainingOpen) { this.player.setVelocity(0, 0); return }
    const interact = Phaser.Input.Keyboard.JustDown(this.keys.E)
    const enter = Phaser.Input.Keyboard.JustDown(this.keys.ENTER)
    const escape = Phaser.Input.Keyboard.JustDown(this.keys.ESC)
    if (this.dialogue?.visible) {
      this.player.setVelocity(0, 0)
      if (enter && this.dialogueFocus) {
        const focus = this.dialogueFocus
        this.dialogue.setVisible(false)
        this.dialogueFocus = undefined
        this.trainingOpen = true
        this.input.keyboard!.resetKeys()
        const world = this.scene.get('WorldScene')
        void openTrainingPanel(this, focus, () => {
          this.trainingOpen = false
          this.input.keyboard?.resetKeys()
        }, roster => world.events.emit('roster-updated', roster))
        return
      }
      if (interact || enter || escape) { this.dialogue.setVisible(false); this.dialogueFocus = undefined }
      return
    }
    if (escape || (interact && canInteract(this.player.body.center, { x: 480, y: 475 }))) {
      this.leave()
      return
    }
    const nearby = this.people.filter(person => canInteract(this.player.body.center, person.sprite.body.center))
      .sort((a, b) => Phaser.Math.Distance.Between(this.player.x, this.player.y, a.sprite.x, a.sprite.y)
        - Phaser.Math.Distance.Between(this.player.x, this.player.y, b.sprite.x, b.sprite.y))[0]
    if ((interact || enter) && nearby) {
      this.player.setVelocity(0, 0)
      this.dialogueFocus = nearby.focus
      this.showDialogue(nearby.name, nearby.dialogue, nearby.role === 'trainer' ? 'Treinador(a)' : 'Morador')
      return
    }
    const velocity = movementVelocity({
      left: this.cursors.left.isDown || this.keys.A.isDown,
      right: this.cursors.right.isDown || this.keys.D.isDown,
      up: this.cursors.up.isDown || this.keys.W.isDown,
      down: this.cursors.down.isDown || this.keys.S.isDown,
    })
    this.player.setVelocity(velocity.x, velocity.y)
    this.player.setDepth(this.player.y)
  }

  private showDialogue(name: string, words: string, role: string): void {
    if (this.dialogue) this.dialogue.destroy()
    const background = this.add.rectangle(0, 0, 912, 120, 0x152b32).setOrigin(0).setStrokeStyle(3, 0xf7d154)
    const text = this.add.text(18, 12, `${name} · ${role}\n${words}`, {
      fontFamily: 'monospace', fontSize: '18px', color: '#f5ead2', wordWrap: { width: 865 }, lineSpacing: 5,
    })
    this.dialogue = this.add.container(24, 380, [background, text]).setDepth(100)
  }

  private drawTrainingCenter(): void {
    for (const sector of TRAINING_SECTORS) {
      const { x, y, focus } = sector
      const color = focus === 'SPEED' || focus === 'DRIBBLING' ? 0x416b61
        : focus === 'PASSING' || focus === 'FINISHING' ? 0x416478 : 0x685d76
      this.add.rectangle(x, y, 248, 126, color, 0.88).setStrokeStyle(3, 0xf0ba69)
      this.add.text(x, y - 48, sector.label, {
        fontFamily: 'monospace', fontSize: '16px', color: '#fff4ce', backgroundColor: '#152b32', padding: { x: 5, y: 2 },
      }).setOrigin(0.5).setDepth(2)
      const equipment = this.add.graphics().setDepth(1)
      equipment.lineStyle(3, 0xf5ead2, 0.9)
      equipment.fillStyle(0xf7d154)
      if (focus === 'SPEED') {
        equipment.strokeRect(x - 88, y + 25, 74, 22)
        equipment.lineBetween(x - 82, y + 30, x - 24, y + 30)
      } else if (focus === 'DRIBBLING') {
        for (const offset of [-74, -47, -20]) equipment.fillTriangle(x + offset, y + 39, x + offset + 8, y + 18, x + offset + 16, y + 39)
      } else if (focus === 'PASSING') {
        equipment.strokeCircle(x - 54, y + 30, 11)
        equipment.lineBetween(x - 32, y + 30, x + 10, y + 30)
      } else if (focus === 'FINISHING') {
        equipment.strokeRect(x - 87, y + 13, 70, 34)
        equipment.strokeCircle(x - 2, y + 36, 7)
      } else if (focus === 'DEFENDING') {
        equipment.strokeCircle(x - 63, y + 30, 15)
        equipment.strokeCircle(x - 20, y + 30, 15)
      } else {
        equipment.lineBetween(x - 87, y + 15, x - 28, y + 15)
        equipment.fillRect(x - 92, y + 6, 8, 18)
        equipment.fillRect(x - 28, y + 6, 8, 18)
      }
      const athlete = this.add.image(x - 62, y + 35, 'resident-sport').setDepth(y + 35).setName(`training-athlete-${focus}`)
      this.tweens.add({ targets: athlete, y: y + 31, x: x - 56, duration: 550 + x / 4, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      this.add.text(x + 77, y + 56, 'E · TREINADOR', { fontFamily: 'monospace', fontSize: '10px', color: '#f7d154', backgroundColor: '#152b32' })
        .setOrigin(0.5).setDepth(3)
    }
  }

  private leave(): void {
    this.input.keyboard?.resetKeys()
    this.scene.stop()
    this.scene.wake('WorldScene')
  }
}
