export interface Position {
  x: number
  y: number
}

export type Facing = 'up' | 'down' | 'left' | 'right'

export const INTERACTION_RADIUS = 60

export function canInteract(player: Position, target: Position): boolean {
  return Math.hypot(player.x - target.x, player.y - target.y) <= INTERACTION_RADIUS
}

/** A challenger only notices players in the short cone in front of their facing. */
export function canDetectChallenger(player: Position, target: Position, facing: Facing): boolean {
  const dx = player.x - target.x
  const dy = player.y - target.y
  if (Math.hypot(dx, dy) > INTERACTION_RADIUS) return false
  const forward = facing === 'up' ? -dy : facing === 'down' ? dy : facing === 'left' ? -dx : dx
  const lateral = facing === 'up' || facing === 'down' ? Math.abs(dx) : Math.abs(dy)
  return forward > 0 && forward <= INTERACTION_RADIUS && lateral <= 34
}

// Static presentation only. No challenger availability or progress is inferred here.
export const CHALLENGERS = [
  { playerDefinitionId: 'npc_nilo_01', name: 'Nilo', dialogue: 'Sou o Nilo! Se vencer, pode me convidar. Cora espera mais a leste; os rivais ficam mais fortes no caminho até o estádio.' },
  { playerDefinitionId: 'npc_cora_01', name: 'Cora', dialogue: 'Meu forte é o passe. Davi treina a sudeste. O professor Dimas, do estádio, ensina a transformar uma roubada de bola em ataque.' },
  { playerDefinitionId: 'npc_davi_01', name: 'Davi', dialogue: 'Gosto de finalizar! Bia está mais adiante. Lá no estádio, a finalizadora Mara não costuma desperdiçar o passe da Lia.' },
  { playerDefinitionId: 'npc_bia_01', name: 'Bia', dialogue: 'Tenta acompanhar meu drible! Rui está depois da rua larga. Íris e Tito formam uma defesa difícil de atravessar no estádio.' },
  { playerDefinitionId: 'npc_rui_01', name: 'Rui', dialogue: 'Defesa também ganha jogo! Sol, Teca e Zeca esperam mais perto do estádio; treine e monte seus cinco antes de chegar lá.' },
  { playerDefinitionId: 'npc_sol_01', name: 'Sol', dialogue: 'Lia organiza o time do Dimas. Se você marcar o passe dela, Ivo ainda pode escapar no drible. Experimente escalações diferentes.' },
  { playerDefinitionId: 'npc_teca_01', name: 'Teca', dialogue: 'O estádio já está perto. Dimas treinava na escola e gosta de equipe organizada; sem cinco jogadores, nem adianta entrar.' },
  { playerDefinitionId: 'npc_zeca_01', name: 'Zeca', dialogue: 'Chegou quase ao estádio! Minha velocidade pode ajudar contra Íris e Tito. Revanches rendem menos XP; explore a equipe.' },
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
  update(player: Position, target: Position, facing: Facing): boolean {
    const distance = Math.hypot(player.x - target.x, player.y - target.y)
    if (distance > INTERACTION_RADIUS + 20) this.greeted = false
    if (!canDetectChallenger(player, target, facing) || this.greeted) return false
    this.greeted = true
    return true
  }
}
