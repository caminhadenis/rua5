import type { DuelResponse } from '../../api/gameApi'

/** The outcome is relative to the player and comes from the server. This only selects dialogue. */
export function afterDuelDialogue(outcome: DuelResponse['match']['outcome']): string {
  switch (outcome) {
    case 'WIN': return 'Mandou bem! Parabéns pela vitória!\nVocê jogou muita bola. Quero uma revanche!'
    case 'LOSS': return 'Dessa vez deu pra mim! Mas você tem jogo.\nContinue treinando e vem tentar de novo!'
    case 'DRAW': return 'Que duelo disputado! Ficou tudo igual.\nNa próxima a gente tira essa diferença!'
  }
}
