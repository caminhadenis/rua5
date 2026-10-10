import type { ResidentSprite } from './locations'

// Authored neighborhood conversations; residents never create matches or grant progress.
export const RESIDENTS: { kind: 'resident'; name: string; spawnKey: string; sprite: ResidentSprite; dialogue: string }[] = [
  {
    kind: 'resident', name: 'Dona Celina', sprite: 'resident-dress', spawnKey: 'benfica.resident.lia',
    dialogue: 'O professor Dimas treinava na escola. Hoje Íris e Tito são fortes na marcação. Encontre Nilo e prepare seu atleta para os duelos do estádio.',
  },
  {
    kind: 'resident', name: 'Seu Gaspar', sprite: 'resident-beard', spawnKey: 'benfica.resident.otavio',
    dialogue: 'Dimas observa tudo com um cronômetro antigo. Lia, Ivo e os outros jogam duelos individuais. Treine antes de entrar: precisa vencer os cinco seguidos!',
  },
  {
    kind: 'resident', name: 'Yara', sprite: 'resident-braid', spawnKey: 'benfica.resident.mara',
    dialogue: 'O estádio está logo a sudeste. Mara, a finalizadora de lá, capricha nos chutes! Vença desafios e recrute. Lá dentro, escolha seu atleta para cada duelo 1 × 1.',
  },
]
