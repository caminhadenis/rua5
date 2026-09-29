import type { ResidentSprite } from './locations'

// Authored neighborhood conversations; residents never create matches or grant progress.
export const RESIDENTS: { kind: 'resident'; name: string; spawnKey: string; sprite: ResidentSprite; dialogue: string }[] = [
  {
    kind: 'resident', name: 'Dona Lia', sprite: 'resident-elder', spawnKey: 'benfica.resident.lia',
    dialogue: 'O professor Dimas treinava na escola. Hoje Íris e Tito guardam a defesa do estádio. Encontre Nilo e monte seu time antes de chegar lá.',
  },
  {
    kind: 'resident', name: 'Seu Otávio', sprite: 'resident-elder', spawnKey: 'benfica.resident.otavio',
    dialogue: 'Dimas observa tudo com um cronômetro antigo. Lia distribui os passes, Ivo corre pelo lado e Mara finaliza. Treine sua equipe antes de entrar!',
  },
  {
    kind: 'resident', name: 'Mara da rua', sprite: 'resident', spawnKey: 'benfica.resident.mara',
    dialogue: 'O estádio está logo a sudeste. A Mara que joga lá tem meu nome, mas chuta bem melhor! Vença desafios, recrute e escale cinco para enfrentá-la.',
  },
]
