import type Phaser from 'phaser'
import { request, type Profile, type Starter } from '../../api/gameApi'
import { starterUniformUrl } from '../team/teamColors'
import { button, paragraph } from './ScenePanel'

export async function starterPicker(scene: Phaser.Scene, panel: HTMLElement, profile: Profile, onComplete: (starter: Starter) => void): Promise<void> {
  const load = async () => {
    panel.replaceChildren()
    paragraph(panel, 'Carregando jogadores…')
    try {
      const starters = await request<Starter[]>('/starters')
      if (!scene.scene.isActive()) return
      panel.replaceChildren()
      paragraph(panel, 'Seu primeiro jogador · escolha um dos três para começar!')
    const grid = document.createElement('div')
    grid.className = 'starter-grid'
    panel.append(grid)
    const descriptions: Record<string, string> = {
      starter_leo: 'Boa velocidade e drible · cabelo marrom e bigode',
      starter_breno: 'Defensor forte na marcação · cabelo preto',
      starter_rafa: 'Boa finalização e velocidade · cabelo loiro',
    }
    for (const starter of starters) {
      const card = document.createElement('article')
      card.className = 'starter-card'
      const portrait = document.createElement('div')
      portrait.className = 'starter-portrait'
      portrait.setAttribute('role', 'img')
      portrait.setAttribute('aria-label', `${starter.name} com o uniforme escolhido`)
      portrait.style.backgroundImage = `url("${starterUniformUrl(starter.id, profile)}")`
      const name = document.createElement('h3')
      name.textContent = starter.name
      const description = paragraph(card, descriptions[starter.id] ?? starter.archetype)
      description.className = 'starter-description'
      card.prepend(portrait, name)
      button(card, `Escolher ${starter.name}`, () => {
        panel.querySelectorAll('button').forEach(b => { b.disabled = true })
        void request('/profile/starter', { playerDefinitionId: starter.id }).then(() => {
          if (scene.scene.isActive()) onComplete(starter)
        }).catch(() => { void load() })
      })
      grid.append(card)
    }
    } catch {
      if (!scene.scene.isActive()) return
      panel.replaceChildren()
      paragraph(panel, 'Não foi possível carregar os jogadores.')
      button(panel, 'Tentar novamente', () => { void load() })
    }
  }
  await load()
}
