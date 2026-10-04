import Phaser from 'phaser'
import { isPhone } from '../input/mobileViewport'

/** DOM text stays readable even when the pixel-art canvas is scaled down. */
export class MobileDialogue {
  private readonly element = document.createElement('section')
  private readonly speaker = document.createElement('strong')
  private readonly words = document.createElement('p')
  private open = false

  constructor(scene: Phaser.Scene) {
    this.element.className = 'mobile-dialogue'
    this.element.setAttribute('aria-label', 'Conversa')
    this.element.append(this.speaker, this.words)
    this.element.hidden = true
    document.getElementById('game')!.append(this.element)
    const hide = () => { this.element.hidden = true }
    const show = () => { this.element.hidden = !this.open || !isPhone() }
    scene.events.on(Phaser.Scenes.Events.SLEEP, hide)
    scene.events.on(Phaser.Scenes.Events.WAKE, show)
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.SLEEP, hide)
      scene.events.off(Phaser.Scenes.Events.WAKE, show)
      this.element.remove()
    })
  }

  show(name: string, words: string): void {
    this.open = true
    this.speaker.textContent = name
    this.words.textContent = words
    this.element.hidden = !isPhone()
  }

  close(): void { this.open = false; this.element.hidden = true }
}
