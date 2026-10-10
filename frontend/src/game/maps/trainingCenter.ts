import type { ResidentSprite } from './locations'
import type { TrainingFocus } from '../../api/gameApi'

export interface TrainingSector {
  focus: TrainingFocus
  label: string
  coach: string
  sprite: ResidentSprite
  dialogue: string
  x: number
  y: number
}

export const TRAINING_SECTORS: TrainingSector[] = [
  { focus: 'SPEED', label: 'VELOCIDADE', coach: 'Treinador Caio', sprite: 'resident-sport', dialogue: 'Vamos trabalhar velocidade na esteira.', x: 220, y: 220 },
  { focus: 'DRIBBLING', label: 'DRIBLE', coach: 'Treinadora Renata', sprite: 'resident-braid', dialogue: 'Vamos treinar mudanças de direção com a bola.', x: 480, y: 220 },
  { focus: 'FINISHING', label: 'FINALIZAÇÃO', coach: 'Treinadora Sílvia', sprite: 'resident-curly', dialogue: 'Vamos repetir chutes a gol.', x: 740, y: 220 },
  { focus: 'DEFENDING', label: 'MARCAÇÃO', coach: 'Treinador Edgar', sprite: 'resident-beard', dialogue: 'Vamos praticar a marcação e a perseguição.', x: 350, y: 365 },
  { focus: 'PHYSICAL', label: 'FÍSICO', coach: 'Treinadora Priscila', sprite: 'resident-cap', dialogue: 'Vamos trabalhar força na musculação.', x: 610, y: 365 },
]
