export type ResidentSprite = 'resident' | 'resident-elder' | 'resident-student' | 'resident-sport' | 'resident-physio' | 'resident-masseur' | 'resident-dress' | 'resident-beard' | 'resident-braid' | 'resident-cap' | 'resident-curly'
export type FurnitureKind = 'sofa' | 'table' | 'shelf' | 'bed' | 'plant' | 'desk' | 'rack' | 'counter'
type Furniture = { kind: FurnitureKind; x: number; y: number; width: number; height: number }
type Person = { name: string; dialogue: string; x: number; y: number; sprite: ResidentSprite; role?: 'trainer' | 'stadium-coach' | 'supporter' | 'physiotherapist' | 'masseur' | 'tactics-coach' }

export interface InteriorLocation {
  key: string; name: string; kind: 'university' | 'home' | 'school' | 'gym' | 'apartment' | 'stadium' | 'recovery'
  floorColor: number; wallColor: number; accentColor: number
  pattern: 'wood' | 'tile' | 'mat'; wallLabel: string
  furniture: Furniture[]; people: Person[]
}

// Room plans, people and conversations are static content keyed by stable map doors.
export const INTERIORS: InteriorLocation[] = [
  {
    key: 'benfica.recovery.entry', name: 'Centro de Recuperação', kind: 'recovery',
    floorColor: 0xb6cdc7, wallColor: 0x365962, accentColor: 0x67b5af, pattern: 'tile', wallLabel: 'DESCANSAR TAMBÉM É PREPARAR',
    furniture: [{ kind: 'counter', x: 165, y: 405, width: 110, height: 38 }],
    people: [
      { name: 'Fisioterapeuta Helena', role: 'physiotherapist', sprite: 'resident-physio', x: 325, y: 330,
        dialogue: 'Bem-vindo ao Centro de Recuperação! Deixe seus atletas nas macas para descansar. No canto, os banhos de gelo ajudam a recuperar o cansaço.' },
      { name: 'Massagista Vítor', role: 'masseur', sprite: 'resident-masseur', x: 550, y: 330,
        dialogue: 'Cuidamos dos atletas enquanto você explora o bairro. Aproxime-se de uma maca ou de um balde de gelo para escolher quem vai descansar.' },
    ],
  },
  {
    key: 'benfica.university.entry', name: 'Universidade Rua 5', kind: 'university',
    floorColor: 0xbeb493, wallColor: 0x344b52, accentColor: 0x697f72, pattern: 'tile', wallLabel: 'ESCOLA DE FORMAÇÃO DE TREINADORES',
    furniture: [
      { kind: 'desk', x: 442, y: 180, width: 72, height: 40 },
      ...[270, 350, 610, 690].flatMap(x => [290, 360].map(y => ({ kind: 'sofa' as const, x, y, width: 48, height: 28 }))),
    ],
    people: [
      { name: 'Reitor Augusto', sprite: 'resident-elder', x: 510, y: 260,
        dialogue: 'Parabéns pela formação! Explore as ruas, vença desafiantes e convide-os para o seu time. Leve cinco atletas para desafiar o treinador do estádio.' },
      { name: 'Formanda Clara', sprite: 'resident-student', x: 275, y: 415,
        dialogue: 'Estou esperando minha vez de receber o diploma. Quero montar um time com as cores da minha família!' },
      { name: 'Formando André', sprite: 'resident-sport', x: 685, y: 415,
        dialogue: 'O reitor ensinou que descansar também faz parte do treino. Boa sorte com seu novo time!' },
    ],
  },
  {
    key: 'benfica.stadium.entry', name: 'Estádio do Benfica', kind: 'stadium',
    floorColor: 0x53866a, wallColor: 0x763f41, accentColor: 0xf5ead2, pattern: 'mat', wallLabel: 'CASA DO TIME DE DIMAS',
    furniture: [{ kind: 'counter', x: 160, y: 430, width: 96, height: 34 }],
    people: [
      { name: 'Professor Dimas', role: 'stadium-coach', sprite: 'resident-elder', x: 720, y: 265,
        dialogue: 'Bem-vindo! Meus cinco atletas entram um de cada vez. Vença todos no 1 × 1 para levar a taça; perdeu um, recomeça. Enter para escolher seu atleta.' },
      { name: 'Rita da arquibancada', role: 'supporter', sprite: 'resident', x: 180, y: 225,
        dialogue: 'Eu sou do time de Dimas! Vou torcer por cada um dos nossos cinco. Hoje você não leva essa taça!' },
      { name: 'Douglas da torcida', role: 'supporter', sprite: 'resident-sport', x: 310, y: 355,
        dialogue: 'Vim com as cores do nosso time! Dimas, estamos com você! Quero ver seu atleta perder já no primeiro duelo.' },
      { name: 'Naná da bandeira', role: 'supporter', sprite: 'resident-student', x: 790, y: 390,
        dialogue: 'Minha bandeira é do time do estádio. Vou gritar contra você em cada chute! Nossos cinco vão defender a taça.' },
      { name: 'Seu Osvaldo da faixa', role: 'supporter', sprite: 'resident-elder', x: 390, y: 185,
        dialogue: 'Esta faixa diz tudo: VAMOS, DIMAS! Sou torcedor da casa. Basta um dos nossos vencer para você começar tudo de novo!' },
    ],
  },
  {
    key: 'benfica.house.01.entry', name: 'Casa da Dona Amélia', kind: 'home',
    floorColor: 0xc7b391, wallColor: 0x345b52, accentColor: 0xd6b36b, pattern: 'wood', wallLabel: 'CADA JOGADA TEM UMA ESCOLHA',
    furniture: [
      { kind: 'shelf', x: 173, y: 180, width: 118, height: 44 },
      { kind: 'sofa', x: 765, y: 194, width: 132, height: 56 },
      { kind: 'plant', x: 810, y: 360, width: 36, height: 36 },
    ],
    people: [
      { name: 'Dona Amélia', role: 'tactics-coach', sprite: 'resident-dress', x: 313, y: 300, dialogue: 'Venha ao mural para aprender a orientar seu atleta.' },
      { name: 'Elisa', sprite: 'resident-braid', x: 650, y: 340, dialogue: 'Ajudo a Dona Amélia a guardar os esquemas de jogo. Dimas aprendeu com ela! O mural explica as escolhas que você faz durante cada duelo.' },
    ],
  },
  {
    key: 'benfica.house.02.entry', name: 'Casa do Seu Otávio', kind: 'home',
    floorColor: 0xa6a491, wallColor: 0x52605a, accentColor: 0x8c7252, pattern: 'tile', wallLabel: 'RÁDIO DE JOGO',
    furniture: [
      { kind: 'shelf', x: 170, y: 190, width: 104, height: 86 },
      { kind: 'counter', x: 494, y: 161, width: 148, height: 42 },
      { kind: 'table', x: 759, y: 201, width: 104, height: 64 },
    ],
    people: [
      { name: 'Seu Otávio', sprite: 'resident-elder', x: 329, y: 341, dialogue: 'Anoto cada placar no rádio. Dimas raramente grita: ele observa os duelos e orienta cada atleta. Tito e Íris marcam muito bem no 1 × 1.' },
      { name: 'Hugo', sprite: 'resident-cap', x: 690, y: 307, dialogue: 'Meu pai fala só da defesa, mas eu gosto do drible do Ivo. Ele é um dos cinco rivais que você enfrenta, um de cada vez.' },
    ],
  },
  {
    key: 'benfica.house.03.entry', name: 'Casa da Cecília', kind: 'home',
    floorColor: 0xbd8f78, wallColor: 0x744b51, accentColor: 0xdaae73, pattern: 'wood', wallLabel: 'BANDEIRAS DA TORCIDA',
    furniture: [
      { kind: 'desk', x: 202, y: 180, width: 130, height: 58 },
      { kind: 'sofa', x: 520, y: 188, width: 150, height: 62 },
      { kind: 'plant', x: 805, y: 202, width: 40, height: 40 },
    ],
    people: [
      { name: 'Cecília', sprite: 'resident-curly', x: 318, y: 320, dialogue: 'Eu acompanho os jogos da arquibancada! Dimas treina cada atleta para o duelo individual. Mara capricha nos chutes.' },
      { name: 'Tomás', sprite: 'resident-cap', x: 710, y: 345, dialogue: 'Gosto de observar o Ivo do estádio. Ele dribla muito bem. Quero ver alguém acompanhá-lo!' },
    ],
  },
  {
    key: 'benfica.house.04.entry', name: 'Casa da Rosa', kind: 'home',
    floorColor: 0x9caeb0, wallColor: 0x49677a, accentColor: 0x67a6a7, pattern: 'tile', wallLabel: 'JANELA PARA O LAGO',
    furniture: [
      { kind: 'bed', x: 196, y: 210, width: 138, height: 78 },
      { kind: 'shelf', x: 494, y: 173, width: 96, height: 48 },
      { kind: 'table', x: 759, y: 190, width: 96, height: 58 },
    ],
    people: [
      { name: 'Rosa', sprite: 'resident-dress', x: 345, y: 330, dialogue: 'Da minha janela vejo o caminho para o estádio. Dimas passa pelo lago antes de cada jogo; diz que uma volta tranquila ajuda a pensar.' },
      { name: 'Téo', sprite: 'resident-student', x: 705, y: 300, dialogue: 'Vou torcer perto do portão. Se Zeca entrar no seu time, talvez consiga passar pela marcação do Tito!' },
    ],
  },
  {
    key: 'benfica.school.entry', name: 'Escola do Benfica', kind: 'school',
    floorColor: 0xd2ba8d, wallColor: 0x8c7256, accentColor: 0x497663, pattern: 'tile', wallLabel: 'QUADRO DE TÁTICAS',
    furniture: [
      { kind: 'desk', x: 216, y: 190, width: 118, height: 58 },
      { kind: 'desk', x: 470, y: 190, width: 118, height: 58 },
      { kind: 'desk', x: 735, y: 190, width: 118, height: 58 },
    ],
    people: [
      { name: 'Professora Ana', sprite: 'resident', x: 353, y: 308, dialogue: 'Dimas ensinava educação física aqui. Ele dizia: no 1 × 1, marque com atenção. Hoje seus cinco atletas disputam duelos individuais no estádio.' },
      { name: 'Luca', sprite: 'resident-student', x: 681, y: 340, dialogue: 'Desenhei os cinco rivais do estádio no quadro! Ivo dribla e Mara finaliza. Qual atleta você vai escolher para cada duelo?' },
    ],
  },
  {
    key: 'benfica.gym.entry', name: 'Centro de Treinamento do Benfica', kind: 'gym',
    floorColor: 0x8db1a5, wallColor: 0x456a66, accentColor: 0xf0ba69, pattern: 'mat', wallLabel: 'CINCO SETORES DE TREINO',
    furniture: [],
    people: [
      { name: 'Treinadora Jo', role: 'trainer', sprite: 'resident-sport', x: 595, y: 441, dialogue: 'Bem-vindo ao Centro de Treinamento! Vou explicar como cuidar dos seus atletas.' },
    ],
  },
  {
    key: 'benfica.apartment.entry', name: 'Prédio da praça', kind: 'apartment',
    floorColor: 0xb7a4a0, wallColor: 0x5e566f, accentColor: 0xa4bcc1, pattern: 'wood', wallLabel: 'VISTA DO ESTÁDIO',
    furniture: [
      { kind: 'sofa', x: 250, y: 193, width: 148, height: 60 },
      { kind: 'table', x: 535, y: 195, width: 90, height: 56 },
      { kind: 'shelf', x: 797, y: 180, width: 100, height: 68 },
    ],
    people: [
      { name: 'Seu Raul', sprite: 'resident-beard', x: 355, y: 322, dialogue: 'Da varanda vejo Dimas chegar antes da equipe. Ele abre o portão, mede o campo com os olhos e chama Íris e Tito para aquecer.' },
      { name: 'Lila', sprite: 'resident-curly', x: 687, y: 315, dialogue: 'Quando o estádio acende, dá para ouvir a torcida daqui. Quero ver seu atleta enfrentar os cinco rivais, um de cada vez!' },
    ],
  },
]
