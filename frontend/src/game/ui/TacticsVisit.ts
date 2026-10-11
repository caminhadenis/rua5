import Phaser from 'phaser'
import { PlayerWalkAnimation } from '../entities/PlayerWalkAnimation'
import type { InteriorLocation } from '../maps/locations'
import { isPhonePortrait } from '../input/mobileViewport'
import { GuidedWalk, walkingRoute } from '../maps/walkingRoute'
import { TACTICS_COACH_STOP, TACTICS_GREETING, TACTICS_LESSONS, TACTICS_PLAYER_STOP, tacticsRoomWalkable } from '../maps/tacticsRoom'
import { button, paragraph, scenePanel } from './ScenePanel'

type Player = Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
type Coach = Phaser.Types.Physics.Arcade.ImageWithStaticBody

/** A local, optional guided visit. It never changes match instructions or progression. */
export class TacticsVisit {
  private panel?: ReturnType<typeof scenePanel>
  private coachWalk?: GuidedWalk
  private playerWalk?: GuidedWalk
  private readonly animation: PlayerWalkAnimation
  private readonly escape?: Phaser.Input.Keyboard.Key
  private readonly confirm?: Phaser.Input.Keyboard.Key
  private phase: 'idle' | 'approach' | 'greeting' | 'guide' | 'lesson' = 'idle'
  private page = 0
  private greetingPage = 0

  constructor(private readonly scene: Phaser.Scene, private readonly player: Player,
    private readonly coach: Coach, private readonly location: InteriorLocation, private readonly release: () => void) {
    this.animation = new PlayerWalkAnimation(coach)
    this.escape = scene.input.keyboard?.addKey('ESC')
    this.confirm = scene.input.keyboard?.addKey('ENTER')
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.panel?.dispose())
  }

  get active(): boolean { return this.phase !== 'idle' }
  get walking(): boolean { return this.phase === 'guide' && Boolean(this.playerWalk && !this.playerWalk.finished) }

  welcome(): void {
    this.greetingPage = 0
    const destinations = [{ x: this.player.x - 48, y: this.player.y }, { x: this.player.x + 48, y: this.player.y },
      { x: this.player.x, y: this.player.y - 48 }, { x: this.player.x, y: this.player.y + 48 }]
    const route = destinations.map(point => this.route(this.coach, point)).find(path => path.length > 0)
    this.coachWalk = route ? new GuidedWalk(route, 125) : undefined
    this.phase = 'approach'
    if (!this.coachWalk) this.greet()
  }

  update(delta: number): void {
    if (!this.active || isPhonePortrait()) return
    if (this.phase === 'approach' || this.phase === 'guide') {
      if (this.coachWalk) {
        this.coachWalk.step(delta)
        this.coach.body.reset(this.coachWalk.position.x, this.coachWalk.position.y)
        this.coach.setDepth(this.coach.y)
        this.animation.update(false, delta, !this.coachWalk.finished)
      }
      if (this.playerWalk) {
        this.playerWalk.step(delta)
        this.player.body.reset(this.playerWalk.position.x, this.playerWalk.position.y)
        this.player.setDepth(this.player.y)
      }
      if ((!this.coachWalk || this.coachWalk.finished) && (!this.playerWalk || this.playerWalk.finished)) {
        this.animation.face(this.phase === 'guide' ? 'up' : this.coach.x < this.player.x ? 'right' : 'left')
        this.playerWalk = undefined
        this.coachWalk = undefined
        if (this.phase === 'approach') this.greet()
        else { this.player.setFrame('back-0'); this.read() }
      }
    }
    if (this.escape && Phaser.Input.Keyboard.JustDown(this.escape)) this.close()
    else if (this.confirm && Phaser.Input.Keyboard.JustDown(this.confirm)) {
      if (this.phase === 'greeting') this.nextGreeting()
      else if (this.phase === 'lesson') this.next()
    }
  }

  read(): void {
    this.phase = 'lesson'
    this.page = 0
    this.renderLesson()
  }

  private route(from: { x: number; y: number }, to: { x: number; y: number }) {
    return walkingRoute(from, to, 960, 540, point => tacticsRoomWalkable(this.location, point), 16)
  }

  private preparePanel(): ReturnType<typeof scenePanel> {
    this.panel ??= scenePanel(this.scene, 'Mural de táticas da Dona Amélia')
    this.panel.className = 'scene-panel story-dialogue tactics-panel'
    this.panel.replaceChildren()
    paragraph(this.panel, 'DONA AMÉLIA · TREINADORA APOSENTADA').className = 'story-speaker'
    return this.panel
  }

  private greet(): void {
    this.phase = 'greeting'
    const panel = this.preparePanel()
    paragraph(panel, TACTICS_GREETING[this.greetingPage]!)
    button(panel, this.greetingPage === TACTICS_GREETING.length - 1 ? 'Ir ao mural' : 'Continuar', () => this.nextGreeting())
    button(panel, 'Explorar a casa', () => this.close())
  }

  private nextGreeting(): void {
    if (this.greetingPage === TACTICS_GREETING.length - 1) this.guide()
    else { this.greetingPage++; this.greet() }
  }

  private guide(): void {
    const coachRoute = this.route(this.coach, TACTICS_COACH_STOP)
    const playerRoute = this.route(this.player, TACTICS_PLAYER_STOP)
    if (!coachRoute.length || !playerRoute.length) { this.read(); return }
    this.panel?.dispose()
    this.panel = undefined
    this.phase = 'guide'
    this.coachWalk = new GuidedWalk(coachRoute, 125)
    this.playerWalk = new GuidedWalk(playerRoute, 125)
  }

  private next(): void {
    if (this.page === TACTICS_LESSONS.length - 1) this.close()
    else { this.page++; this.renderLesson() }
  }

  private renderLesson(): void {
    const panel = this.preparePanel()
    const lesson = TACTICS_LESSONS[this.page]!
    const heading = document.createElement('h2')
    heading.textContent = `${this.page + 1}/${TACTICS_LESSONS.length} · ${lesson.title}`
    panel.append(heading)
    paragraph(panel, lesson.text)
    const actions = document.createElement('nav')
    actions.setAttribute('aria-label', 'Páginas do mural')
    panel.append(actions)
    if (this.page > 0) button(actions, 'Anterior', () => { this.page--; this.renderLesson() })
    button(actions, this.page === TACTICS_LESSONS.length - 1 ? 'Concluir visita' : 'Próxima dica', () => this.next())
    button(actions, 'Fechar mural', () => this.close())
  }

  private close(): void {
    this.phase = 'idle'
    this.coachWalk = undefined
    this.playerWalk = undefined
    this.animation.stop()
    this.panel?.dispose()
    this.panel = undefined
    this.scene.input.keyboard?.resetKeys()
    this.release()
  }
}
