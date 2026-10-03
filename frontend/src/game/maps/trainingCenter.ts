import type { TrainingFocus } from '../../api/gameApi'

export interface TrainingSector {
  focus: TrainingFocus
  label: string
  coach: string
  dialogue: string
  x: number
  y: number
}

export const TRAINING_SECTORS: TrainingSector[] = [
  { focus: 'SPEED', label: 'VELOCIDADE', coach: 'Treinador Caio', dialogue: 'Vamos trabalhar velocidade na esteira.', x: 220, y: 220 },
  { focus: 'DRIBBLING', label: 'DRIBLE', coach: 'Treinadora Bia', dialogue: 'Vamos treinar mudanças de direção com a bola.', x: 480, y: 220 },
  { focus: 'PASSING', label: 'PASSE', coach: 'Treinador Gui', dialogue: 'Vamos praticar a troca de passes.', x: 740, y: 220 },
  { focus: 'FINISHING', label: 'FINALIZAÇÃO', coach: 'Treinadora Mara', dialogue: 'Vamos repetir chutes a gol.', x: 220, y: 365 },
  { focus: 'DEFENDING', label: 'MARCAÇÃO', coach: 'Treinador Raul', dialogue: 'Vamos praticar a marcação e a perseguição.', x: 480, y: 365 },
  { focus: 'PHYSICAL', label: 'FÍSICO', coach: 'Treinadora Sol', dialogue: 'Vamos trabalhar força na musculação.', x: 740, y: 365 },
]
