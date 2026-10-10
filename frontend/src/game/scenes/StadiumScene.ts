import Phaser from 'phaser'
import { gameAudio } from '../audio/GameAudio'
import { ApiError, StadiumCommand, stadiumApi, teamApi, type StadiumInfo, type StadiumResponse } from '../../api/gameApi'
import { coachGreeting, coachVerdict } from '../match/stadiumPresentation'
import { PlayerCards } from '../ui/PlayerCards'
import { fatigueReceiptText } from '../ui/fatigue'
import { button, paragraph, scenePanel } from '../ui/ScenePanel'

export class StadiumScene extends Phaser.Scene {
  private readonly command = new StadiumCommand()
  private id = ''
  private previousResult?: StadiumResponse
  private panel!: ReturnType<typeof scenePanel>
  constructor() { super('StadiumScene') }
  init(data: { id: string; result?: StadiumResponse }): void {
    this.id = data.id
    this.previousResult = data.result
  }
  create(): void {
    gameAudio.setMusic('city')
    this.panel = scenePanel(this, 'Estádio')
    this.panel.classList.add('stadium-panel')
    void this.loadStadium()
  }
  private leave(): void {
    this.scene.wake('InteriorScene')
    this.scene.stop()
  }
  private showCoach(words: string[]): HTMLElement {
    const dialogue = document.createElement('div')
    dialogue.className = 'coach-dialogue'
    dialogue.innerHTML = '<span class="coach-portrait" aria-hidden="true"></span><div class="coach-lines"><strong>Professor Dimas · treinador</strong></div>'
    dialogue.querySelector<HTMLElement>('.coach-portrait')!.style.backgroundImage = `url("${import.meta.env.BASE_URL}assets/placeholders/resident-elder.svg")`
    const lines = dialogue.querySelector<HTMLElement>('.coach-lines')!
    for (const word of words) paragraph(lines, word)
    this.panel.append(dialogue)
    return lines
  }
  private showResult(info: StadiumInfo): void {
    const result = this.previousResult!
    const { match, rewards } = result
    this.panel.classList.add('coach-result-panel')
    const nextOpponent = info.series && !info.series.finished ? info.opponentLineup[info.series.played] : undefined
    this.showCoach(coachVerdict(result, nextOpponent))
    const penalties = match.penalties ? ` · Pênaltis ${match.penalties.home} × ${match.penalties.away}` : ''
    paragraph(this.panel, `${match.outcome === 'WIN' ? 'Vitória!' : 'Derrota'} ${match.home[0]!.name} ${match.homeScore} × ${match.awayScore} ${match.away[0]!.name}${penalties}`).dataset.testid = 'stadium-result'
    const award = rewards.players[0]!
    paragraph(this.panel, `+${award.xpAwarded} XP · Nível ${award.currentLevel}`)
    if (award.fatigue) paragraph(this.panel, fatigueReceiptText(award.fatigue)).className = 'fatigue-status'
    paragraph(this.panel, `${rewards.series.wins}/5 vitórias nesta tentativa`).setAttribute('role', 'status')
    const actions = document.createElement('div')
    actions.className = 'stadium-actions'
    this.panel.append(actions)
    if (rewards.trophy) {
      paragraph(this.panel, `Troféu conquistado: ${rewards.trophy.name}. Estádio concluído.`).setAttribute('role', 'status')
      button(actions, 'Ver conquistas', () => {
        this.scene.stop('InteriorScene')
        this.scene.run('TeamScene')
        this.scene.stop()
      })
    } else button(actions, rewards.series.finished ? 'Recomeçar sequência' : 'Próximo adversário', () => {
      this.previousResult = undefined
      void this.loadStadium()
    })
    button(actions, 'Voltar ao estádio', () => this.leave())
  }
  private async loadStadium(): Promise<void> {
    this.panel.replaceChildren()
    this.panel.classList.remove('coach-result-panel')
    paragraph(this.panel, 'Carregando estádio…')
    try {
      const [info, roster] = await Promise.all([stadiumApi.get(this.id), teamApi.roster()])
      if (!this.scene.isActive()) return
      this.panel.replaceChildren()
      const title = document.createElement('h2')
      title.textContent = info.name
      this.panel.append(title)
      if (this.previousResult) { this.showResult(info); return }
      const lines = this.showCoach([])
      const active = info.series && !info.series.finished
      const roundNumber = active ? info.series!.played + 1 : 1
      const opponent = info.opponentLineup[roundNumber - 1]!
      let speech = 0
      const showSpeech = (message: string) => {
        lines.querySelector('p')?.remove()
        paragraph(lines, message)
      }
      showSpeech(info.status === 'COMPLETED'
        ? `A ${info.trophy.name} está com você. Venceu meus cinco jogadores, um de cada vez!`
        : active ? `Agora vou colocar ${opponent.name} no duelo ${roundNumber}/5. Escolha o atleta que vai enfrentar ${opponent.name}!`
          : coachGreeting[speech])
      if (info.status !== 'COMPLETED') button(this.panel, 'Ouvir mais de Dimas', () => {
        speech = (speech + 1) % coachGreeting.length
        showSpeech(coachGreeting[speech])
      }).className = 'stadium-coach-next'
      paragraph(this.panel, `Ordem dos duelos: ${info.opponentLineup.map(p => `${p.name} · Nv. ${p.level}`).join(' → ')}`).className = 'stadium-opponents'
      const message = {
        AVAILABLE: active
          ? `${info.series!.wins}/5 vitórias. Próximo duelo: ${roundNumber}/5 contra ${info.opponentLineup[roundNumber - 1]!.name}.`
          : 'Vença os cinco duelos 1 × 1 seguidos. Se perder um, recomeça do primeiro.',
        LOCKED: 'Estádio bloqueado. Conquiste os troféus necessários para entrar.',
        COMPLETED: `Conquistado · ${info.trophy.name}. Este estádio está concluído.`,
      }[info.status]
      const seriesStatus = paragraph(this.panel, message)
      seriesStatus.className = 'stadium-series-status'
      seriesStatus.setAttribute('role', 'status')
      const actions = document.createElement('div')
      actions.className = 'stadium-actions'
      this.panel.append(actions)
      const back = button(actions, 'Voltar ao estádio', () => this.leave())
      if (info.status !== 'AVAILABLE') return
      if (roster.length < 5) {
        lines.replaceChildren()
        paragraph(lines, `Não posso aceitar seu desafio ainda. Você precisa ter pelo menos 5 jogadores no elenco! Seu time tem ${roster.length}. Explore as ruas e convide novos atletas.`)
        return
      }
      paragraph(this.panel, `Dimas escolheu: ${opponent.name} · Nível ${opponent.level}`).className = 'stadium-next-opponent'
      paragraph(this.panel, 'Escolha um atleta para este duelo. Cada duelo gera +18 de desgaste. Pode repetir um atleta ou escolher outro descansado.').className = 'selection-description'
      const cards = new PlayerCards(roster)
      this.panel.append(cards.element)
      const status = paragraph(this.panel, '')
      status.className = 'selection-status'
      const start = button(actions, 'Iniciar duelo 1 × 1', () => {
        if (!cards.selectedId) return
        start.disabled = true
        back.disabled = true
        cards.disabled = true
        status.textContent = 'Simulando duelo…'
        gameAudio.setMusic('duel')
        void this.command.play(this.id, cards.selectedId, info.series?.id ?? null, roundNumber).then(result => {
          if (!this.scene.isActive()) return
          this.scene.start('MatchScene', { match: result.match, rewards: null, stadium: result })
        }).catch((error: unknown) => {
          if (!this.scene.isActive()) return
          gameAudio.setMusic('city')
          if (error instanceof ApiError && error.rejected) {
            status.textContent = 'Não foi possível iniciar. Atualize as condições do estádio.'
            back.disabled = false
            button(actions, 'Atualizar estádio', () => { void this.loadStadium() })
          } else {
            status.textContent = 'Resposta não recebida. Recupere o mesmo duelo.'
            start.textContent = 'Recuperar partida'
            start.disabled = false
          }
        })
      })
      start.disabled = !cards.selectedId
      cards.element.addEventListener('fatigue-updated', () => { if (!cards.element.disabled) start.disabled = !cards.selectedId })
    } catch {
      if (!this.scene.isActive()) return
      this.panel.replaceChildren()
      paragraph(this.panel, 'Não foi possível carregar o estádio.')
      button(this.panel, 'Tentar novamente', () => { void this.loadStadium() })
      button(this.panel, 'Voltar ao estádio', () => this.leave())
    }
  }
}
