import { DEFAULT_TEAM_COLORS, uniformUrl, type TeamColors } from '../team/teamColors'
import { button, paragraph } from './ScenePanel'

export function teamColorPicker(panel: HTMLElement, confirm: (colors: TeamColors) => void): void {
  panel.replaceChildren()
  paragraph(panel, 'PASSO 1 DE 2 · SEU TIME').className = 'selection-eyebrow'
  const title = document.createElement('h2')
  title.textContent = 'Escolha as cores do seu time'
  panel.append(title)
  paragraph(panel, 'O primeiro jogador e todos os convidados vão vestir esse uniforme.')
  const colors = { ...DEFAULT_TEAM_COLORS }
  const preview = document.createElement('div')
  preview.className = 'team-uniform-preview'
  preview.setAttribute('role', 'img')
  preview.setAttribute('aria-label', 'Prévia do uniforme do time')
  panel.append(preview)
  const update = () => { preview.style.backgroundImage = `url("${uniformUrl('player', colors)}")` }
  const fields = document.createElement('div')
  fields.className = 'team-color-fields'
  panel.append(fields)
  for (const [key, text] of [['primaryColor', 'Cor principal'], ['secondaryColor', 'Cor secundária']] as const) {
    const label = document.createElement('label')
    label.textContent = text
    const input = document.createElement('input')
    input.type = 'color'
    input.value = colors[key]
    input.oninput = () => { colors[key] = input.value; update() }
    label.append(input)
    fields.append(label)
  }
  update()
  button(panel, 'Confirmar cores', () => confirm(colors))
}
