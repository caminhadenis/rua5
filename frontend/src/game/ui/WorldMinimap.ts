import Phaser from 'phaser'
import type { Position } from '../maps/interactions'

const POINTS = [
  { key: 'benfica.stadium.entry', label: 'Estádio', mark: 'E', color: '#f7d154' },
  { key: 'benfica.gym.entry', label: 'Centro de treinamento', mark: 'T', color: '#f0ba69' },
  { key: 'benfica.recovery.entry', label: 'Centro de recuperação', mark: 'R', color: '#82ded7' },
]
const SVG_NS = 'http://www.w3.org/2000/svg'

export class WorldMinimap {
  private readonly element = document.createElement('aside')
  private readonly dot: SVGCircleElement

  constructor(scene: Phaser.Scene, map: Phaser.Tilemaps.Tilemap) {
    this.element.className = 'world-minimap'
    this.element.setAttribute('aria-label', 'Minimapa do Benfica')
    const title = document.createElement('strong')
    title.textContent = 'BENFICA · MAPA'
    this.element.append(title)
    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('viewBox', `0 0 ${map.widthInPixels} ${map.heightInPixels}`)
    svg.setAttribute('role', 'img')
    svg.setAttribute('aria-label', 'Sua posição e os locais importantes do bairro')
    const rect = (x: number, y: number, width: number, height: number, color: string) => {
      const shape = document.createElementNS(SVG_NS, 'rect')
      for (const [key, value] of Object.entries({ x, y, width, height, fill: color })) shape.setAttribute(key, String(value))
      svg.append(shape)
    }
    rect(0, 0, map.widthInPixels, map.heightInPixels, '#507756')
    const ground = map.getLayer('ground')?.data
    for (const row of ground ?? []) for (const tile of row) {
      if (tile.index === 2 || tile.index === 3) rect(tile.pixelX, tile.pixelY, tile.width, tile.height, '#c2b391')
    }
    for (const layer of ['houses', 'buildings', 'landmarks']) for (const object of map.getObjectLayer(layer)?.objects ?? []) {
      rect(object.x ?? 0, object.y ?? 0, object.width ?? 0, object.height ?? 0,
        object.name === 'lake' ? '#438ca2' : layer === 'landmarks' ? '#6a986c' : '#263f48')
    }
    const legend = document.createElement('div')
    legend.className = 'minimap-legend'
    for (const point of POINTS) {
      const door = map.getObjectLayer('interactions')?.objects.find(object =>
        object.properties?.some((p: { name: string; value: unknown }) => p.name === 'spawnKey' && p.value === point.key))
      if (!door) continue
      const marker = document.createElementNS(SVG_NS, 'text')
      marker.setAttribute('x', String(door.x))
      marker.setAttribute('y', String(door.y))
      marker.setAttribute('fill', point.color)
      marker.setAttribute('text-anchor', 'middle')
      marker.setAttribute('dominant-baseline', 'central')
      marker.setAttribute('font-size', '320')
      marker.setAttribute('font-family', 'monospace')
      marker.setAttribute('font-weight', 'bold')
      marker.setAttribute('stroke', '#152b32')
      marker.setAttribute('stroke-width', '45')
      marker.setAttribute('paint-order', 'stroke')
      marker.textContent = point.mark
      svg.append(marker)
      const item = document.createElement('span')
      item.style.color = point.color
      item.textContent = `${point.mark} · ${point.label}`
      legend.append(item)
    }
    this.dot = document.createElementNS(SVG_NS, 'circle')
    this.dot.setAttribute('r', '80')
    this.dot.setAttribute('fill', '#ffffff')
    this.dot.setAttribute('stroke', '#152b32')
    this.dot.setAttribute('stroke-width', '24')
    const dotTitle = document.createElementNS(SVG_NS, 'title')
    dotTitle.textContent = 'Você'
    this.dot.append(dotTitle)
    svg.append(this.dot)
    const you = document.createElement('span')
    you.textContent = '● Você'
    legend.append(you)
    this.element.append(svg, legend)
    document.getElementById('game')!.append(this.element)
    const hide = () => { this.element.hidden = true }
    const show = () => { this.element.hidden = false }
    scene.events.on(Phaser.Scenes.Events.SLEEP, hide)
    scene.events.on(Phaser.Scenes.Events.WAKE, show)
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.SLEEP, hide)
      scene.events.off(Phaser.Scenes.Events.WAKE, show)
      this.element.remove()
    })
  }

  update(position: Position, visible: boolean): void {
    this.element.hidden = !visible
    this.dot.setAttribute('cx', String(position.x))
    this.dot.setAttribute('cy', String(position.y))
  }
}
