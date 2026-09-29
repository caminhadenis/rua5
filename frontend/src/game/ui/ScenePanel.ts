import Phaser from 'phaser'

export function scenePanel(scene: Phaser.Scene, label: string): HTMLElement & { dispose: () => void } {
  const panel = document.createElement('section')
  panel.className = 'scene-panel'
  panel.setAttribute('aria-label', label)
  document.getElementById('game')!.append(panel)
  const dispose = () => {
    panel.remove()
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, dispose)
  }
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, dispose)
  return Object.assign(panel, { dispose })
}

export function button(parent: HTMLElement, text: string, action: () => void): HTMLButtonElement {
  const element = document.createElement('button')
  element.textContent = text
  element.onclick = action
  parent.append(element)
  return element
}

export function paragraph(parent: HTMLElement, text: string): HTMLParagraphElement {
  const element = document.createElement('p')
  element.textContent = text
  parent.append(element)
  return element
}
