import type { Participant, StadiumResponse } from '../../api/gameApi'

export const coachGreeting = [
  'Bem-vindo ao meu campo. Sou o professor Dimas; aqui, os jogos são sempre 1 × 1.',
  'Tenho cinco jogadores. Você enfrenta um de cada vez, e o mais forte entra por último.',
  'Vença os cinco seguidos para ganhar a taça. Uma derrota encerra a tentativa; no empate, decidimos nos pênaltis.',
]

export function coachVerdict(result: StadiumResponse, nextOpponent?: Participant): string[] {
  const { match, rewards } = result
  if (rewards.trophy) return [
    'Você venceu meus cinco jogadores, um de cada vez. Mereceu a taça!',
    `Receba ${rewards.trophy.name}. Agora ela faz parte das suas conquistas.`,
  ]
  if (match.outcome === 'WIN') return [
    `Gostei do que vi! Você venceu ${match.away[0]?.name ?? 'meu jogador'}. Já são ${rewards.series.wins}/5 vitórias nesta sequência.`,
    nextOpponent
      ? `Agora vou colocar ${nextOpponent.name} no próximo duelo${rewards.series.wins === 4 ? ', meu jogador mais forte' : ''}. Escolha o atleta que vai enfrentar ${nextOpponent.name}!`
      : 'Prepare seu atleta para o próximo adversário. Ainda é preciso vencer todos!',
  ]
  return [
    match.penalties ? 'Meu jogador venceu nos pênaltis. A tentativa termina aqui.'
      : 'Meu jogador venceu este duelo. A tentativa termina aqui.',
    'Treine seu atleta ou escolha outro do elenco. Na próxima tentativa, começa pelo primeiro adversário.',
  ]
}
