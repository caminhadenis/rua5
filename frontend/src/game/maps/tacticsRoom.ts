import type { InteriorLocation } from './locations'
import type { Position } from './interactions'

export const TACTICS_HOUSE_KEY = 'benfica.house.01.entry'
export const TACTICS_BOARD = { key: 'benfica.house.01.tactics-board', x: 480, y: 255 }
export const TACTICS_PLAYER_STOP = { x: 480, y: 290 }
export const TACTICS_COACH_STOP = { x: 420, y: 290 }

// Explanations live in the neighborhood; match controls only show the selected commands.
export const TACTICS_GREETING = [
  'Seja bem-vindo! Sou Dona Amélia, treinadora aposentada.',
  'Treinei o Professor Dimas antes de ele assumir o estádio.',
  'Venha comigo ao mural. Vou mostrar como orientar seu atleta durante as partidas.',
]

export const TACTICS_LESSONS = [
  { id: 'tempo-fast', title: 'Ritmo: apressar', text: 'Apressar tenta criar mais oportunidades, mas arrisca mais e cansa mais rápido.' },
  { id: 'tempo-slow', title: 'Ritmo: cadenciar', text: 'Cadenciar segura mais a bola, arrisca menos e poupa energia. Pode ajudar a manter o placar.' },
  { id: 'tempo-normal', title: 'Ritmo: normal', text: 'Normal é um meio-termo entre oportunidades e desgaste.' },
  { id: 'posture-offensive', title: 'Postura: ofensivo', text: 'Ofensivo reforça o ataque, mas deixa a defesa mais vulnerável.' },
  { id: 'posture-defensive', title: 'Postura: defensivo', text: 'Defensivo reforça a marcação, mas reduz a força para atacar.' },
  { id: 'posture-balanced', title: 'Postura: equilibrado', text: 'Equilibrado mantém o equilíbrio entre ataque e defesa.' },
  { id: 'effort', title: 'Ritmo e energia', text: 'O ritmo muda o gasto de energia. A postura não muda diretamente esse gasto.' },
  { id: 'fatigue', title: 'Observe o fôlego', text: 'O cansaço cresce durante a partida e reduz o rendimento, principalmente a velocidade.' },
  { id: 'physical', title: 'Resistência física', text: 'Um atleta com mais físico aguenta melhor o esforço da partida.' },
  { id: 'pause', title: 'Pausa para orientar', text: 'A pausa para orientar dá tempo para decidir, mas não recupera energia durante a partida.' },
  { id: 'recovery', title: 'Recupere seu atleta', text: 'Fora da partida, deixe o atleta descansar ou visite o Centro de Recuperação.' },
  { id: 'need-goal', title: 'Busque o gol', text: 'Precisando de um gol? Experimente Apressar + Ofensivo.' },
  { id: 'protect-score', title: 'Proteja o placar', text: 'Na frente e com pouco fôlego? Cadenciar + Defensivo pode ajudar a segurar o resultado.' },
  { id: 'instructions', title: 'Escolha a orientação', text: 'Escolha ritmo e postura separadamente. Suas mudanças valem no próximo trecho da partida.' },
  { id: 'uncertainty', title: 'Leia o jogo', text: 'Nenhuma tática garante vitória. Os atributos, o cansaço e a surpresa do futebol continuam contando!' },
]

/** Authored room clearance, including feet and space for the walking characters. */
export function tacticsRoomWalkable(location: InteriorLocation, point: Position): boolean {
  return point.x >= 104 && point.x <= 856 && point.y >= 156 && point.y <= 450 &&
    !location.furniture.some(item => Math.abs(point.x - item.x) < item.width / 2 + 22 &&
      Math.abs(point.y + 13 - item.y) < item.height / 2 + 22) &&
    !location.people.some(person => person.role !== 'tactics-coach' &&
      Math.hypot(point.x - person.x, point.y - person.y) < 40) &&
    !(point.x > 336 && point.x < 624 && point.y < 256)
}
