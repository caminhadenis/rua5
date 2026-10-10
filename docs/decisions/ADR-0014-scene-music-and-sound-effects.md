# ADR-0014 — Música por cena e efeitos de som

## Status

Accepted

## Context

O áudio original do MVP tinha apenas sinais de gol, vitória e confirmação. A jornada
precisa de música no menu, uma trilha solene de conquista na formatura, ambiente na
cidade, alerta quando o desafiante percebe o treinador e música ao aceitar um duelo.

## Decision

Expandir `GameAudio` usando Web Audio, sem nova dependência. Quatro composições
originais de oito compassos, com melodia, baixo, harmonia e percussão, ficam em
`frontend/src/game/audio/score.ts` e repetem em loop:

- `menu`: tema retrô de abertura;
- `graduation`: tema solene em andamento lento, durante toda a cerimônia;
- `city`: ambiente animado a 108 BPM, com timbre triangular mais brilhante e
  melodia mais ritmada, para rua, interiores, equipe e conversa com Dimas;
- `duel`: tema rápido de disputa, iniciado na confirmação do desafio de rua/estádio.

A troca de trilha usa uma transição curta de volume. Solicitar a mesma trilha mantém
o loop atual. Falha ao receber a partida retorna ao ambiente; retry mantém o comando
idempotente existente. No resultado, a disputa para e toca vitória, empate ou derrota
conforme a resposta do servidor. A quinta vitória do estádio usa a fanfarra de troféu.
Voltar ao mundo ou à conversa com Dimas restaura o ambiente.

Efeitos incluem alerta sincronizado com o “!” (uma vez por aproximação), apito inicial,
gol na chegada visual da bola, vitória/derrota/empate, entrega do diploma, troféu e
confirmação de recrutamento. Pular o playback não repete uma sequência inteira de sons.

O navegador exige interação para liberar áudio. O botão inicial `Som: ativar` permite
ouvir o menu antes de iniciar; qualquer clique/toque ou tecla também libera áudio.
A preferência `jogorua.muted` existente é preservada. Silenciar interrompe música e
efeitos já agendados; reativar usa a trilha da cena atual. Ao ocultar a aba, o áudio
para e o contexto é suspenso; ao retornar, somente a música atual é retomada.
A destruição do jogo remove listeners, scheduler e fontes de áudio.

## Consequences

Não há download de gravações, assets de terceiros ou alteração no backend, API,
progressão ou resultados. Navegadores sem Web Audio ou com autoplay/storage bloqueado
continuam permitindo jogar. As músicas têm estética sintetizada retrô; gravações
instrumentais poderão substituir as composições somente com origem/licença definida.
Vitest cobre o ciclo de áudio; Playwright verifica transições, sinal de áudio real,
silêncio persistido e o fluxo do desafio.
