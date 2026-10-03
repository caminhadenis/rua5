import Phaser from 'phaser'
import { RESIDENTS } from '../maps/residents'
import { INTERIORS } from '../maps/locations'
import { drawNeighborhoodArt } from '../maps/NeighborhoodArt'
import { applyStarterAppearance, challengerAsset } from '../team/teamColors'
import { ApiError, DuelCommand, request, stadiumApi, teamApi, type DuelResponse, type RosterPlayer } from '../../api/gameApi'
import { button, paragraph, scenePanel } from '../ui/ScenePanel'

import { PlayerWalkAnimation } from '../entities/PlayerWalkAnimation'
import { movementVelocity } from '../input/movement'
import { ApproachDialogue, canDetectChallenger, canInteract, CHALLENGER, CHALLENGERS, type Facing } from '../maps/interactions'
import { PlayerCards } from '../ui/PlayerCards'
import { afterDuelDialogue } from '../maps/challengerDialogue'
import { WorldHud } from '../ui/WorldHud'

export class WorldScene extends Phaser.Scene {
  player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  challenger!: Phaser.Types.Physics.Arcade.ImageWithStaticBody
  hud!: WorldHud
  private stadiumPoint!: { x: number; y: number }
  private stadiumEntry!: Phaser.GameObjects.Text
  private stadiumId?: string
  private doors: { key: string; x: number; y: number }[] = []
  private appearanceId?: string
  private activeChallenger = CHALLENGER
  private npcs: { content: typeof CHALLENGER | typeof RESIDENTS[number]; sprite: Phaser.Types.Physics.Arcade.ImageWithStaticBody; approach: ApproachDialogue; moving: boolean; facing: Facing }[] = []
  private encounterLocked = false
  private choosing = false
  private readonly duelCommand = new DuelCommand()
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private keys!: Record<'W' | 'A' | 'S' | 'D' | 'E' | 'T' | 'ENTER' | 'ESC', Phaser.Input.Keyboard.Key>
  private walkAnimation!: PlayerWalkAnimation

  constructor() {
    super('WorldScene')
  }

  create(): void {
    const map = this.make.tilemap({ key: 'benfica' })
    const tiles = map.addTilesetImage('neighborhood', 'neighborhood-tiles')
    if (!tiles) throw new Error('Missing neighborhood tileset')
    map.createLayer('ground', tiles)
    const obstacles = map.createLayer('collisions', tiles)
    if (!obstacles) throw new Error('Missing collisions layer')
    obstacles.setCollisionByProperty({ collides: true })

    for (const house of map.getObjectLayer('houses')?.objects ?? []) {
      this.add.image(house.x!, house.y!, 'house').setOrigin(0)
        .setDisplaySize(house.width!, house.height!).setDepth(1)
    }
    drawNeighborhoodArt(this, map)
    this.doors = INTERIORS.map(location => {
      const point = this.getMapPoint(map, 'interactions', location.key)
      this.add.rectangle(point.x, point.y - 12, 28, 8, 0xf7d154).setDepth(2)
      this.add.text(point.x, point.y + 10, 'ENTRAR · E', {
        fontFamily: 'monospace', fontSize: '11px', color: '#f7d154', backgroundColor: '#152b32',
      }).setOrigin(0.5).setDepth(3)
      return { key: location.key, ...point }
    })

    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels)
    const spawn = this.getMapPoint(map, 'spawns', 'benfica.entry')
    this.player = this.physics.add.sprite(spawn.x, spawn.y, 'team-player', 'front-0')
      .setSize(18, 14).setOffset(7, 26).setCollideWorldBounds(true)
    this.walkAnimation = new PlayerWalkAnimation(this.player)
    this.physics.add.collider(this.player, obstacles)
    this.npcs = [...CHALLENGERS, ...RESIDENTS].map((content, index) => {
      const target = this.getMapPoint(map, 'interactions', content.spawnKey)
      const challengerTexture = content.kind === 'challenger' ? challengerAsset(content.playerDefinitionId) : 'challenger'
      const sprite = this.physics.add.staticImage(target.x, target.y, content.kind === 'resident' ? content.sprite : challengerTexture)
      sprite.body.setSize(18, 14).setOffset(7, 26)
      sprite.setDepth(sprite.y)
      this.tweens.add({ targets: sprite, y: target.y - 2, duration: 650 + index * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
      this.physics.add.collider(this.player, sprite)
      const visible = content.kind === 'resident'
      sprite.setVisible(visible).setActive(visible)
      sprite.body.enable = visible
      return { content, sprite, approach: new ApproachDialogue(), moving: false,
        facing: content.kind === 'challenger' ? content.facing : 'down' }
    })
    this.challenger = this.npcs[0]!.sprite
    this.activeChallenger = CHALLENGER

    this.stadiumPoint = this.getMapPoint(map, 'interactions', 'benfica.stadium.entry')
    this.stadiumEntry = this.add.text(this.stadiumPoint.x, this.stadiumPoint.y - 56, 'ESTÁDIO · E / Enter', {
      fontFamily: 'monospace', fontSize: '16px', color: '#f7d154', backgroundColor: '#152b32', padding: { x: 8, y: 8 },
    }).setOrigin(0.5).setDepth(900).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.openStadium())
    const refreshStadium = () => {
      void stadiumApi.list().then(stadiums => {
        if (!this.scene.isActive()) return
        const stadium = stadiums.find(s => s.spawnKey === 'benfica.stadium.entry' && s.mapId === 'benfica')
        this.hud.setCompleted(stadium?.status === 'COMPLETED')
        this.stadiumId = stadium?.id
        this.stadiumEntry.setText(stadium?.status === 'COMPLETED' ? 'ESTÁDIO · CONQUISTADO' : 'ESTÁDIO · E / Enter')
      }).catch(() => { this.stadiumEntry.setText('ESTÁDIO · E / Enter') })
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
    this.encounterLocked = false
    this.hud = new WorldHud(this, () => { void this.choosePlayer() })
    const team = button(document.getElementById('game')!, 'Equipe · T', () => this.openTeam())
    team.className = 'world-team-button'
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
      this.hud.setRoster(roster)
      const starter = roster.find(player => player.playerDefinitionId.startsWith('starter_'))
      if (starter && starter.playerDefinitionId !== this.appearanceId) {
        this.appearanceId = starter.playerDefinitionId
        void applyStarterAppearance(this, starter.playerDefinitionId).then(key => {
          if (this.player.active) this.player.setTexture(key, 'front-0')
        }).catch(() => { this.appearanceId = undefined })
      }
      const owned = new Set(roster.map(player => player.playerDefinitionId))
      for (const npc of this.npcs) {
        if (npc.content.kind !== 'challenger') continue
        const visible = !owned.has(npc.content.playerDefinitionId)
        npc.sprite.setVisible(visible).setActive(visible)
        npc.sprite.body.enable = visible && !npc.moving
        if (!visible && npc.content.id === this.activeChallenger.id) this.hud.closeDialogue()
      }
    }
    this.events.on('roster-updated', updateRoster)
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
        const roster = await request<RosterPlayer[]>('/roster')
        if (this.scene.isActive()) updateRoster(roster)
      } catch {
        if (!this.scene.isActive()) return
        const panel = scenePanel(this, 'Carregar elenco')
        paragraph(panel, 'Não foi possível carregar os jogadores do bairro.')
        button(panel, 'Tentar novamente', () => { panel.dispose(); void loadRoster() })
      }
    }
    void loadRoster()
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off('roster-updated', updateRoster))
    const animateWalk = (_time: number, delta: number) => this.walkAnimation.update(this.hud.isDialogueOpen, delta)
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

  update(): void {
    if (this.choosing) return
    if (this.encounterLocked) { this.player.setVelocity(0, 0); return }
    if (Phaser.Input.Keyboard.JustDown(this.keys.T)) { this.openTeam(); return }
    // Consume both keys each frame so simultaneous presses cannot reopen a dialogue.
    const interact = Phaser.Input.Keyboard.JustDown(this.keys.E)
    const enter = Phaser.Input.Keyboard.JustDown(this.keys.ENTER)
    if (!this.hud.isDialogueOpen && (interact || enter) && canInteract(this.player.body.center, this.stadiumPoint)) { this.openStadium(); return }
    const nearbyDoor = this.doors.find(door => canInteract(this.player.body.center, door))
    if (!this.hud.isDialogueOpen && (interact || enter) && nearbyDoor) { this.enterInterior(nearbyDoor.key); return }
    const escape = Phaser.Input.Keyboard.JustDown(this.keys.ESC)
    const nearbyNpc = this.npcs.find(npc => npc.sprite.active && canInteract(this.player.body.center, npc.sprite.body.center))
    for (const npc of this.npcs) {
      if (npc.content.kind === 'challenger' && npc.sprite.active && !this.encounterLocked &&
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
    const velocity = movementVelocity({
      left: this.cursors.left.isDown || this.keys.A.isDown,
      right: this.cursors.right.isDown || this.keys.D.isDown,
      up: this.cursors.up.isDown || this.keys.W.isDown,
      down: this.cursors.down.isDown || this.keys.S.isDown,
    }, this.hud.isDialogueOpen || this.encounterLocked)
    this.player.setVelocity(velocity.x, velocity.y)
    this.player.setDepth(this.player.y)
    this.challenger.setDepth(this.challenger.y)
    this.hud.showPrompt(nearby || Boolean(nearbyDoor), nearbyDoor ? 'Entrar' : 'Conversar')
  }

  private beginChallengerApproach(npc: typeof this.npcs[number]): void {
    this.encounterLocked = true
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
      onUpdate: tween => {
        // Small alternating steps keep the upright placeholder visibly walking.
        npc.sprite.y -= Math.round(2 * Math.abs(Math.sin(tween.progress * Math.PI * 6)))
        npc.sprite.setDepth(npc.sprite.y)
      },
      onComplete: () => {
        if (!this.scene.isActive() || !npc.sprite.active) return
        npc.sprite.setPosition(targetX, targetY)
        npc.sprite.refreshBody()
        npc.sprite.body.enable = true
        npc.sprite.setDepth(npc.sprite.y)
        npc.moving = false
        npc.facing = this.facingToward(npc.sprite, this.player)
        this.faceSprite(npc.sprite, npc.facing)
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

  private faceSprite(sprite: Phaser.GameObjects.Image, facing: Facing): void {
    sprite.setData('facing', facing)
    sprite.setFlipX(facing === 'left')
  }

  private facePlayer(facing: Facing): void {
    this.walkAnimation.face(facing)
  }

  private async choosePlayer(): Promise<void> {
    if (this.choosing || !this.hud.canChallenge) return
    this.choosing = true
    this.player.setVelocity(0, 0)
    this.input.keyboard!.resetKeys()
    this.input.keyboard!.enabled = false
    const captureKeys = this.input.keyboard!.manager.preventDefault
    this.input.keyboard!.disableGlobalCapture()
    const restoreCapture = () => { this.input.keyboard!.manager.preventDefault = captureKeys }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, restoreCapture)
    const challenger = this.activeChallenger
    const panel = scenePanel(this, `Desafiar ${challenger.name}`)
    panel.classList.add('player-selection-panel')
    const close = () => {
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
        paragraph(panel, 'Revanches e adversários de nível inferior rendem menos XP.').className = 'selection-hint'
        const status = paragraph(panel, '')
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
          void this.duelCommand.play(challenger.id, selectedId).then(result => {
            if (!this.scene.isActive()) return
            close()
            this.transitionToMatch(result)
          }).catch((error: unknown) => {
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
        start.disabled = !roster.length
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
