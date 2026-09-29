import type { MatchEvent, Participant, StadiumResponse } from '../../api/gameApi'

export const coachGreeting = [
  'Bem-vindo ao meu campo. Sou o professor Dimas; aqui, cada passe conta.',
  'Íris e Tito protegem a defesa. Lia arma, Ivo acelera e Mara procura o gol. Quero ver seus cinco jogando juntos.',
  'Quando o cronômetro correr, observe os lances. Se houver empate, decidiremos nos pênaltis.',
]

export function coachVerdict(result: StadiumResponse): string[] {
  const { match, rewards } = result
  if (match.outcome === 'WIN') return [
    'Vocês encontraram espaço e souberam decidir a partida. Foi uma vitória merecida!',
    rewards.trophy
      ? `Receba ${rewards.trophy.name}. Agora ela faz parte das suas conquistas.`
      : 'Boa partida. O resultado está registrado.',
  ]
  const homeEvents = match.events.filter(event => event.side === 'HOME')
  if (match.penalties) return [
    'O jogo foi equilibrado, mas faltou calma na decisão por pênaltis.',
    'Treine a finalização dos seus jogadores e tente novamente. Um chute bem colocado muda tudo.',
  ]
  if (homeEvents.some(event => event.type === 'SHOT_MISSED' || event.type === 'SAVE')) return [
    'Seu time criou chances, mas não conseguiu aproveitar as finalizações.',
    'Treine finalização e experimente escalar quem chuta melhor no ataque.',
  ]
  if (match.awayScore > match.homeScore) return [
    'Meu time encontrou espaço para marcar. Sua defesa precisa se fechar mais cedo.',
    'Treine marcação e tente colocar jogadores fortes na defesa antes da revanche.',
  ]
  return [
    'Seu time lutou até o fim, mas ainda faltou transformar as jogadas em gols.',
    'Experimente outra escalação e treine passe ou finalização antes de voltar.',
  ]
}

// Fixed formations are visual anchors. Events move the acting athlete; the backend owns the match.
const slots = {
  HOME: [[17, 30], [17, 70], [37, 24], [37, 76], [43, 50]],
  AWAY: [[83, 30], [83, 70], [63, 24], [63, 76], [57, 50]],
} as const

export function pitchPosition(side: 'HOME' | 'AWAY', index: number): { x: number; y: number } {
  const [x, y] = slots[side][index] ?? slots[side][4]
  return { x, y }
}

export function actingPosition(event: MatchEvent, participants: Participant[]): { x: number; y: number } | undefined {
  const side = event.side
  const team = side === 'HOME' ? participants.slice(0, 5) : participants.slice(5)
  const index = team.findIndex(player => player.playerId === event.actorPlayerId)
  if (index < 0) return undefined
  const base = pitchPosition(side, index)
  return { x: Math.min(88, Math.max(12, base.x + (side === 'HOME' ? 10 : -10))), y: base.y }
}
