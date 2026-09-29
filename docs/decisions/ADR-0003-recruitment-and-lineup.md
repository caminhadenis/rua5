# ADR-0003 — Recrutamento e escalação

## Status

Accepted — Milestone 5.

## Context

M4 já persiste partidas, recompensas e progresso em uma transação. M5 deve permitir
convidar um desafiante vencido e salvar a equipe, mantendo ownership e retries seguros.
Estádio, 5x5, troféus e expansão de NPCs não fazem parte desta entrega.

## Decision

- `RecruitmentPolicy` é domínio puro: apenas `WIN` contra definição recrutável transforma
  `LOCKED` em `AVAILABLE`. Empate/derrota não desbloqueiam nem revogam um desbloqueio.
  `RECRUITED` permanece recrutado, inclusive em revanches.
- O status é persistido em `challenger_progress` na mesma transação da partida e XP.
  O snapshot de rewards inclui `recruitmentUnlocked`, verdadeiro apenas na transição.
  Snapshots históricos mantêm seus valores; campos novos ausentes usam defaults compatíveis.
- V7 adiciona o status e reconhece vitórias válidas anteriores do M4 (progresso com vitória
  e partida `WIN` com rewards persistidos). Partidas M3 sem recompensas não desbloqueiam.
  Não altera o placar nem reaplica recompensas históricas.
- `GET /api/v1/challenges/{id}` fornece o status atual, nome, nível, recruitable e histórico
  da sessão. A UI consulta esse estado, inclusive ao retornar a resultados históricos.
- `POST /api/v1/challenges/{id}/recruit` tem idempotência natural por `(perfil, desafiante)`:
  não exige uma chave adicional. Retorna `{challengerId, ownedPlayerId}` estável; repetir não
  cria outro jogador nem muda XP. O lock de perfil usado por partidas também serializa convites.
  Retry já concluído retorna a identidade mesmo após mudanças de disponibilidade ou nível.
- Recrutamento exige starter escolhido, NPC/definição ativos, mapa acessível e status AVAILABLE.
  O novo jogador inicia no nível do desafiante, com XP e histórico zerados. Uma definição já
  possuída é reutilizada, protegida também por `UNIQUE(profile_id, player_definition_id)`.
- `GET /roster` adiciona arquétipo, função preferida e stats efetivos calculados pelo backend.
  A tela Equipe usa cartões com nome, sprite, nível e XP; mostra atributos do selecionado.
- `GET/PUT /api/v1/lineup` usa `{ownedPlayerIds: [id|null, id|null, id|null, id|null, id|null]}`.
  São sempre cinco posições ordenadas; `null` representa um slot vazio. Escalações parciais
  são salvas durante a formação do elenco. A exigência de cinco jogadores para disputar
  estádio pertence ao M6. Não há restrição por função ou goleiro explícito.
- PUT substitui todos os slots atomicamente e é naturalmente idempotente. Todos os IDs
  não nulos devem pertencer à sessão e ser distintos. Não recebe identidade do cliente.
  Duas abas são serializadas pelo lock do perfil: vence o último PUT completo, sem misturar slots.
- `user_lineup` guarda somente slots ocupados. PK `(profile_id, slot_index)`, CHECK `1..5`,
  UNIQUE `(profile_id, owned_player_id)` e FK composta para `(profile_id, id)` de owned_player
  garantem intervalo, unicidade e ownership também no banco.
- Equipe abre por botão ou T e pausa o mundo. O jogador seleciona um cartão e um slot;
  mover alguém já escalado esvazia a posição anterior. Remover coloca o jogador na reserva.
  O cliente mantém alterações como rascunho até salvar e usa a resposta autoritativa.
  Após resposta incerta de PUT, bloqueia edição e permite repetir exatamente o mesmo payload.
- Convites estão disponíveis no resultado da partida e na tela Equipe, permitindo recuperar
  o fluxo após reload. Nenhum cálculo de placar, recompensa ou stats é movido ao frontend.

## Consequences

Migrations e constraints são verificadas em PostgreSQL real. Testes cobrem negativos,
concorrência, rollback, migration de M4, definição compartilhada por desafiantes e retries.
O E2E real vence Nilo, recruta após resposta perdida, salva escalação e recarrega o elenco.
A escalação cheia e reservas são cobertas por fixture de UI e testes de API/banco com cinco
jogadores possuídos. O conteúdo de produção ainda contém starter + Nilo; mais NPCs ficam
para M7, sem introduzir concessões artificiais ou estádio para completar o teste.
