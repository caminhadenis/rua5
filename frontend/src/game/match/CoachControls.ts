import type { CoachInstruction, CoachedResponse, MatchPosture, MatchTempo } from '../../api/coachedMatches'
import { button, paragraph } from '../ui/ScenePanel'

const tempoNames: Record<MatchTempo, string> = { SLOW: 'Cadenciar', NORMAL: 'Normal', FAST: 'Apressar' }
const postureNames: Record<MatchPosture, string> = { DEFENSIVE: 'Defensivo', BALANCED: 'Equilibrado', OFFENSIVE: 'Ofensivo' }
const instructionPauseSteps = [0, 3]
const icons = {
  SLOW: '<path d="M6 3h12v4h-2v3l-2 2 2 2v3h2v4H6v-4h2v-3l2-2-2-2V7H6zM8 7h8M8 17h8"/>',
  NORMAL: '<path d="M5 5h14v14H5zM9 2h6M9 22h6M2 9v6M22 9v6M9 9h6v6H9z"/>',
  FAST: '<path d="M13 2 4 13h7l-1 9 10-13h-7z"/>',
  DEFENSIVE: '<path d="M4 3h16v11l-3 4-5 4-5-4-3-4zM8 8h8M12 4v13"/>',
  BALANCED: '<path d="M5 4h14v16H5zM12 4v16M2 9h6M16 15h6"/>',
  OFFENSIVE: '<path d="M3 9h10V3l8 9-8 9v-6H3z"/>',
  PLAY: '<path d="m7 3 12 9L7 21z"/>',
} as const
function icon(key: keyof typeof icons): SVGSVGElement {
  const holder = document.createElement('span')
  // Original pixel-style symbols, with no API content interpolated into markup.
  holder.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="miter">${icons[key]}</svg>`
  return holder.firstElementChild as SVGSVGElement
}

export class CoachControls {
  readonly element = document.createElement('div')
  private readonly status: HTMLParagraphElement
  private readonly choices: { key: keyof CoachInstruction; value: string; button: HTMLButtonElement }[] = []
  private readonly steps: HTMLElement[] = []
  private readonly continue: HTMLButtonElement
  private readonly automatic: HTMLInputElement
  private readonly automaticBadge: HTMLElement
  private selected: CoachInstruction
  private response: CoachedResponse
  private paused = true
  constructor(response: CoachedResponse, onContinue: () => void) {
    this.response = response
    this.selected = { ...response.instruction }
    this.element.className = 'coach-controls'
    this.element.setAttribute('aria-label', 'Orientações do treinador')
    const header = document.createElement('div')
    header.className = 'coach-header'
    this.element.append(header)
    this.status = paragraph(header, '')
    this.status.className = 'coach-status'
    this.status.dataset.testid = 'coach-status'
    this.status.setAttribute('role', 'status')
    const progress = document.createElement('div')
    progress.className = 'coach-steps'
    progress.setAttribute('aria-hidden', 'true')
    header.append(progress)
    for (let step = 0; step < instructionPauseSteps.length; step++) {
      const marker = document.createElement('span')
      progress.append(marker)
      this.steps.push(marker)
    }
    const commands = document.createElement('div')
    commands.className = 'coach-commands'
    this.element.append(commands)
    const group = (label: string, key: keyof CoachInstruction, names: Record<string, string>) => {
      const field = document.createElement('div')
      field.className = 'coach-command-group'
      field.setAttribute('role', 'group')
      field.setAttribute('aria-label', label)
      const title = document.createElement('strong')
      title.className = 'coach-command-title'
      title.textContent = label
      field.append(title)
      const options = document.createElement('div')
      options.className = 'coach-options'
      field.append(options)
      commands.append(field)
      for (const [value, name] of Object.entries(names)) {
        const option = button(options, '', () => {
          this.selected = { ...this.selected, [key]: value }
          this.render()
        })
        option.type = 'button'
        option.className = 'coach-option'
        option.dataset.value = value
        const caption = document.createElement('span')
        caption.textContent = name
        option.append(icon(value as keyof typeof icons), caption)
        this.choices.push({ key, value, button: option })
      }
    }
    group('Ritmo', 'tempo', tempoNames)
    group('Postura', 'posture', postureNames)
    const actions = document.createElement('div')
    actions.className = 'coach-actions'
    commands.append(actions)
    const automaticLabel = document.createElement('label')
    automaticLabel.className = 'coach-auto'
    this.automatic = document.createElement('input')
    this.automatic.type = 'checkbox'
    this.automatic.setAttribute('aria-label', 'Pausar para orientar')
    this.automatic.checked = localStorage.getItem('rua5.coach.auto-pause') !== 'false'
    this.automatic.onchange = () => { localStorage.setItem('rua5.coach.auto-pause', String(this.automatic.checked)); this.render() }
    const automaticCaption = document.createElement('span')
    automaticCaption.textContent = 'Pausar para orientar'
    this.automaticBadge = document.createElement('span')
    this.automaticBadge.className = 'coach-auto-badge'
    this.automaticBadge.setAttribute('aria-hidden', 'true')
    automaticLabel.append(this.automatic, automaticCaption, this.automaticBadge)
    actions.append(automaticLabel)
    this.continue = button(actions, '', onContinue)
    this.continue.type = 'button'
    this.continue.className = 'coach-continue'
    const caption = document.createElement('span')
    caption.textContent = 'Continuar partida'
    this.continue.append(icon('PLAY'), caption)
    this.render()
  }
  get instruction(): CoachInstruction { return { ...this.selected } }
  get autoPause(): boolean { return this.automatic.checked }
  update(response: CoachedResponse, paused: boolean): void { this.response = response; this.paused = paused; this.render() }
  busy(value: boolean): void { this.element.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input,button').forEach(el => { el.disabled = value }) }
  error(message: string): void { this.status.textContent = message }
  private render(): void {
    const current = this.response.instruction
    const chosen = this.instruction
    const pending = current.tempo !== chosen.tempo || current.posture !== chosen.posture
    this.element.dataset.phase = this.paused ? 'paused' : 'playing'
    this.element.dataset.pending = String(pending)
    const pauseNumber = instructionPauseSteps.indexOf(this.response.step) + 1
    this.status.textContent = `${this.paused ? `Orientação ${pauseNumber}/2 · ${pauseNumber === 1 ? 'antes do apito' : 'intervalo · relógio parado'}` : `Trecho ${this.response.step}/5 · ${tempoNames[current.tempo]} + ${postureNames[current.posture]}`}` +
      (pending ? ' Nova orientação no próximo trecho.' : '')
    for (const choice of this.choices) choice.button.setAttribute('aria-pressed', String(chosen[choice.key] === choice.value))
    const visibleStep = this.paused ? Math.max(0, pauseNumber - 1) : instructionPauseSteps.filter(step => step < this.response.step).length
    this.steps.forEach((step, index) => {
      step.classList.toggle('is-complete', index < visibleStep)
      step.classList.toggle('is-current', index === visibleStep)
    })
    this.automaticBadge.textContent = this.autoPause ? 'ON' : 'OFF'
    this.continue.hidden = !this.paused
  }
}
