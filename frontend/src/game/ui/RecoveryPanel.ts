import { ApiError, RecoveryCommand, teamApi, type RosterPlayer, type RecoveryReceipt } from '../../api/gameApi'
import type Phaser from 'phaser'
import type { RecoveryStation } from '../maps/recoveryCenter'
import { PlayerCards } from './PlayerCards'
import { button, paragraph, scenePanel } from './ScenePanel'

const command = new RecoveryCommand()
const messages: Record<string, string> = {
  PLAYER_RECOVERING: 'Este atleta já está em tratamento. Escolha outro.',
  PLAYER_ALREADY_RESTED: 'Este atleta já está totalmente recuperado.',
  RECOVERY_STATION_OCCUPIED: 'Este local acabou de ser ocupado. Atualize para escolher outro.',
  RECOVERY_SESSION_CHANGED: 'O tratamento mudou. Atualize o centro.',
}

export async function openRecoveryPanel(
  scene: Phaser.Scene,
  station: RecoveryStation,
  onClose: () => void,
  onRosterUpdated: (roster: RosterPlayer[]) => void,
): Promise<void> {
  const panel = scenePanel(scene, station.label)
  panel.classList.add('recovery-panel')
  const close = () => { panel.dispose(); onClose() }
  let busy = false
  let polling = false
  let cards: PlayerCards | undefined
  let roster: RosterPlayer[] = []
  let targetId: string | undefined
  let confirmed: RecoveryReceipt | undefined
  let action: 'START' | 'CANCEL' = 'START'
  let start: HTMLButtonElement
  let cancel: HTMLButtonElement
  let status: HTMLParagraphElement
  let occupant: RosterPlayer | undefined

  const render = () => {
    panel.replaceChildren()
    cards = undefined
    occupant = roster.find(player => player.recovery?.stationId === station.id)
    const title = document.createElement('h2')
    title.textContent = station.label
    panel.append(title)
    paragraph(panel, 'Recupera todo o cansaço em 5 segundos, tanto na maca quanto no banho de gelo.').className = 'selection-description'
    if (occupant) {
      paragraph(panel, `${occupant.name} está em tratamento. Cansaço: ${Math.ceil(occupant.fatigue?.value ?? 0)}/100.`)
      paragraph(panel, `Disponível às ${new Date(occupant.recovery!.completesAt).toLocaleTimeString('pt-BR')}. Você pode explorar o bairro enquanto ele descansa.`)
      action = 'CANCEL'
    } else {
      paragraph(panel, 'Escolha um atleta para deixar aqui. Ele fica fora de treinos e partidas até terminar; a recuperação continua ao sair do prédio ou fechar o jogo.')
      cards = new PlayerCards(roster)
      panel.append(cards.element)
      action = 'START'
    }
    const estimate = !occupant ? paragraph(panel, '') : undefined
    const preview = () => {
      const player = roster.find(item => item.id === cards?.selectedId)
      if (!estimate) return
      if (!player) { estimate.textContent = 'Escolha um atleta disponível.'; return }
      const fatigue = player.fatigue?.value ?? 0
      estimate.textContent = fatigue ? 'Tempo de recuperação: 5 segundos.' : 'Este atleta já está totalmente recuperado.'
    }
    const naturalForecast = cards?.element.querySelector<HTMLElement>('.fatigue-recovery')
    if (naturalForecast) naturalForecast.hidden = true
    cards?.element.addEventListener('change', preview)
    cards?.element.addEventListener('fatigue-updated', preview)
    preview()
    status = paragraph(panel, occupant ? 'Interromper mantém o descanso já recuperado.' : 'Ao terminar, o atleta volta a ficar disponível automaticamente.')
    status.setAttribute('role', 'status')
    const actions = document.createElement('div')
    actions.className = 'selection-actions'
    panel.append(actions)
    cancel = button(actions, 'Voltar ao centro', close)
    start = button(actions, occupant ? 'Interromper recuperação' : 'Deixar jogador descansando', () => { void submit() })
    const availability = () => {
      const player = roster.find(item => item.id === cards?.selectedId)
      start.disabled = !occupant && (!player || Boolean(player.recovery) || !player.fatigue?.value)
    }
    cards?.element.addEventListener('change', availability)
    cards?.element.addEventListener('fatigue-updated', availability)
    availability()
  }

  const refresh = async () => {
    roster = await teamApi.roster()
    if (!panel.isConnected) return
    onRosterUpdated(roster)
    render()
  }

  const submit = async () => {
    if (busy) return
    targetId ??= action === 'CANCEL' ? occupant?.recovery?.sessionId : cards?.selectedId
    if (!targetId) return
    const submittedAction = action
    busy = true
    start.disabled = true
    cancel.disabled = true
    if (cards) cards.disabled = true
    status.textContent = 'Confirmando a recuperação…'
    try {
      confirmed ??= submittedAction === 'START' ? await command.start(targetId, station.id) : await command.cancel(targetId)
      // Once the command succeeds, retries refresh only; they cannot create another treatment.
      await refresh()
      if (!panel.isConnected) return
      status.textContent = submittedAction === 'START' && !confirmed.session.cancelledAt
        ? 'Jogador entregue à equipe de saúde. Pode continuar explorando!'
        : 'Recuperação interrompida. O descanso já recebido foi preservado.'
      confirmed = undefined
      targetId = undefined
    } catch (error) {
      if (!panel.isConnected) return
      const rejected = !confirmed && error instanceof ApiError && error.rejected
      status.textContent = rejected ? messages[error.code] ?? 'Não foi possível iniciar este tratamento.'
        : 'Não foi possível confirmar. Tente novamente para recuperar o mesmo resultado.'
      start.textContent = 'Tentar novamente'
      start.disabled = false
      if (rejected) {
        targetId = undefined
        cancel.disabled = false
        if (cards) cards.disabled = false
        start.textContent = 'Atualizar elenco'
        start.onclick = () => { void load() }
      }
    } finally { busy = false }
  }

  paragraph(panel, 'Carregando elenco…')
  const load = async () => {
    try { await refresh() }
    catch {
      if (!panel.isConnected) return
      panel.replaceChildren()
      paragraph(panel, 'Não foi possível carregar o elenco.')
      button(panel, 'Tentar novamente', () => { void load() })
      button(panel, 'Voltar ao centro', close)
    }
  }
  const timer = window.setInterval(() => {
    if (!panel.isConnected) { window.clearInterval(timer); return }
    if (busy || polling || targetId || confirmed || !occupant) return
    polling = true
    void refresh().catch(() => { /* Commands remain authoritative; keep the previous view. */ }).finally(() => { polling = false })
  }, 5000)
  await load()
}
