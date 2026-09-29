import Phaser from 'phaser'
import { applyTeamColors, DEFAULT_TEAM_COLORS, starterUniformUrl, type TeamColors } from '../team/teamColors'
import { teamColorPicker } from '../ui/TeamColorPicker'
import { ApiError, request, type Profile, type Starter } from '../../api/gameApi'
import { button, paragraph, scenePanel } from '../ui/ScenePanel'

export class MainMenuScene extends Phaser.Scene {
  constructor() { super('MainMenuScene') }
  create(): void {
    const panel = scenePanel(this, 'Início')
    void this.loadProfile(panel)
  }
  private async loadProfile(panel: HTMLElement): Promise<void> {
    panel.replaceChildren()
    paragraph(panel, 'Carregando seu jogo…')
    try {
      const profile = await request<Profile>('/profile')
      if (!this.scene.isActive()) return
      await applyTeamColors(this, { primaryColor: profile.primaryColor ?? DEFAULT_TEAM_COLORS.primaryColor, secondaryColor: profile.secondaryColor ?? DEFAULT_TEAM_COLORS.secondaryColor })
      if (!this.scene.isActive()) return
      if (profile.starterSelected) this.scene.start('WorldScene')
      else await this.starters(panel, profile)
    } catch (error) {
      if (!this.scene.isActive()) return
      panel.replaceChildren()
      if (error instanceof ApiError && error.code === 'PROFILE_NOT_FOUND') {
        paragraph(panel, 'Jogo de Rua · Sua jornada começa na quadra')
        const name = document.createElement('input')
        name.setAttribute('aria-label', 'Seu nome')
        name.maxLength = 40
        name.value = 'Jogador'
        panel.append(name)
        button(panel, 'Começar', () => {
          if (!name.value.trim()) return
          teamColorPicker(panel, colors => { void this.createProfile(panel, name.value.trim(), colors) })
        })
      } else {
        paragraph(panel, 'Não foi possível conectar ao jogo.')
        button(panel, 'Tentar novamente', () => { void this.loadProfile(panel) })
      }
    }
  }
  private async createProfile(panel: HTMLElement, displayName: string, colors: TeamColors): Promise<void> {
    panel.replaceChildren()
    paragraph(panel, 'Criando perfil…')
    try {
      await request('/profiles', { displayName, ...colors })
      if (this.scene.isActive()) await this.loadProfile(panel)
    } catch { await this.loadProfile(panel) }
  }
  private async starters(panel: HTMLElement, profile: Profile): Promise<void> {
    const starters = await request<Starter[]>('/starters')
    if (!this.scene.isActive()) return
    panel.replaceChildren()
    paragraph(panel, 'PASSO 2 DE 2 · PRIMEIRO JOGADOR')
    paragraph(panel, 'Escolha seu starter')
    const grid = document.createElement('div')
    grid.className = 'starter-grid'
    panel.append(grid)
    const descriptions: Record<string, string> = {
      starter_leo: 'Boa velocidade e passe · cabelo marrom e bigode',
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
          if (this.scene.isActive()) this.scene.start('WorldScene')
        }).catch(() => { void this.loadProfile(panel) })
      })
      grid.append(card)
    }
  }
}
