import Phaser from 'phaser'
import { ApiError, TrainingCommand, teamApi, trainingApi, type RosterPlayer, type TrainingFocus } from '../../api/gameApi'
import { button, paragraph, scenePanel } from '../ui/ScenePanel'
import { PlayerCards } from '../ui/PlayerCards'
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
  let cooldownTimer: number | undefined
  const clearTimer = () => {
    if (cooldownTimer !== undefined) window.clearInterval(cooldownTimer)
  }
  const close = () => {
    clearTimer()
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, clearTimer)
    panel.dispose()
    onClose()
  }
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, clearTimer)
  const load = async () => {
    panel.replaceChildren()
    paragraph(panel, 'Carregando elenco…')
    try {
      const [initialRoster, availability] = await Promise.all([teamApi.roster(), trainingApi.status()])
      let roster = initialRoster
      if (!scene.scene.isActive() || !panel.isConnected) return
      panel.replaceChildren()
      const title = document.createElement('h2')
      title.textContent = `Setor de ${label}`
      panel.append(title)
      paragraph(panel, 'Cinco sessões deste fundamento dão +1. Cada atleta tem seu próprio intervalo de 1 minuto.')
      const cards = new PlayerCards(roster)
      panel.append(cards.element)
      const stageHolder = document.createElement('div')
      panel.append(stageHolder)
      const progress = new Map(availability.progress.map(item => [`${item.ownedPlayerId}:${item.focus}`, item.completed]))
      const focusedPlayer = () => roster.find(player => player.id === cards.selectedId)
      const focusedCount = () => progress.get(`${cards.selectedId}:${focus}`) ?? 0
      const renderProgress = () => {
        const display = stageHolder.querySelector<HTMLElement>('.training-progress')
        if (display && focusedPlayer()) display.textContent = `${label} · ${focusedCount()}/5 · faltam ${5 - focusedCount()} para +1`
      }
      const renderStage = () => {
        stageHolder.replaceChildren()
        const player = focusedPlayer()
        if (player) stageHolder.append(trainingStage(player, focus))
        renderProgress()
      }
      renderStage()
      const cooldown = paragraph(panel, '')
      cooldown.className = 'training-cooldown'
      const status = paragraph(panel, 'O atributo só melhora ao completar os cinco treinos deste setor.')
      status.setAttribute('role', 'status')
      const actions = document.createElement('div')
      actions.className = 'selection-actions'
      panel.append(actions)
      const cancel = button(actions, 'Voltar ao centro', close)
      const nextAvailableByPlayer = new Map(availability.cooldowns.map(item => [item.ownedPlayerId, item.nextAvailableAt]))
      let selectedPlayerId: string | undefined
      let busy = false
      let completed = false
      const updateCooldown = () => {
        const player = focusedPlayer()
        const nextAvailableAt = player ? nextAvailableByPlayer.get(player.id) : undefined
        const seconds = nextAvailableAt ? Math.max(0, Math.ceil((Date.parse(nextAvailableAt) - Date.now()) / 1000)) : 0
        cooldown.textContent = seconds > 0 ? `Próximo treino para ${player!.name} em ${seconds} s.` : 'Este atleta está pronto para treinar.'
        const stat = focus.toLowerCase() as keyof RosterPlayer['stats']
        start.disabled = busy || completed || !player || player.stats[stat] >= 99 || seconds > 0
      }
      cards.element.addEventListener('change', () => { renderStage(); updateCooldown() })
      const refreshAvailability = () => {
        void trainingApi.status().then(value => {
          if (!panel.isConnected) return
          nextAvailableByPlayer.clear()
          for (const item of value.cooldowns) nextAvailableByPlayer.set(item.ownedPlayerId, item.nextAvailableAt)
          updateCooldown()
        }).catch(() => {})
      }
      const start = button(actions, 'Começar treino', () => {
        if (busy || completed) return
        const firstAttempt = !selectedPlayerId
        selectedPlayerId ??= cards.selectedId
        if (!selectedPlayerId) return
        busy = true
        updateCooldown()
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
            const result = await command.train(selectedPlayerId!, focus)
            const updated = await teamApi.roster()
            if (!panel.isConnected || !scene.scene.isActive()) return
            roster = updated
            onRosterUpdated(updated)
            nextAvailableByPlayer.set(result.ownedPlayerId, result.nextAvailableAt)
            completed = true
            if (result.progressAfter !== null) progress.set(`${result.ownedPlayerId}:${focus}`, result.progressAfter)
            renderProgress()
            status.textContent = result.progressAfter === null
              ? 'Treino anterior recuperado. Confira o elenco.'
              : result.statAfter !== result.statBefore
                ? `${label}: ${result.statBefore} → ${result.statAfter} para ${roster.find(player => player.id === result.ownedPlayerId)!.name}!`
                : `${label}: ${result.progressAfter}/5 concluídos. Faltam ${5 - result.progressAfter} treinos para +1.`
            start.remove()
            cancel.disabled = false
            updateCooldown()
          } catch (error: unknown) {
            if (!panel.isConnected || !scene.scene.isActive()) return
            if (error instanceof ApiError && error.rejected) {
              selectedPlayerId = undefined
              cards.disabled = false
              status.textContent = error.code === 'TRAINING_COOLDOWN'
                ? 'Este atleta precisa aguardar 1 minuto desde o último treino.'
                : error.code === 'TRAINING_STAT_MAX' ? 'Este fundamento já está em 99. Escolha outro.'
                  : 'Não foi possível treinar este jogador.'
              refreshAvailability()
              cancel.disabled = false
            } else {
              status.textContent = 'Não foi possível confirmar o treino. Tente novamente para recuperar o mesmo resultado.'
              start.textContent = 'Tentar novamente'
            }
            busy = false
            updateCooldown()
          }
        }
        void run()
      })
      updateCooldown()
      cooldownTimer = window.setInterval(updateCooldown, 1000)
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
