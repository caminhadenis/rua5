import type { Starter } from '../../api/gameApi'

export function starterAdvice(starter: Starter): string {
  const styles: Record<string, string> = {
    starter_leo: 'A velocidade e o drible dele ajudam a criar espaço e passar pela marcação. É uma ótima opção para construir as jogadas.',
    starter_breno: 'Ele se destaca na marcação e tem força para disputar a bola. Uma defesa atenta pode virar o começo de um bom ataque.',
    starter_rafa: 'A finalização e a velocidade são os pontos fortes dele. É um jogador para buscar espaço e caprichar no chute a gol.',
  }
  return `Parabéns pela escolha, ${starter.name} já faz parte do seu time! ${styles[starter.id] ?? 'Conheça os atributos dele no elenco e experimente seu estilo nos desafios.'}`
}
