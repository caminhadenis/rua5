import Phaser from 'phaser'
import { gameAudio } from '../audio/GameAudio'
import { TouchControls } from '../input/TouchControls'
import { isPhonePortrait } from '../input/mobileViewport'
import { RESIDENTS } from '../maps/residents'
import { INTERIORS } from '../maps/locations'
import { drawNeighborhoodArt } from '../maps/NeighborhoodArt'
import { challengerAsset, DEFAULT_TEAM_COLORS, starterUniformUrl, addWalkingTexture } from '../team/teamColors'
import { welcomeCoach } from '../ui/WelcomeCoach'
import { trackLocation, type SavedLocation } from '../save/location'
import type { Profile } from '../../api/gameApi'
import { ApiError, DuelCommand, stadiumApi, teamApi, type DuelResponse, type RosterPlayer, type ReleasedPlayer } from '../../api/gameApi'
import { button, paragraph, scenePanel } from '../ui/ScenePanel'

import { PlayerWalkAnimation } from '../entities/PlayerWalkAnimation'
import { movementVelocity } from '../input/movement'
import { ApproachDialogue, canDetectChallenger, canInteract, CHALLENGER, CHALLENGERS, CHALLENGER_DETECTION_RADIUS, type Facing } from '../maps/interactions'
import { PlayerCards } from '../ui/PlayerCards'
import { afterDuelDialogue } from '../maps/challengerDialogue'
import { ChallengerPatrol, patrolEndpoint } from '../maps/ChallengerPatrol'
import { WorldHud } from '../ui/WorldHud'
import { WorldMinimap } from '../ui/WorldMinimap'
import { touchesDoor, outsideDoor } from '../maps/doors'
import { GuidedWalk, walkingRoute } from '../maps/walkingRoute'

export class WorldScene extends Phaser.Scene {
  player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  challenger!: Phaser.Types.Physics.Arcade.ImageWithStaticBody
  hud!: WorldHud
  private stadiumPoint!: { x: number; y: number }
  private stadiumEntry!: Phaser.GameObjects.Text
  private stadiumId?: string
  private minimap!: WorldMinimap
  private guide?: { walk: GuidedWalk; leader: GuidedWalk; mentor: Phaser.GameObjects.Sprite; arrived: () => void }
  private doors: { key: string; x: number; y: number }[] = []
  private startData: { onboarding?: boolean; name?: string; profile?: Profile; location?: SavedLocation } = {}
  private activeChallenger = CHALLENGER
  private npcs: { content: typeof CHALLENGER | typeof RESIDENTS[number]; sprite: Phaser.Types.Physics.Arcade.ImageWithStaticBody; approach: ApproachDialogue; moving: boolean; facing: Facing; patrol?: ChallengerPatrol; walk: PlayerWalkAnimation }[] = []
  private obstacles!: Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer
  private mapSize!: { width: number; height: number }
  private released: ReleasedPlayer[] = []
  private roster: RosterPlayer[] = []
  private releasedNpcs: typeof this.npcs = []
  private encounterLocked = false
  private choosing = false
  private readonly duelCommand = new DuelCommand()
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private keys!: Record<'W' | 'A' | 'S' | 'D' | 'E' | 'T' | 'ENTER' | 'ESC', Phaser.Input.Keyboard.Key>
  private walkAnimation!: PlayerWalkAnimation
  private touch!: TouchControls

  constructor() {
    super('WorldScene')
  }

  init(data: typeof this.startData = {}): void { this.startData = data }

  create(): void {
    const restoreMusic = () => gameAudio.setMusic('city')
    restoreMusic()
    this.events.on(Phaser.Scenes.Events.WAKE, restoreMusic)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.WAKE, restoreMusic))
    const map = this.make.tilemap({ key: 'benfica' })
    const tiles = map.addTilesetImage('neighborhood', 'neighborhood-tiles')
    if (!tiles) throw new Error('Missing neighborhood tileset')
    map.createLayer('ground', tiles)
    const obstacles = map.createLayer('collisions', tiles)
    if (!obstacles) throw new Error('Missing collisions layer')
    obstacles.setCollisionByProperty({ collides: true })
    this.obstacles = obstacles
    this.mapSize = { width: map.widthInPixels, height: map.heightInPixels }

    for (const house of map.getObjectLayer('houses')?.objects ?? []) {
      this.add.image(house.x!, house.y!, 'house').setOrigin(0)
        .setDisplaySize(house.width!, house.height!).setDepth(1)
    }
    drawNeighborhoodArt(this, map)
    this.doors = INTERIORS.map(location => {
      const point = this.getMapPoint(map, 'interactions', location.key)
      this.add.rectangle(point.x, point.y - 12, 28, 8, 0xf7d154).setDepth(2)
      this.add.text(point.x, point.y + 10, 'ENTRAR', {
        fontFamily: 'monospace', fontSize: '11px', color: '#f7d154', backgroundColor: '#152b32',
      }).setOrigin(0.5).setDepth(3)
      return { key: location.key, ...point }
    })

    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels)
    const spawn = this.getMapPoint(map, 'spawns', 'benfica.entry')
    this.player = this.physics.add.sprite(this.startData.onboarding ? 464 : this.startData.location?.worldX ?? spawn.x,
      this.startData.onboarding ? 400 : this.startData.location?.worldY ?? spawn.y, 'coach', 'front-0')
      .setSize(18, 14).setOffset(7, 26).setCollideWorldBounds(true)
    this.walkAnimation = new PlayerWalkAnimation(this.player)
    this.physics.add.collider(this.player, obstacles)
    this.released = []
    this.roster = []
    this.releasedNpcs = []
    this.npcs = [...CHALLENGERS, ...RESIDENTS].map((content, index) => {
      const target = this.getMapPoint(map, 'interactions', content.spawnKey)
      const challengerTexture = content.kind === 'challenger' ? challengerAsset(content.playerDefinitionId) : 'challenger'
      const sprite = this.physics.add.staticImage(target.x, target.y, content.kind === 'resident' ? content.sprite : `walking-${challengerTexture}`,
        content.kind === 'resident' ? undefined : 'front-0')
      sprite.body.setSize(18, 14).setOffset(7, 26)
      sprite.setDepth(sprite.y)
      if (content.kind === 'resident') {
        this.tweens.add({ targets: sprite, y: target.y - 2, duration: 650 + index * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      }
      this.physics.add.collider(this.player, sprite)
      const visible = content.kind === 'resident'
      sprite.setVisible(visible).setActive(visible)
      sprite.body.enable = visible
      return { content, sprite, walk: new PlayerWalkAnimation(sprite), approach: new ApproachDialogue(), moving: false,
        facing: content.kind === 'challenger' ? content.facing : 'down' }
    })
    for (const [index, npc] of this.npcs.entries()) {
      if (npc.content.kind === 'challenger') npc.patrol = this.createPatrol(npc, index)
    }
    this.challenger = this.npcs[0]!.sprite
    this.activeChallenger = CHALLENGER

    this.stadiumPoint = this.getMapPoint(map, 'interactions', 'benfica.stadium.entry')
    this.stadiumEntry = this.add.text(this.stadiumPoint.x, this.stadiumPoint.y - 56, 'ESTÁDIO · ENTRADA', {
      fontFamily: 'monospace', fontSize: '16px', color: '#f7d154', backgroundColor: '#152b32', padding: { x: 8, y: 8 },
    }).setOrigin(0.5).setDepth(900).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.openStadium())
    const refreshStadium = () => {
      void stadiumApi.list().then(stadiums => {
        if (!this.scene.isActive()) return
        const stadium = stadiums.find(s => s.spawnKey === 'benfica.stadium.entry' && s.mapId === 'benfica')
        this.hud.setCompleted(stadium?.status === 'COMPLETED')
        this.stadiumId = stadium?.id
        this.stadiumEntry.setText(stadium?.status === 'COMPLETED' ? 'ESTÁDIO · CONQUISTADO' : 'ESTÁDIO · ENTRADA')
      }).catch(() => { this.stadiumEntry.setText('ESTÁDIO · ENTRADA') })
    }
    refreshStadium()
    this.events.on(Phaser.Scenes.Events.WAKE, refreshStadium)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.WAKE, refreshStadium))

    const court = map.getObjectLayer('landmarks')?.objects.find(object => object.name === 'court')
    if (court) {
      const { x = 0, y = 0, width = 0, height = 0 } = court
      const lines = this.add.graphics().lineStyle(3, 0xf5ead2, 0.8)
      lines.strokeRect(x, y, width, height)
      lines.lineBetween(x, y + height / 2, x + width, y + height / 2)
      lines.strokeCircle(x + width / 2, y + height / 2, 44)
      lines.strokeRect(x + width / 2 - 48, y, 96, 48)
      lines.strokeRect(x + width / 2 - 48, y + height - 48, 96, 48)
    }

    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels)
      .startFollow(this.player, true, 0.12, 0.12)
    const keyboard = this.input.keyboard
    if (!keyboard) throw new Error('Keyboard input is required')
    this.cursors = keyboard.createCursorKeys()
    this.keys = keyboard.addKeys('W,A,S,D,E,T,ENTER,ESC') as typeof this.keys
    this.choosing = false
    this.guide = undefined
    this.encounterLocked = false
    this.hud = new WorldHud(this, () => { void this.choosePlayer() })
    this.minimap = new WorldMinimap(this, map)
    this.touch = new TouchControls(this, () => {
      if (this.player.body) this.player.setVelocity(0, 0)
      keyboard.resetKeys()
      this.walkAnimation.stop()
    })
    const team = button(document.getElementById('game')!, 'Equipe · T', () => this.openTeam())
    team.className = 'world-team-button'
    team.hidden = Boolean(this.startData.onboarding)
    const hideTeam = () => { team.hidden = true }
    const showTeam = () => { team.hidden = false; keyboard.resetKeys() }
    this.events.on(Phaser.Scenes.Events.SLEEP, hideTeam)
    this.events.on(Phaser.Scenes.Events.WAKE, showTeam)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      team.remove()
      this.events.off(Phaser.Scenes.Events.SLEEP, hideTeam)
      this.events.off(Phaser.Scenes.Events.WAKE, showTeam)
    })
    const updateRoster = (roster: RosterPlayer[]) => {
      this.roster = roster
      this.hud.setRoster(roster)
      const owned = new Set(roster.map(player => player.playerDefinitionId))
      for (const npc of this.npcs) {
        if (npc.content.kind !== 'challenger') continue
        const definitionId = npc.content.playerDefinitionId
        const visible = !owned.has(definitionId) &&
          (this.releasedNpcs.includes(npc) || !this.released.some(player => player.playerDefinitionId === definitionId))
        npc.sprite.setVisible(visible).setActive(visible)
        npc.sprite.body.enable = visible && !npc.moving
        if (!visible && npc.content.id === this.activeChallenger.id) this.hud.closeDialogue()
      }
    }
    const updateReleased = (released: ReleasedPlayer[]) => {
      void this.setReleasedPlayers(released).then(() => updateRoster(this.roster))
    }
    this.events.on('released-updated', updateReleased)
    this.events.on('roster-updated', updateRoster)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off('released-updated', updateReleased))
    const showAfterDuel = (outcome: DuelResponse['match']['outcome'], opponentName: string) => {
      keyboard.resetKeys()
      if (this.npcs.some(npc => npc.content === this.activeChallenger && npc.sprite.active)) {
        this.hud.openDialogue(opponentName, afterDuelDialogue(outcome), true)
      }
    }
    this.events.on('duel-finished', showAfterDuel)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off('duel-finished', showAfterDuel))
    const loadRoster = async () => {
      try {
        const [roster, released] = await Promise.all([teamApi.roster(), teamApi.released()])
        if (!this.scene.isActive()) return
        await this.setReleasedPlayers(released)
        if (this.scene.isActive()) updateRoster(roster)
      } catch {
        if (!this.scene.isActive()) return
        const panel = scenePanel(this, 'Carregar elenco')
        paragraph(panel, 'Não foi possível carregar os jogadores do bairro.')
        button(panel, 'Tentar novamente', () => { panel.dispose(); void loadRoster() })
      }
    }
    this.events.on(Phaser.Scenes.Events.WAKE, loadRoster)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.WAKE, loadRoster))
    if (this.startData.onboarding) {
      this.choosing = true
      welcomeCoach(this, this.player, this.startData.name ?? 'Treinador', this.startData.profile, () => {
        this.choosing = false
        this.startData.onboarding = false
        team.hidden = false
        void loadRoster()
        refreshStadium()
      }, (mentor, arrived) => this.guideToTraining(mentor, arrived), () => this.enterInterior('benfica.gym.entry'))
    } else void loadRoster()
    trackLocation(this, () => ({ worldX: this.player.x, worldY: this.player.y }))
    const resume = this.startData.location?.interior
    if (resume) {
      // Restoring an interior takes precedence over automatically touching its exterior door.
      this.choosing = true
      this.events.once(Phaser.Scenes.Events.WAKE, () => { this.choosing = false })
      this.time.delayedCall(0, () => {
        this.scene.sleep()
        this.scene.run('InteriorScene', { key: resume.key, resume })
      })
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off('roster-updated', updateRoster))
    const animateWalk = (_time: number, delta: number) => {
      if (!this.guide) this.walkAnimation.update(this.hud.isDialogueOpen, delta)
    }
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, animateWalk)

    const stopMovement = () => {
      keyboard.resetKeys()
      this.player.setVelocity(0, 0)
      this.walkAnimation.stop()
    }
    this.game.events.on(Phaser.Core.Events.BLUR, stopMovement)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.BLUR, stopMovement)
      this.events.off(Phaser.Scenes.Events.POST_UPDATE, animateWalk)
    })
  }

  update(_time: number, delta: number): void {
    this.minimap.update(this.player.body.center, !isPhonePortrait() && !this.hud.isDialogueOpen &&
      !document.getElementById('game')!.querySelector('.scene-panel:not([hidden])'))
    if (this.guide) {
      this.touch.setContext({ visible: false })
      this.player.setVelocity(0, 0)
      if (isPhonePortrait()) return
      const { walk, leader, mentor, arrived } = this.guide
      walk.step(delta)
      leader.step(delta)
      this.player.body.reset(walk.position.x, walk.position.y)
      this.walkAnimation.update(false, delta, true)
      this.player.setDepth(this.player.y)
      // Miguel follows the same safe route a short distance ahead of the trainer.
      mentor.setPosition(leader.position.x, leader.position.y).setDepth(leader.position.y)
      mentor.setData('walking', !leader.finished)
      if (walk.finished) {
        this.guide = undefined
        this.walkAnimation.stop()
        mentor.setPosition(this.player.x + 38, this.player.y).setDepth(this.player.y).setData('walking', false)
        const mentorWalk = mentor.getData('walkAnimation') as PlayerWalkAnimation
        mentorWalk.face(this.facingToward(mentor, this.player))
        arrived()
      }
      return
    }
    const blocked = this.choosing || isPhonePortrait() || Boolean(document.getElementById('game')!.querySelector('.scene-panel'))
    this.updatePatrols(delta, blocked || this.encounterLocked || this.hud.isDialogueOpen)
    if (blocked) {
      this.touch.setContext({ visible: false })
      this.player.setVelocity(0, 0)
      return
    }
    if (this.encounterLocked) {
      this.touch.setContext({ visible: true, movement: false })
      this.player.setVelocity(0, 0)
      return
    }
    const touching = !this.hud.isDialogueOpen && this.doors.find(door => touchesDoor(this.player.body, door))
    if (touching) {
      if (touching.key === 'benfica.stadium.entry') this.openStadium()
      else this.enterInterior(touching.key)
      return
    }
    const nearStadium = canInteract(this.player.body.center, this.stadiumPoint)
    const nearbyDoor = this.doors.find(door => canInteract(this.player.body.center, door))
    const nearbyNpc = this.npcs.find(npc => npc.sprite.active && canInteract(this.player.body.center, npc.sprite.body.center))
    this.touch.setContext({
      visible: true, movement: !this.hud.isDialogueOpen, team: true,
      confirm: this.hud.isDialogueOpen ? (this.hud.canChallenge ? 'Desafiar' : 'Continuar')
        : nearStadium || nearbyDoor ? 'Entrar' : nearbyNpc ? 'Conversar' : undefined,
      back: this.hud.isDialogueOpen ? 'Fechar' : undefined,
    })
    const team = this.touch.input.consume('team')
    if (Phaser.Input.Keyboard.JustDown(this.keys.T) || team) { this.openTeam(); return }
    // Consume both keys each frame so simultaneous presses cannot reopen a dialogue.
    const interact = Phaser.Input.Keyboard.JustDown(this.keys.E)
    const confirm = this.touch.input.consume('confirm')
    const enter = Phaser.Input.Keyboard.JustDown(this.keys.ENTER) || confirm
    if (!this.hud.isDialogueOpen && (interact || enter) && canInteract(this.player.body.center, this.stadiumPoint)) { this.openStadium(); return }
    if (!this.hud.isDialogueOpen && (interact || enter) && nearbyDoor) { this.enterInterior(nearbyDoor.key); return }
    const back = this.touch.input.consume('back')
    const escape = Phaser.Input.Keyboard.JustDown(this.keys.ESC) || back
    for (const npc of this.npcs) {
      if (npc.content.kind === 'challenger' && npc.sprite.active && !this.encounterLocked && !this.hud.isDialogueOpen &&
          npc.approach.update(this.player.body.center, npc.sprite.body.center)) {
        this.beginChallengerApproach(npc)
        return
      }
    }
    const nearby = nearbyNpc !== undefined
    if (this.hud.isDialogueOpen) {
      if (enter && this.hud.canChallenge) { void this.choosePlayer(); return }
      if (interact || enter || escape) this.hud.closeDialogue()
    } else if ((interact || enter) && nearby &&
      (nearbyNpc!.content.kind === 'resident' || canDetectChallenger(this.player.body.center, nearbyNpc!.sprite.body.center))) {
      const content = nearbyNpc!.content
      if (content.kind === 'challenger') this.activeChallenger = content
      this.hud.openDialogue(content.name, content.dialogue, false, content.kind)
    }
    const touch = this.touch.input.directions
    const velocity = movementVelocity({
      left: this.cursors.left.isDown || this.keys.A.isDown || touch.left,
      right: this.cursors.right.isDown || this.keys.D.isDown || touch.right,
      up: this.cursors.up.isDown || this.keys.W.isDown || touch.up,
      down: this.cursors.down.isDown || this.keys.S.isDown || touch.down,
    }, this.hud.isDialogueOpen || this.encounterLocked)
    this.player.setVelocity(velocity.x, velocity.y)
    this.player.setDepth(this.player.y)
    this.challenger.setDepth(this.challenger.y)
    this.hud.showPrompt(nearby || Boolean(nearbyDoor) || nearStadium, nearbyDoor || nearStadium ? 'Entrar' : 'Conversar')
  }

  returnFromInterior(key: string): void {
    const door = this.doors.find(place => place.key === key)
    if (door) {
      const outside = outsideDoor(key, door)
      this.player.body.reset(outside.x, outside.y)
    }
    this.player.setVelocity(0, 0)
    this.walkAnimation.stop()
    this.touch.reset()
    this.input.keyboard?.resetKeys()
  }

  private guideToTraining(mentor: Phaser.GameObjects.Sprite, arrived: () => void): boolean {
    const door = this.doors.find(place => place.key === 'benfica.gym.entry')!
    const destination = { x: door.x, y: door.y + 64 }
    const route = walkingRoute(this.player, destination, this.mapSize.width, this.mapSize.height, point =>
      this.isPatrolSpace(point) && !this.npcs.some(npc => npc.sprite.active &&
        Math.abs(npc.sprite.x - point.x) < 28 && Math.abs(npc.sprite.y - point.y) < 22))
    if (!route.length) return false
    this.input.keyboard?.resetKeys()
    this.touch.reset()
    const leader = new GuidedWalk(route)
    for (let step = 0; step < 4; step++) leader.step(50)
    this.guide = { walk: new GuidedWalk(route), leader, mentor, arrived }
    return true
  }

  private isPatrolSpace(point: { x: number; y: number }): boolean {
    // The collision body covers the feet: 18×14, offset (7, 26) in a 32×40 sprite.
    for (const x of [point.x - 9, point.x + 9 - 0.001]) {
      for (const y of [point.y + 6, point.y + 20 - 0.001]) {
        if (x < 0 || y < 0 || x >= this.mapSize.width || y >= this.mapSize.height ||
            this.obstacles.getTileAtWorldXY(x, y)?.collides) return false
      }
    }
    return true
  }

  private createPatrol(npc: typeof this.npcs[number], index: number): ChallengerPatrol {
    const origin = { x: npc.sprite.x, y: npc.sprite.y }
    return new ChallengerPatrol(origin, patrolEndpoint(origin, index, point => this.isPatrolSpace(point)), index)
  }

  private updatePatrols(delta: number, paused: boolean): void {
    for (const npc of this.npcs) {
      if (!npc.patrol || !npc.sprite.active || npc.moving) continue
      // Keep a greeted NPC still until the trainer leaves the encounter area.
      const nearby = Math.hypot(this.player.body.center.x - npc.sprite.body.center.x,
        this.player.body.center.y - npc.sprite.body.center.y) <= CHALLENGER_DETECTION_RADIUS + 20
      npc.patrol.update(delta, paused || nearby, point => this.isPatrolSpace(point) &&
        !this.npcs.some(other => other !== npc && other.sprite.active &&
          Math.abs(other.sprite.x - point.x) < 22 && Math.abs(other.sprite.y - point.y) < 18))
      const point = npc.patrol.position
      npc.sprite.body.reset(point.x, point.y)
      npc.walk.update(!npc.patrol.walking, delta, npc.patrol.walking)
      npc.sprite.setDepth(point.y)
      if (npc.patrol.walking) {
        npc.facing = npc.patrol.facing
        npc.sprite.setData('facing', npc.facing)
      }
    }
  }

  private async setReleasedPlayers(released: ReleasedPlayer[]): Promise<void> {
    this.released = released
    for (const player of released) {
      if (player.playerDefinitionId.startsWith('starter_')) {
        const key = `released-${player.playerDefinitionId}`
        if (!this.textures.exists(key)) await addWalkingTexture(this, key, starterUniformUrl(player.playerDefinitionId, DEFAULT_TEAM_COLORS))
      }
    }
    if (!this.scene.isActive() && !this.scene.isSleeping()) return
    // Keep existing sprites when location is unchanged, preserving approach state.
    for (const npc of [...this.releasedNpcs]) {
      const player = released.find(p => npc.content.kind === 'challenger' && p.id === npc.content.id)
      if (player && npc.sprite.getData('spawnX') === player.x && npc.sprite.getData('spawnY') === player.y) continue
      this.tweens.killTweensOf(npc.sprite)
      npc.sprite.destroy()
      this.npcs = this.npcs.filter(item => item !== npc)
      this.releasedNpcs = this.releasedNpcs.filter(item => item !== npc)
    }
    for (const player of released) {
      if (this.releasedNpcs.some(npc => npc.content.kind === 'challenger' && npc.content.id === player.id)) continue
      const starter = player.playerDefinitionId.startsWith('starter_')
      const sprite = this.physics.add.staticImage(player.x, player.y,
        starter ? `released-${player.playerDefinitionId}` : `walking-${challengerAsset(player.playerDefinitionId)}`, 'front-0')
      sprite.setData('spawnX', player.x).setData('spawnY', player.y)
      sprite.body.setSize(18, 14).setOffset(7, 26)
      sprite.setDepth(player.y)
      this.physics.add.collider(this.player, sprite)
      const npc: typeof this.npcs[number] = {
        content: { ...player, kind: 'challenger', spawnKey: `released.${player.id}`, facing: 'down',
          dialogue: `Agora estou treinando por aqui. Podemos jogar um desafio ou você pode me convidar novamente pela Equipe.` },
        sprite, walk: new PlayerWalkAnimation(sprite), approach: new ApproachDialogue(), moving: false, facing: 'down',
      }
      // The trainer can walk away before this newly released NPC notices them.
      npc.approach.update(this.player.body.center, sprite.body.center)
      this.releasedNpcs.push(npc)
      this.npcs.push(npc)
      npc.patrol = this.createPatrol(npc, this.npcs.length - 1)
    }
  }

  private beginChallengerApproach(npc: typeof this.npcs[number]): void {
    gameAudio.play('attention')
    this.encounterLocked = true
    this.touch.reset()
    npc.moving = true
    npc.sprite.body.enable = false
    this.player.setVelocity(0, 0)
    this.walkAnimation.stop()
    this.input.keyboard!.resetKeys()
    this.hud.showPrompt(false)
    this.activeChallenger = npc.content as typeof CHALLENGER
    const dx = this.player.x - npc.sprite.x
    const dy = this.player.y - npc.sprite.y
    const length = Math.max(1, Math.hypot(dx, dy))
    const stopDistance = 36
    const targetX = this.player.x - dx / length * stopDistance
    const targetY = this.player.y - dy / length * stopDistance
    this.tweens.killTweensOf(npc.sprite)
    const alert = this.add.text(npc.sprite.x, npc.sprite.y - 38, '!', {
      fontFamily: 'monospace', fontSize: '24px', color: '#f7d154',
    }).setOrigin(0.5).setDepth(1000)
    this.tweens.add({ targets: alert, y: alert.y - 10, alpha: 0, duration: 650,
      onComplete: () => alert.destroy() })
    this.tweens.add({ targets: npc.sprite, x: targetX, y: targetY,
      duration: 850, ease: 'Linear',
      onUpdate: () => {
        npc.walk.update(false, this.game.loop.delta, true)
        npc.sprite.setDepth(npc.sprite.y)
      },
      onComplete: () => {
        if (!this.scene.isActive() || !npc.sprite.active) return
        npc.sprite.setPosition(targetX, targetY)
        npc.sprite.body.reset(targetX, targetY)
        npc.sprite.body.enable = true
        npc.sprite.setDepth(npc.sprite.y)
        npc.moving = false
        npc.facing = this.facingToward(npc.sprite, this.player)
        npc.walk.face(npc.facing)
        npc.sprite.setData('facing', npc.facing)
        npc.patrol = this.createPatrol(npc, this.npcs.indexOf(npc))
        this.facePlayer(this.facingToward(this.player, npc.sprite))
        this.encounterLocked = false
        this.input.keyboard!.resetKeys()
        this.hud.openDialogue(npc.content.name, npc.content.dialogue)
      },
    })
  }

  private facingToward(from: { x: number; y: number }, to: { x: number; y: number }): Facing {
    const dx = to.x - from.x
    const dy = to.y - from.y
    return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down')
  }

  private facePlayer(facing: Facing): void {
    this.walkAnimation.face(facing)
  }

  private async choosePlayer(): Promise<void> {
    if (this.choosing || !this.hud.canChallenge) return
    this.choosing = true
    this.touch.setContext({ visible: false })
    this.player.setVelocity(0, 0)
    this.input.keyboard!.resetKeys()
    this.input.keyboard!.enabled = false
    const captureKeys = this.input.keyboard!.manager.preventDefault
    this.input.keyboard!.disableGlobalCapture()
    const restoreCapture = () => { this.input.keyboard!.manager.preventDefault = captureKeys }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, restoreCapture)
    const challenger = this.activeChallenger
    const panel = scenePanel(this, `Desafiar ${challenger.name}`)
    panel.classList.add('player-selection-panel', 'duel-selection-panel')
    const close = (keepMusic = false) => {
      if (!keepMusic) gameAudio.setMusic('city')
      panel.dispose()
      restoreCapture()
      this.events.off(Phaser.Scenes.Events.SHUTDOWN, restoreCapture)
      this.choosing = false
      this.hud.closeDialogue()
      this.input.keyboard!.enabled = true
      this.input.keyboard!.resetKeys()
    }
    const load = async () => {
      panel.replaceChildren()
      paragraph(panel, 'Carregando elenco…')
      try {
        const [roster, opponent] = await Promise.all([teamApi.roster(), teamApi.challenge(challenger.id)])
        if (!this.scene.isActive()) return
        panel.replaceChildren()
        paragraph(panel, 'DUELO NA QUADRA · 1 × 1').className = 'selection-eyebrow'
        const title = document.createElement('h2')
        title.textContent = 'Quem entra em quadra?'
        panel.append(title)
        paragraph(panel, `Adversário: ${opponent.name} · Nv. ${opponent.level}. Escolha seu jogador.`).className = 'selection-description'
        const cards = new PlayerCards(roster)
        panel.append(cards.element)
        paragraph(panel, 'Duelo: +18 de cansaço. Revanches rendem menos XP.').className = 'selection-hint'
        const status = paragraph(panel, '')
        status.className = 'selection-status'
        const actions = document.createElement('div')
        actions.className = 'selection-actions'
        panel.append(actions)
        const cancel = button(actions, 'Voltar', close)
        const start = button(actions, 'Iniciar desafio', () => {
          const selectedId = cards.selectedId
          if (!selectedId) return
          start.disabled = true
          cancel.disabled = true
          cards.disabled = true
          status.textContent = 'Simulando duelo…'
          gameAudio.setMusic('duel')
          void this.duelCommand.play(challenger.id, selectedId).then(result => {
            if (!this.scene.isActive()) return
            close(true)
            this.transitionToMatch(result)
          }).catch((error: unknown) => {
            if (!this.scene.isActive()) return
            gameAudio.setMusic('city')
            if (error instanceof ApiError && error.rejected) {
              status.textContent = error.code === 'PROFILE_NOT_FOUND'
                ? 'Sua sessão expirou. Recarregue a página para começar novamente.'
                : 'Este desafio não está disponível para o jogador selecionado. Volte ao bairro e tente novamente.'
              cancel.disabled = false
              return
            }
            status.textContent = 'Não foi possível receber a partida. Tente novamente para recuperar o mesmo desafio.'
            start.textContent = 'Tentar novamente'
            start.disabled = false
          })
        })
        start.disabled = !cards.selectedId
        cards.element.addEventListener('fatigue-updated', () => { if (!cards.element.disabled) start.disabled = !cards.selectedId })
      } catch {
        panel.replaceChildren()
        paragraph(panel, 'Não foi possível carregar o elenco.')
        button(panel, 'Tentar novamente', () => { void load() })
        button(panel, 'Voltar', close)
      }
    }
    await load()
  }

  private transitionToMatch(result: DuelResponse): void {
    const curtain = document.createElement('div')
    curtain.className = 'scene-transition scene-transition-close'
    curtain.setAttribute('aria-hidden', 'true')
    document.getElementById('game')!.append(curtain)
    window.setTimeout(() => {
      if (!this.scene.isActive()) { curtain.remove(); return }
      this.scene.sleep()
      this.scene.run('MatchScene', result)
      curtain.classList.remove('scene-transition-close')
      curtain.classList.add('scene-transition-open')
      window.setTimeout(() => curtain.remove(), 240)
    }, 240)
  }

  private openStadium(): void {
    if (this.choosing || !this.scene.isActive() || !canInteract(this.player.body.center, this.stadiumPoint)) return
    // Stable content ID fallback permits recovery when the state request failed.
    this.player.setVelocity(0, 0)
    this.walkAnimation.stop()
    this.hud.closeDialogue()
    this.input.keyboard!.resetKeys()
    this.scene.sleep()
    this.scene.run('InteriorScene', { key: 'benfica.stadium.entry', stadiumId: this.stadiumId ?? 'benfica_stadium' })
  }

  private enterInterior(key: string): void {
    this.player.setVelocity(0, 0)
    this.walkAnimation.stop()
    this.input.keyboard!.resetKeys()
    this.scene.sleep()
    this.scene.run('InteriorScene', { key })
  }

  private openTeam(): void {
    if (this.choosing || this.encounterLocked || !this.scene.isActive()) return
    this.input.keyboard!.resetKeys()
    this.player.setVelocity(0, 0)
    this.walkAnimation.stop()
    this.hud.closeDialogue()
    this.scene.sleep()
    this.scene.run('TeamScene')
  }

  private getMapPoint(map: Phaser.Tilemaps.Tilemap, layer: string, spawnKey: string) {
    const point = map.getObjectLayer(layer)?.objects.find(object =>
      object.properties?.some((property: { name: string; value: unknown }) =>
        property.name === 'spawnKey' && property.value === spawnKey),
    )
    if (point?.x === undefined || point.y === undefined) throw new Error(`Missing map point: ${spawnKey}`)
    return { x: point.x, y: point.y }
  }
}
