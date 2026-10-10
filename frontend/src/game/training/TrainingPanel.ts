import Phaser from 'phaser'
import { ApiError, TrainingCommand, teamApi, type RosterPlayer, type TrainingFocus, type TrainingResult } from '../../api/gameApi'
import { button, paragraph, scenePanel } from '../ui/ScenePanel'
import { PlayerCards } from '../ui/PlayerCards'
import { fatigueReceiptText } from '../ui/fatigue'
import { TRAINING_SECTORS } from '../maps/trainingCenter'
import { TRAINING_DURATION_MS, trainingStage } from './TrainingStage'

const command = new TrainingCommand()

export async function openTrainingPanel(
  scene: Phaser.Scene,
  focus: TrainingFocus,
  onClose: () => void,
  onRosterUpdated: (roster: RosterPlayer[]) => void,
): Promise<void> {
  const label = TRAINING_SECTORS.find(sector => sector.focus === focus)!.label.toLocaleLowerCase('pt-BR')
  const panel = scenePanel(scene, `Treinar ${label}`)
  panel.classList.add('training-panel')
  const close = () => {
    panel.dispose()
    onClose()
  }
  const load = async () => {
    panel.replaceChildren()
    paragraph(panel, 'Carregando elenco…')
    try {
      let roster = await teamApi.roster()
      if (!scene.scene.isActive() || !panel.isConnected) return
      panel.replaceChildren()
      const title = document.createElement('h2')
      title.textContent = `Setor de ${label}`
      panel.append(title)
      paragraph(panel, 'Cada treino dá +0,25 neste fundamento, até 99. Você pode repetir assim que a sessão terminar. Cada treino gera +12 de desgaste.').className = 'selection-description'
      const cards = new PlayerCards(roster)
      panel.append(cards.element)
      const stageHolder = document.createElement('div')
      stageHolder.className = 'training-stage-holder'
      panel.append(stageHolder)
      const focusedPlayer = () => roster.find(player => player.id === cards.selectedId)
      const renderProgress = () => {
        const display = stageHolder.querySelector<HTMLElement>('.training-progress')
        const player = focusedPlayer()
        if (display && player) {
          const stat = player.stats[focus.toLowerCase() as keyof RosterPlayer['stats']]
          display.textContent = `${label} · ${stat.toLocaleString('pt-BR')}/99 · ${stat < 99 ? '+0,25 por treino' : 'máximo atingido'}`
        }
      }
      const renderStage = () => {
        stageHolder.replaceChildren()
        const player = focusedPlayer()
        if (player) stageHolder.append(trainingStage(player, focus))
        renderProgress()
      }
      renderStage()
      const status = paragraph(panel, 'O treino melhora este atributo. Nível e XP aumentam com partidas.')
      status.setAttribute('role', 'status')
      const actions = document.createElement('div')
      actions.className = 'selection-actions'
      panel.append(actions)
      const cancel = button(actions, 'Voltar ao centro', close)
      let selectedPlayerId: string | undefined
      let confirmedResult: TrainingResult | undefined
      let busy = false
      const updateAvailability = () => {
        const player = focusedPlayer()
        const stat = focus.toLowerCase() as keyof RosterPlayer['stats']
        start.disabled = busy || !player || Boolean(player.recovery) || player.stats[stat] >= 99
      }
      cards.element.addEventListener('change', () => { renderStage(); updateAvailability() })
      cards.element.addEventListener('fatigue-updated', updateAvailability)
      const start = button(actions, 'Começar treino', () => {
        if (busy) return
        const firstAttempt = !selectedPlayerId
        selectedPlayerId ??= cards.selectedId
        if (!selectedPlayerId) return
        busy = true
        updateAvailability()
        cards.disabled = true
        cancel.disabled = true
        const run = async () => {
          if (firstAttempt) {
            const stage = stageHolder.querySelector<HTMLElement>('.training-stage')!
            stage.classList.add('is-playing')
            status.textContent = `${focusedPlayer()!.name} está treinando…`
            const clock = stage.querySelector<HTMLElement>('.training-clock')!
            for (let remaining = 5; remaining > 0; remaining--) {
              clock.textContent = `${remaining} s`
              await new Promise(resolve => window.setTimeout(resolve, TRAINING_DURATION_MS / 5))
              if (!panel.isConnected || !scene.scene.isActive()) return
            }
            clock.textContent = 'Fim!'
            stage.classList.remove('is-playing')
            status.textContent = 'Confirmando o progresso do treino…'
          }
          try {
            // If roster refresh fails after a confirmed command, retry only the refresh.
            confirmedResult ??= await command.train(selectedPlayerId!, focus)
            const result = confirmedResult
            const updated = await teamApi.roster()
            if (!panel.isConnected || !scene.scene.isActive()) return
            roster = updated
            cards.updateFatigue(updated)
            onRosterUpdated(updated)
            renderProgress()
            status.textContent = result.statAfter !== null && result.statBefore !== null && result.statAfter !== result.statBefore
              ? `${label}: ${result.statBefore.toLocaleString('pt-BR')} → ${result.statAfter.toLocaleString('pt-BR')} para ${roster.find(player => player.id === result.ownedPlayerId)!.name}!`
              : 'Treino anterior recuperado. Confira o elenco.'
            if (result.fatigue) status.textContent += ` ${fatigueReceiptText(result.fatigue)}.`
            confirmedResult = undefined
            selectedPlayerId = undefined
            busy = false
            cards.disabled = false
            start.textContent = 'Treinar novamente'
            cancel.disabled = false
            updateAvailability()
          } catch (error: unknown) {
            if (!panel.isConnected || !scene.scene.isActive()) return
            if (!confirmedResult && error instanceof ApiError && error.rejected) {
              selectedPlayerId = undefined
              cards.disabled = false
              status.textContent = error.code === 'TRAINING_STAT_MAX' ? 'Este fundamento já está em 99. Escolha outro.'
                : 'Não foi possível treinar este jogador.'
              cancel.disabled = false
            } else {
              status.textContent = 'Não foi possível confirmar o treino. Tente novamente para recuperar o mesmo resultado.'
              start.textContent = 'Tentar novamente'
            }
            busy = false
            updateAvailability()
          }
        }
        void run()
      })
      updateAvailability()
    } catch {
      if (!panel.isConnected) return
      panel.replaceChildren()
      paragraph(panel, 'Não foi possível carregar o elenco.')
      button(panel, 'Tentar novamente', () => { void load() })
      button(panel, 'Voltar ao centro', close)
    }
  }
  await load()
}
