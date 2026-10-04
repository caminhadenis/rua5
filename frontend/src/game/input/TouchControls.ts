import Phaser from 'phaser'
import { TouchInput, type TouchAction } from './TouchInput'
import { isPhone, isPhonePortrait } from './mobileViewport'

export class TouchControls {
  readonly input = new TouchInput()
  private readonly element = document.createElement('nav')
  private readonly pad = document.createElement('div')
  private readonly confirm: HTMLButtonElement
  private readonly back: HTMLButtonElement
  private readonly team: HTMLButtonElement
  private visible = false
  private movementEnabled = false
  private disposed = false
  private contextKey = ''
  private readonly releaseEvents = new AbortController()

  constructor(private readonly scene: Phaser.Scene, private readonly stopMovement: () => void) {
    this.element.className = 'touch-controls'
    this.element.setAttribute('aria-label', 'Controles de toque')
    this.element.hidden = true
    this.pad.className = 'touch-dpad'
    this.pad.setAttribute('aria-label', 'Direcional')
    for (const [direction, symbol, label] of [
      ['up', '▲', 'Mover para cima'], ['left', '◀', 'Mover para a esquerda'],
      ['right', '▶', 'Mover para a direita'], ['down', '▼', 'Mover para baixo'],
    ] as const) {
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.direction = direction
      button.textContent = symbol
      button.setAttribute('aria-label', label)
      this.pad.append(button)
    }
    const actions = document.createElement('div')
    actions.className = 'touch-actions'
    this.confirm = this.actionButton(actions, 'Conversar', 'confirm')
    this.back = this.actionButton(actions, 'Voltar', 'back')
    this.team = this.actionButton(actions, 'Equipe', 'team')
    this.element.append(this.pad, actions)
    document.body.append(this.element)

    this.pad.addEventListener('pointerdown', event => {
      if (!this.movementEnabled || event.button !== 0) return
      event.preventDefault()
      this.pad.setPointerCapture(event.pointerId)
      this.holdAt(event)
    })
    this.pad.addEventListener('pointermove', event => {
      if (this.pad.hasPointerCapture(event.pointerId)) this.holdAt(event)
    })
    const release = (event: PointerEvent) => {
      this.capturedPointers.delete(event.pointerId)
      this.input.release(event.pointerId)
      this.paintDirections()
    }
    this.pad.addEventListener('pointerup', release)
    this.pad.addEventListener('pointercancel', release)
    this.pad.addEventListener('lostpointercapture', release)
    this.pad.addEventListener('contextmenu', event => event.preventDefault())

    const reset = () => this.reset()
    const hide = () => this.setContext({ visible: false })
    const signal = this.releaseEvents.signal
    window.addEventListener('blur', reset, { signal })
    window.addEventListener('mobile-viewport-change', reset, { signal })
    document.addEventListener('visibilitychange', reset, { signal })
    scene.events.on(Phaser.Scenes.Events.SLEEP, hide)
    scene.events.on(Phaser.Scenes.Events.PAUSE, hide)
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.disposed = true
      hide()
      this.releaseEvents.abort()
      scene.events.off(Phaser.Scenes.Events.SLEEP, hide)
      scene.events.off(Phaser.Scenes.Events.PAUSE, hide)
      this.element.remove()
    })
  }

  setContext(context: { visible: boolean; movement?: boolean; confirm?: string; back?: string; team?: boolean }): void {
    const visible = context.visible && isPhone() && !isPhonePortrait() && !this.disposed && this.scene.scene.isActive()
    const key = `${visible}/${context.movement}/${context.confirm}/${context.back}/${context.team}`
    if (key === this.contextKey) return
    this.contextKey = key
    if (visible !== this.visible) {
      this.visible = visible
      this.element.hidden = !visible
      document.documentElement.classList.toggle('phone-exploring', visible)
      this.reset()
    }
    const movement = visible && Boolean(context.movement)
    if (this.movementEnabled && !movement) this.reset()
    this.movementEnabled = movement
    this.pad.querySelectorAll('button').forEach(button => { button.disabled = !movement })
    this.confirm.disabled = !context.confirm || !visible
    this.confirm.textContent = context.confirm ?? 'Conversar'
    this.back.disabled = !context.back || !visible
    this.back.textContent = context.back ?? 'Voltar'
    this.team.hidden = !context.team
  }

  reset(): void {
    this.input.reset()
    for (const pointerId of this.capturedPointers) {
      if (this.pad.hasPointerCapture(pointerId)) this.pad.releasePointerCapture(pointerId)
    }
    this.capturedPointers.clear()
    this.paintDirections()
    this.stopMovement()
  }

  private readonly capturedPointers = new Set<number>()

  private holdAt(event: PointerEvent): void {
    this.capturedPointers.add(event.pointerId)
    const rect = this.pad.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width * 2 - 1
    const y = (event.clientY - rect.top) / rect.height * 2 - 1
    // Sliding around the cross also allows diagonals with one finger.
    this.input.hold(event.pointerId, {
      left: x < -0.28, right: x > 0.28, up: y < -0.28, down: y > 0.28,
    })
    this.paintDirections()
  }

  private paintDirections(): void {
    const directions = this.input.directions
    for (const button of this.pad.querySelectorAll('button')) {
      button.classList.toggle('is-held', Boolean(directions[button.dataset.direction as keyof typeof directions]))
    }
  }

  private actionButton(parent: HTMLElement, label: string, action: TouchAction): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    const press = () => { if (this.visible && !button.disabled) this.input.press(action) }
    // A second finger must be able to act while the first holds the direcional.
    button.onpointerup = event => {
      const rect = button.getBoundingClientRect()
      if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) press()
    }
    button.onclick = event => { if (event.detail === 0) press() }
    parent.append(button)
    return button
  }
}
