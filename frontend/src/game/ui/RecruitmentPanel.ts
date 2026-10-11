import { gameAudio } from '../audio/GameAudio'
import { ApiError, teamApi } from '../../api/gameApi'
import { button, paragraph } from './ScenePanel'

/** Uses fresh server availability, including when a historical match is replayed. */
export function recruitmentPanel(parent: HTMLElement, challengerId: string, onRecruited: () => Promise<void> = async () => {}, options: { compact?: boolean } = {}): void {
  const section = document.createElement('section')
  section.className = 'recruitment-panel'
  section.setAttribute('aria-label', 'Recrutamento')
  parent.append(section)
  const load = async () => {
    section.replaceChildren()
    section.hidden = Boolean(options.compact)
    paragraph(section, 'Consultando recrutamento…')
    try {
      const info = await teamApi.challenge(challengerId)
      if (!section.isConnected) return
      section.replaceChildren()
      section.setAttribute('aria-label', `Recrutamento · ${info.name}`)
      // The team screen shows actionable invitations only, keeping unavailable NPCs out of the roster view.
      if (options.compact && (info.recruitmentStatus !== 'AVAILABLE' || !info.recruitable)) return
      section.hidden = false
      if (info.recruitmentStatus === 'RECRUITED') {
        paragraph(section, `${info.name} já faz parte do seu elenco.`)
      } else if (info.recruitmentStatus === 'AVAILABLE' && info.recruitable) {
        paragraph(section, options.compact ? info.name : `${info.name}: “Você joga bem! Posso entrar no seu time?”`)
        if (info.rosterFull) {
          paragraph(section, options.compact ? 'Time cheio: 5/5.' : 'Time cheio: 5/5 jogadores. Dispense um atleta na Equipe para contratar outro.').setAttribute('role', 'status')
          const invite = button(section, 'Convidar para o time', () => {})
          invite.disabled = true
          return
        }
        const status = paragraph(section, '')
        status.setAttribute('role', 'status')
        const invite = button(section, 'Convidar para o time', () => {
          invite.disabled = true
          status.textContent = 'Enviando convite…'
          void teamApi.recruit(challengerId).then(async () => {
            if (!section.isConnected) return
            gameAudio.play('confirm')
            section.replaceChildren()
            paragraph(section, `${info.name}: “Valeu por me chamar para o seu time! Vou dar o meu melhor!”`).setAttribute('role', 'status')
            // Give the athlete's reply time to be read before opening the updated roster.
            await new Promise<void>(resolve => window.setTimeout(resolve, 2500))
            if (!section.isConnected) return
            await onRecruited()
          }).catch((error: unknown) => {
            if (!section.isConnected) return
            status.textContent = error instanceof ApiError && error.code === 'ROSTER_FULL'
              ? 'Time cheio: 5/5 jogadores. Dispense um atleta na Equipe para contratar outro.'
              : error instanceof ApiError && error.rejected
              ? 'O convite não está disponível. Consulte o recrutamento novamente.'
              : 'Não foi possível confirmar o convite. Repetir é seguro.'
            invite.textContent = 'Tentar convite novamente'
            invite.disabled = false
            if (error instanceof ApiError && error.rejected) {
              invite.remove()
              button(section, 'Consultar recrutamento', () => { void load() })
            }
          })
        })
      } else {
        paragraph(section, info.recruitable ? `Vença ${info.name} para liberar o convite.` : `${info.name} não está disponível para recrutamento.`)
      }
    } catch {
      if (!section.isConnected) return
      section.replaceChildren()
      section.hidden = false
      paragraph(section, 'Não foi possível consultar o recrutamento.')
      button(section, 'Consultar recrutamento', () => { void load() })
    }
  }
  void load()
}
