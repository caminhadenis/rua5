export interface Position {
  x: number
  y: number
}

export type Facing = 'up' | 'down' | 'left' | 'right'

export const INTERACTION_RADIUS = 60
export const CHALLENGER_DETECTION_RADIUS = 88

export function canInteract(player: Position, target: Position): boolean {
  return Math.hypot(player.x - target.x, player.y - target.y) <= INTERACTION_RADIUS
}

/** Challengers notice a player walking nearby, regardless of their facing. */
export function canDetectChallenger(player: Position, target: Position): boolean {
  return Math.hypot(player.x - target.x, player.y - target.y) <= CHALLENGER_DETECTION_RADIUS
}

// Static presentation only. No challenger availability or progress is inferred here.
export const CHALLENGERS = [
  { playerDefinitionId: 'npc_nilo_01', name: 'Nilo', dialogue: 'Sou o Nilo! Se vencer, pode me convidar. Cora espera mais a leste; os rivais ficam mais fortes no caminho até o estádio.' },
  { playerDefinitionId: 'npc_cora_01', name: 'Cora', dialogue: 'Meu forte é o passe. Davi treina a sudeste. O professor Dimas, do estádio, ensina a transformar uma roubada de bola em ataque.' },
  { playerDefinitionId: 'npc_davi_01', name: 'Davi', dialogue: 'Gosto de finalizar! Bia está mais adiante. Lá no estádio, Mara chuta forte no duelo individual.' },
  { playerDefinitionId: 'npc_bia_01', name: 'Bia', dialogue: 'Tenta acompanhar meu drible! Rui está depois da rua larga. Íris e Tito são bons de marcação. Você enfrenta cada um em um duelo no estádio.' },
  { playerDefinitionId: 'npc_rui_01', name: 'Rui', dialogue: 'Defesa também ganha jogo! Sol, Teca e Zeca esperam mais perto do estádio; treine seu atleta antes de encarar os cinco duelos de lá.' },
  { playerDefinitionId: 'npc_sol_01', name: 'Sol', dialogue: 'Lia é muito habilidosa e Ivo dribla bem. No estádio, escolha um atleta para enfrentar cada rival no 1 × 1.' },
  { playerDefinitionId: 'npc_teca_01', name: 'Teca', dialogue: 'O estádio já está perto. Dimas treinava na escola. Você só precisa de um atleta, mas deve vencer os cinco duelos seguidos para levar a taça.' },
  { playerDefinitionId: 'npc_zeca_01', name: 'Zeca', dialogue: 'Chegou quase ao estádio! Minha velocidade pode ajudar contra Íris e Tito. Revanches rendem menos XP; explore a equipe.' },
  { playerDefinitionId: 'npc_iris_01', name: 'Íris', dialogue: 'Esta quadra fica mais tranquila. Se quiser um duelo, estou pronta! O lago também é um ótimo lugar para treinar o olhar.' },
  { playerDefinitionId: 'npc_bento_01', name: 'Bento', dialogue: 'Gosto de jogar perto do lago. A praça mais ao sul vive cheia de gente querendo bater uma bola.' },
  { playerDefinitionId: 'npc_lua_01', name: 'Lua', dialogue: 'A praça é nosso ponto de encontro. Tem gente jogando na quadra leste e também pelas ruas do bairro.' },
  { playerDefinitionId: 'npc_caue_01', name: 'Cauê', dialogue: 'Encontrei este cantinho para treinar longe da correria. Quer jogar um desafio?' },
  { playerDefinitionId: 'npc_nina_01', name: 'Nina', dialogue: 'Gosto de começar o dia jogando por aqui. Já conheceu o pessoal que treina perto do lago?' },
  { playerDefinitionId: 'npc_beto_01', name: 'Beto', dialogue: 'Esta rua é calma, mas sempre aparece alguém para um desafio. Vamos jogar?' },
  { playerDefinitionId: 'npc_joca_01', name: 'Joca', dialogue: 'A quadra leste fica logo ali. Eu prefiro treinar neste caminho antes de encarar a turma de lá.' },
  { playerDefinitionId: 'npc_maiara_01', name: 'Maiara', dialogue: 'Estou treinando para o campeonato do bairro. Quer testar seu time num duelo?' },
].map((content, index) => ({
  ...content,
  facing: (['left', 'up', 'right', 'down'] as const)[index % 4]!,
  kind: 'challenger' as const,
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  spawnKey: `benfica.court.${String(index + 1).padStart(2, '0')}`,
}))

export const CHALLENGER = CHALLENGERS[0]!

/** Opens once per approach; the wider exit radius avoids flicker at the boundary. */
export class ApproachDialogue {
  private greeted = false
  update(player: Position, target: Position): boolean {
    const distance = Math.hypot(player.x - target.x, player.y - target.y)
    if (distance > CHALLENGER_DETECTION_RADIUS + 20) this.greeted = false
    if (!canDetectChallenger(player, target) || this.greeted) return false
    this.greeted = true
    return true
  }
}
