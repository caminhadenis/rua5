import type { ResidentSprite } from './locations'
import type { TrainingFocus } from '../../api/gameApi'

export const TRAINING_INTRO = [
  'Bem-vindo ao Centro de Treinamento! Aqui você prepara os atletas do seu time.',
  'Temos cinco setores: velocidade, drible, finalização, marcação e físico.',
  'Converse com o treinador do setor e escolha qual atleta vai treinar.',
  'O treino melhora apenas o fundamento do setor escolhido.',
  'Descansado, o atleta ganha +0,25 por treino nesse fundamento.',
  'Cansado, o ganho diminui para +0,20 por treino.',
  'Muito cansado, o atleta ganha +0,15 por treino.',
  'Exausto, ele ainda melhora, mas ganha apenas +0,05 por treino.',
  'Cada fundamento pode chegar até 99. Consulte os atributos no menu Equipe.',
  'Treino não dá XP nem aumenta o nível. Para subir de nível, dispute partidas.',
  'Cada treino gera 12 pontos de desgaste. Descansar ou visitar o Centro de Recuperação melhora o rendimento.',
  'Cada sessão dura cinco segundos. Ao terminar, você pode treinar novamente sem esperar.',
]

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
