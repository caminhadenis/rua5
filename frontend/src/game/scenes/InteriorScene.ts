import Phaser from 'phaser'
import { gameAudio } from '../audio/GameAudio'
import { TouchControls } from '../input/TouchControls'
import { isPhone, isPhonePortrait } from '../input/mobileViewport'
import { MobileDialogue } from '../ui/MobileDialogue'
import { PlayerWalkAnimation } from '../entities/PlayerWalkAnimation'
import { movementVelocity } from '../input/movement'
import { touchesDoor } from '../maps/doors'
import type { WorldScene } from './WorldScene'
import { canInteract } from '../maps/interactions'
import { INTERIORS, type InteriorLocation } from '../maps/locations'
import { RECOVERY_STATIONS, type RecoveryStation } from '../maps/recoveryCenter'
import { RecoveryCenterArt } from '../maps/RecoveryCenterArt'
import { openRecoveryPanel } from '../ui/RecoveryPanel'
import { TRAINING_SECTORS } from '../maps/trainingCenter'
import { openTrainingPanel } from '../training/TrainingPanel'
import { trackLocation } from '../save/location'
import { button } from '../ui/ScenePanel'
import { teamApi } from '../../api/gameApi'
import type { TrainingFocus } from '../../api/gameApi'

export class InteriorScene extends Phaser.Scene {
  player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  private location!: InteriorLocation
  private people: { name: string; dialogue: string; role?: 'trainer' | 'stadium-coach' | 'supporter' | 'physiotherapist' | 'masseur'; focus?: TrainingFocus; sprite: Phaser.Types.Physics.Arcade.ImageWithStaticBody }[] = []
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private keys!: Record<'W' | 'A' | 'S' | 'D' | 'E' | 'T' | 'ENTER' | 'ESC', Phaser.Input.Keyboard.Key>
  private walk!: PlayerWalkAnimation
  private dialogue?: Phaser.GameObjects.Container
  private dialogueFocus?: TrainingFocus
  private trainingOpen = false
  private stadiumId = 'benfica_stadium'
  private dialogueCoach = false
  private checkingCoach = false
  private resume?: { x: number; y: number }
  private touch!: TouchControls
  private mobileDialogue!: MobileDialogue
  private recoveryArt?: RecoveryCenterArt
  private recoveryHint?: Phaser.GameObjects.Text
  private instructions?: Phaser.GameObjects.Text
  private refreshingRecovery = false

  constructor() { super('InteriorScene') }

  init(data: { key: string; stadiumId?: string; resume?: { x: number; y: number } }): void {
    const location = INTERIORS.find(place => place.key === data.key)
    if (!location) throw new Error(`Unknown interior: ${data.key}`)
    this.location = location
    this.stadiumId = data.stadiumId ?? 'benfica_stadium'
    this.resume = data.resume
  }

  create(): void {
    const restoreMusic = () => gameAudio.setMusic('city')
    restoreMusic()
    this.events.on(Phaser.Scenes.Events.WAKE, restoreMusic)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.WAKE, restoreMusic))
    this.recoveryArt = undefined
    this.recoveryHint = undefined
    this.refreshingRecovery = false
    this.trainingOpen = false
    this.checkingCoach = false
    this.dialogueFocus = undefined
    this.dialogue = undefined
    this.dialogueCoach = false
    const width = this.scale.width
    const height = this.scale.height
    this.add.rectangle(width / 2, height / 2, width, height, this.location.wallColor)
    this.add.rectangle(width / 2, 292, 832, 402, this.location.floorColor).setStrokeStyle(8, 0x26343b)
    const floor = this.add.graphics()
    floor.lineStyle(2, this.location.wallColor, 0.25)
    const gap = this.location.pattern === 'wood' ? 42 : this.location.pattern === 'mat' ? 80 : 64
    for (let x = 76; x < 900; x += gap) floor.lineBetween(x, 94, x, 490)
    for (let y = 94; y < 490; y += this.location.pattern === 'wood' ? 28 : gap) floor.lineBetween(76, y, 900, y)
    if (this.location.kind === 'gym' || this.location.kind === 'recovery') {
      this.add.text(480, 104, this.location.wallLabel, {
        fontFamily: 'monospace', fontSize: '15px', color: '#fff4ce', backgroundColor: '#152b32', padding: { x: 9, y: 3 },
      }).setOrigin(0.5)
    } else {
      this.add.rectangle(480, 126, 256, 40, this.location.accentColor).setStrokeStyle(3, 0x26343b)
      this.add.text(480, 126, this.location.wallLabel, {
        fontFamily: 'monospace', fontSize: '14px', color: '#152b32',
      }).setOrigin(0.5)
    }
    if (this.location.kind !== 'gym' && this.location.kind !== 'stadium' && this.location.kind !== 'recovery') this.add.rectangle(480, 354, 148, 76, this.location.accentColor, 0.34).setStrokeStyle(2, this.location.accentColor)
    this.add.text(480, 42, this.location.name.toUpperCase(), {
      fontFamily: 'monospace', fontSize: '26px', color: '#fff4ce', backgroundColor: '#152b32', padding: { x: 12, y: 5 },
    }).setOrigin(0.5)
    this.add.rectangle(480, 485, 90, 24, 0x594639)
    this.add.text(480, 478, 'SAÍDA', { fontFamily: 'monospace', fontSize: '16px', color: '#f7d154' }).setOrigin(0.5)
    this.instructions = this.add.text(16, height - 25, this.location.kind === 'gym'
      ? 'Setas / WASD: andar   E: conversar   Enter: iniciar após conversa   Esc: sair'
      : 'Setas / WASD: andar   E / Enter: conversar   Portas: passagem automática   Esc: sair', {
      fontFamily: 'monospace', fontSize: '15px', color: '#fff4ce', backgroundColor: '#152b32', padding: { x: 8, y: 3 },
    }).setDepth(100).setVisible(!isPhone())

    this.physics.world.setBounds(80, 100, 800, 390)
    const world = this.scene.get('WorldScene') as Phaser.Scene & { player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody }
    this.player = this.physics.add.sprite(this.resume?.x ?? 480, this.resume?.y ?? 435, 'coach', 'front-0')
      .setSize(18, 14).setOffset(7, 26).setCollideWorldBounds(true).setDepth(435)
    this.walk = new PlayerWalkAnimation(this.player)
    trackLocation(this, () => ({
      worldX: world.player.x, worldY: world.player.y,
      interior: { key: this.location.key, x: this.player.x, y: this.player.y },
    }))
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
    if (this.location.kind === 'recovery') {
      this.recoveryArt = new RecoveryCenterArt(this, this.player)
      this.recoveryHint = this.add.text(480, 520, '', { fontFamily: 'monospace', fontSize: '16px', color: '#fff4ce', backgroundColor: '#152b32', padding: { x: 8, y: 4 } }).setOrigin(0.5).setDepth(99)
      const refresh = () => { void this.refreshRecovery() }
      this.events.on(Phaser.Scenes.Events.WAKE, refresh)
      this.time.addEvent({ delay: 5000, loop: true, callback: () => { if (this.scene.isActive() && !this.trainingOpen) refresh() } })
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.WAKE, refresh))
      refresh()
    }
    if (this.location.kind === 'gym') this.drawTrainingCenter()
    if (this.location.kind === 'stadium') this.drawStadium()
    const residents = this.location.kind === 'gym'
      ? [...this.location.people, ...TRAINING_SECTORS.map(sector => ({
        name: sector.coach, dialogue: sector.dialogue, role: 'trainer' as const, focus: sector.focus,
        sprite: sector.sprite, x: sector.x + 76, y: sector.y + 34,
      }))]
      : this.location.people
    this.people = residents.map((person, index) => {
      const sprite = this.physics.add.staticImage(person.x, person.y, person.sprite)
      sprite.body.setSize(18, 14).setOffset(7, 26)
      sprite.setDepth(person.y)
      if (person.role === 'supporter') sprite.setTint(0xe9b3a2)
      this.physics.add.collider(this.player, sprite)
      this.tweens.add({ targets: sprite, y: person.y - 2, duration: 700 + index * 230, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      return { ...person, sprite }
    })
    const keyboard = this.input.keyboard!
    this.cursors = keyboard.createCursorKeys()
    this.keys = keyboard.addKeys('W,A,S,D,E,T,ENTER,ESC') as typeof this.keys
    this.touch = new TouchControls(this, () => {
      if (this.player.body) this.player.setVelocity(0, 0)
      keyboard.resetKeys()
      this.walk.stop()
    })
    this.mobileDialogue = new MobileDialogue(this)
    const team = button(document.getElementById('game')!, 'Equipe · T', () => this.openTeam())
    team.className = 'world-team-button'
    const hideTeam = () => { team.hidden = true }
    const showTeam = () => { team.hidden = false }
    this.events.on(Phaser.Scenes.Events.SLEEP, hideTeam)
    this.events.on(Phaser.Scenes.Events.WAKE, showTeam)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { team.remove(); this.events.off(Phaser.Scenes.Events.SLEEP, hideTeam); this.events.off(Phaser.Scenes.Events.WAKE, showTeam) })
    const animate = (_time: number, delta: number) => this.walk.update(Boolean(this.dialogue?.visible), delta)
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, animate)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.POST_UPDATE, animate))
    const resetInput = () => this.input.keyboard?.resetKeys()
    this.events.on(Phaser.Scenes.Events.WAKE, resetInput)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.WAKE, resetInput))
    if (this.location.kind === 'gym') {
      const trainer = this.people.find(person => person.role === 'trainer' && !person.focus)
      if (trainer) this.showDialogue(trainer.name, trainer.dialogue, 'Treinadora')
    }
  }

  update(): void {
    if (this.trainingOpen || this.checkingCoach || isPhonePortrait()) {
      this.touch.setContext({ visible: false })
      this.player.setVelocity(0, 0)
      return
    }
    const nearby = this.people.filter(person => canInteract(this.player.body.center, person.sprite.body.center))
      .sort((a, b) => Phaser.Math.Distance.Between(this.player.x, this.player.y, a.sprite.x, a.sprite.y)
        - Phaser.Math.Distance.Between(this.player.x, this.player.y, b.sprite.x, b.sprite.y))[0]
    const station = this.location.kind === 'recovery'
      ? RECOVERY_STATIONS.filter(item => canInteract(this.player.body.center, item)).sort((a, b) => Phaser.Math.Distance.Between(this.player.x, this.player.y, a.x, a.y) - Phaser.Math.Distance.Between(this.player.x, this.player.y, b.x, b.y))[0]
      : undefined
    const dialogueOpen = Boolean(this.dialogue?.visible)
    this.recoveryHint?.setText(!dialogueOpen && station ? `${station.label} · ${isPhone() ? 'toque em Recuperar' : 'E / Enter para escolher jogador'}` : '').setVisible(Boolean(!isPhone() && !dialogueOpen && station))
    this.instructions?.setVisible(!isPhone() && !(this.location.kind === 'recovery' && station && !dialogueOpen))
    const nearExit = Math.hypot(this.player.body.center.x - 480, this.player.body.center.y - 475) <= 24
    this.touch.setContext({
      visible: true, movement: !dialogueOpen, team: true,
      confirm: dialogueOpen ? this.dialogueCoach ? 'Desafiar' : this.dialogueFocus ? 'Treinar' : 'Continuar'
        : nearExit ? 'Sair' : station ? 'Recuperar' : nearby ? 'Conversar' : undefined,
      back: dialogueOpen ? 'Fechar' : 'Sair',
    })
    if (Phaser.Input.Keyboard.JustDown(this.keys.T) || this.touch.input.consume('team')) { this.openTeam(); return }
    const interact = Phaser.Input.Keyboard.JustDown(this.keys.E)
    const confirm = this.touch.input.consume('confirm')
    const enter = Phaser.Input.Keyboard.JustDown(this.keys.ENTER) || confirm
    const back = this.touch.input.consume('back')
    const escape = Phaser.Input.Keyboard.JustDown(this.keys.ESC) || back
    if (this.dialogue?.visible) {
      this.player.setVelocity(0, 0)
      if (enter && this.dialogueCoach) {
        this.dialogue.setVisible(false)
        this.mobileDialogue.close()
        this.dialogueCoach = false
        this.input.keyboard!.resetKeys()
        this.scene.sleep()
        this.scene.run('StadiumScene', { id: this.stadiumId })
        return
      }
      if (enter && this.dialogueFocus) {
        const focus = this.dialogueFocus
        this.dialogue.setVisible(false)
        this.mobileDialogue.close()
        this.dialogueFocus = undefined
        this.trainingOpen = true
        this.touch.setContext({ visible: false })
        this.input.keyboard!.resetKeys()
        const world = this.scene.get('WorldScene')
        void openTrainingPanel(this, focus, () => {
                this.trainingOpen = false
          this.checkingCoach = false
          this.input.keyboard?.resetKeys()
        }, roster => world.events.emit('roster-updated', roster))
        return
      }
      if (interact || enter || escape) {
        this.dialogue.setVisible(false)
        this.mobileDialogue.close()
        this.dialogueFocus = undefined
        this.dialogueCoach = false
      }
      return
    }
    if (escape || touchesDoor(this.player.body, { x: 480, y: 485 }, 90, 24) || ((interact || enter) && nearExit)) {
      this.leave()
      return
    }
    if ((interact || enter) && station) {
      this.openRecovery(station)
      return
    }
    if ((interact || enter) && nearby) {
      this.player.setVelocity(0, 0)
      this.dialogueFocus = nearby.focus
      if (nearby.role === 'stadium-coach') {
        void this.talkToCoach(nearby)
        return
      }
      this.dialogueCoach = false
      this.showDialogue(nearby.name, nearby.dialogue, nearby.role === 'supporter' ? 'Torcedor do time de Dimas'
        : nearby.role === 'trainer' || this.dialogueCoach ? 'Treinador(a)'
          : nearby.role === 'physiotherapist' ? 'Fisioterapia' : nearby.role === 'masseur' ? 'Massagem' : 'Morador')
      return
    }
    const touch = this.touch.input.directions
    const velocity = movementVelocity({
      left: this.cursors.left.isDown || this.keys.A.isDown || touch.left,
      right: this.cursors.right.isDown || this.keys.D.isDown || touch.right,
      up: this.cursors.up.isDown || this.keys.W.isDown || touch.up,
      down: this.cursors.down.isDown || this.keys.S.isDown || touch.down,
    })
    this.player.setVelocity(velocity.x, velocity.y)
    this.player.setDepth(this.player.y)
  }

  private async refreshRecovery(): Promise<void> {
    if (!this.recoveryArt || this.refreshingRecovery) return
    this.refreshingRecovery = true
    try {
      const roster = await teamApi.roster()
      if (!this.scene.isActive()) return
      await this.recoveryArt.showPatients(roster.flatMap(player => player.recovery ? [{ stationId: player.recovery.stationId, player }] : []))
    } catch { /* Preserve clinic ambience while offline; the selection panel offers retry. */ }
    finally { this.refreshingRecovery = false }
  }

  private openRecovery(station: RecoveryStation): void {
    this.player.setVelocity(0, 0)
    this.walk.stop()
    this.touch.reset()
    this.trainingOpen = true
    this.touch.setContext({ visible: false })
    this.recoveryHint?.setVisible(false)
    this.input.keyboard?.resetKeys()
    void openRecoveryPanel(this, station, () => {
      this.trainingOpen = false
      this.input.keyboard?.resetKeys()
      void this.refreshRecovery()
    }, roster => {
      this.scene.get('WorldScene').events.emit('roster-updated', roster)
      void this.recoveryArt?.showPatients(roster.flatMap(player => player.recovery ? [{ stationId: player.recovery.stationId, player }] : [])).catch(() => { /* Selection and recovery state remain available if a portrait cannot load. */ })
    })
  }

  private async talkToCoach(person: typeof this.people[number]): Promise<void> {
    this.checkingCoach = true
    this.dialogueCoach = false
    this.showDialogue(person.name, 'Deixe-me conferir seu elenco…', 'Treinador')
    try {
      const roster = await teamApi.roster()
      if (!this.scene.isActive()) return
      this.dialogueCoach = roster.length >= 5
      this.showDialogue(person.name, this.dialogueCoach ? person.dialogue
        : `Ainda não posso aceitar seu desafio. Você precisa ter pelo menos 5 jogadores no elenco! Seu time tem ${roster.length}. Vença desafiantes nas ruas e convide-os para completar o time.`, 'Treinador')
    } catch {
      if (this.scene.isActive()) this.showDialogue(person.name, 'Não consegui conferir seu elenco. Feche a conversa e fale comigo novamente para tentar.', 'Treinador')
    } finally { this.checkingCoach = false }
  }

  private showDialogue(name: string, words: string, role: string): void {
    if (this.dialogue) this.dialogue.destroy()
    const invitation = this.dialogueFocus ? '\nQuer treinar este fundamento?' : ''
    const prompt = this.dialogueCoach ? 'Enter para desafiar · E / Esc para fechar'
      : this.dialogueFocus ? 'Clique Enter para treinar · E / Esc para fechar' : 'Enter / E / Esc para fechar'
    const background = this.add.rectangle(0, 0, 912, 94, 0x152b32).setOrigin(0).setStrokeStyle(3, 0xf7d154)
    const text = this.add.text(18, 9, `${name} · ${role}\n${words}${invitation}\n${prompt}`, {
      fontFamily: 'monospace', fontSize: '16px', color: '#f5ead2', wordWrap: { width: 865 }, lineSpacing: 3,
    })
    this.dialogue = this.add.container(24, 76, [background, text]).setDepth(100)
    if (isPhone()) {
      background.setVisible(false)
      text.setVisible(false)
    }
    this.mobileDialogue.show(`${name} · ${role}`, `${words}${invitation}`)
  }

  private drawStadium(): void {
    const lines = this.add.graphics().setDepth(1)
    lines.lineStyle(3, 0xf5ead2, 0.8)
    lines.strokeRect(380, 215, 280, 160)
    lines.lineBetween(520, 215, 520, 375)
    lines.strokeCircle(520, 295, 30)
    lines.strokeRect(368, 265, 12, 60)
    lines.strokeRect(660, 265, 12, 60)
    for (const y of [170, 395]) {
      this.add.rectangle(520, y, 340, 16, 0x984f47).setStrokeStyle(2, 0xf5ead2)
    }
    this.add.text(520, 395, 'VAMOS, DIMAS!', { fontFamily: 'monospace', fontSize: '12px', color: '#fff4ce' }).setOrigin(0.5).setDepth(2)
    this.add.text(725, 215, 'E · TREINADOR', { fontFamily: 'monospace', fontSize: '12px', color: '#fff4ce', backgroundColor: '#763f41' }).setOrigin(0.5).setDepth(2)
    for (const x of [150, 820]) {
      const flag = this.add.rectangle(x, 175, 42, 24, 0x984f47).setStrokeStyle(3, 0xf5ead2).setOrigin(0, 0.5)
      this.tweens.add({ targets: flag, angle: { from: -8, to: 8 }, duration: 600, yoyo: true, repeat: -1 })
    }
  }

  private drawTrainingCenter(): void {
    for (const sector of TRAINING_SECTORS) {
      const { x, y, focus } = sector
      const color = focus === 'SPEED' || focus === 'DRIBBLING' ? 0x416b61
        : focus === 'FINISHING' ? 0x416478 : 0x685d76
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
      this.add.text(x + 77, y + 56, 'E · TREINADOR', { fontFamily: 'monospace', fontSize: '10px', color: '#f7d154', backgroundColor: '#152b32' })
        .setOrigin(0.5).setDepth(3)
    }
  }

  private openTeam(): void {
    if (this.trainingOpen || this.checkingCoach || !this.scene.isActive()) return
    this.player.setVelocity(0, 0)
    this.walk.stop()
    this.touch.reset()
    this.mobileDialogue.close()
    this.dialogue?.setVisible(false)
    this.input.keyboard?.resetKeys()
    this.scene.sleep()
    this.scene.run('TeamScene', { returnScene: 'InteriorScene' })
  }

  private leave(): void {
    this.input.keyboard?.resetKeys()
    this.player.setVelocity(0, 0)
    this.touch.reset()
    const world = this.scene.get('WorldScene') as WorldScene
    world.returnFromInterior(this.location.key)
    this.scene.stop()
    this.scene.wake('WorldScene')
  }
}
