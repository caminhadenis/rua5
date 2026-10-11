import type { RosterPlayer, TrainingFocus } from '../../api/gameApi'
import { starterUniformUrl, uniformUrl, originalUniformUrls } from '../team/teamColors'

export const TRAINING_DURATION_MS = 5_000

const descriptions: Record<TrainingFocus, string> = {
  SPEED: 'correndo na esteira',
  DRIBBLING: 'driblando três cones',
  FINISHING: 'chutando para o gol vazio',
  DEFENDING: 'acompanhando um adversário que muda de direção',
  PHYSICAL: 'levantando pesos',
}

/** Purely visual. The training command is sent only after its five second playback. */
export function trainingStage(player: RosterPlayer, focus: TrainingFocus): HTMLElement {
  const stage = document.createElement('section')
  stage.className = 'training-stage'
  stage.dataset.focus = focus
  stage.dataset.testid = 'training-stage'
  stage.setAttribute('aria-label', `${player.name} ${descriptions[focus]}`)
  stage.innerHTML = `
    <div class="training-floor"></div>
    <div class="training-treadmill"><span></span></div>
    <div class="training-cones"><i></i><i></i><i></i></div>
    <div class="training-goal"><span>GOL!</span></div>
    <div class="training-weights"><span></span></div>
    <div class="training-partner"><span class="training-sprite"></span><small>Parceiro</small></div>
    <div class="training-athlete"><span class="training-sprite"></span><small></small></div>
    <div class="training-ball"></div>
    <div class="training-clock">5 s</div>`
  const athlete = stage.querySelector<HTMLElement>('.training-athlete .training-sprite')!
  const starter = player.playerDefinitionId.startsWith('starter_')
  const asset = starter ? 'player' : 'challenger'
  athlete.style.backgroundImage = `url("${starter ? starterUniformUrl(player.playerDefinitionId) : uniformUrl(asset)}")`
  athlete.dataset.asset = asset
  stage.querySelector<HTMLElement>('.training-athlete small')!.textContent = player.name
  const partner = stage.querySelector<HTMLElement>('.training-partner .training-sprite')!
  partner.style.backgroundImage = `url("${originalUniformUrls.challenger}")`
  partner.dataset.asset = 'challenger'
  return stage
}
