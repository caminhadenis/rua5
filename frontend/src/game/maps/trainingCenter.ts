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
  { focus: 'SPEED', label: 'VELOCIDADE', coach: 'Treinador Caio', dialogue: 'Nesta esteira, o atleta trabalha a velocidade. Escolha quem vai treinar e pressione Enter para começar.', x: 220, y: 190 },
  { focus: 'DRIBBLING', label: 'DRIBLE', coach: 'Treinadora Bia', dialogue: 'Três cones, mudanças de direção e bola colada no pé. Escolha seu atleta e pressione Enter para treinar drible.', x: 480, y: 190 },
  { focus: 'PASSING', label: 'PASSE', coach: 'Treinador Gui', dialogue: 'Aqui treinamos a troca de passes com um parceiro. Escolha seu atleta e pressione Enter para começar.', x: 740, y: 190 },
  { focus: 'FINISHING', label: 'FINALIZAÇÃO', coach: 'Treinadora Mara', dialogue: 'O gol está vazio para repetir os chutes. Escolha seu atleta e pressione Enter para treinar finalização.', x: 220, y: 330 },
  { focus: 'DEFENDING', label: 'MARCAÇÃO', coach: 'Treinador Raul', dialogue: 'Acompanhe o adversário em cada mudança de direção. Escolha seu atleta e pressione Enter para treinar marcação.', x: 480, y: 330 },
  { focus: 'PHYSICAL', label: 'FÍSICO', coach: 'Treinadora Sol', dialogue: 'A musculação ajuda o atleta a ganhar força. Escolha seu atleta e pressione Enter para treinar físico.', x: 740, y: 330 },
]
