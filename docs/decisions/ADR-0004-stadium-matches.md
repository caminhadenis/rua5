# ADR-0004 — Partidas de estádio e conclusão por troféu

## Status

Accepted — Milestone 6.

## Context

O engine v1, snapshots, lock de perfil e idempotência de duelos já existem. M6 precisa
simular cinco jogadores de cada lado e conceder uma recompensa única, preservando o
histórico de duelos e o esquema de migrations. Não inclui expansão de NPCs do M7.

## Decision

- `VersionedMatchEngine` despacha `DUEL_1V1` v1 e `STADIUM_1V1` v3 (ADR-0010). A extração de
  chance limitada, alternância de lado e estatísticas preserva exatamente a sequência
  aleatória e o resultado dos duelos. Snapshots de participantes usam a mesma progressão.
- O estádio usava 30 posses alternadas e construção coletiva. Esse simulador foi
  removido após a adoção exclusiva de duelos individuais (ADR-0010).
  Os eventos carregam jogadores reais e zonas abstratas de construção/ataque.
- O goleiro não é um sexto participante. Força = base + média de (defesa + físico)/4,
  limitada a 1..99. A base do mandante é 35; a visitante é configurada por estádio e
  guardada no request snapshot. O conteúdo inicial usa nível 6 e base 35. `SAVE` tem
  como ator o finalizador cujo chute foi defendido. Nenhuma física em tempo real.
- Empate regulamentar gera cinco pares de cobranças, seguidos de morte súbita. Após
  25 pares ainda empatados, um confronto probabilístico entre finalizadores resolve
  o último par (um converte, outro perde). Isso limita tempo/eventos e preserva
  determinismo. Toda aleatoriedade usa exclusivamente `java.util.Random(seed)`.
- Placar regulamentar e estatísticas contam somente `GOAL`. Pênaltis são separados
  em `penalties`, eventos `PENALTY_GOAL/PENALTY_MISSED` e metadata de placar das cobranças.
  O outcome do estádio nunca é DRAW. O cliente apresenta os valores do servidor.
- `StadiumPolicy` exige cinco IDs distintos, acesso ao mapa, estádio ativo, requisitos
  de troféus satisfeitos e ausência do troféu desse estádio. Definições precisam estar
  ativas e os cinco IDs devem pertencer ao perfil. Sem posição de goleiro ou formação obrigatória.
- O mapa inicial de perfis legados com `currentMapId = null` é Benfica, tal como no
  frontend existente. Starter é obrigatório; outro mapa é inacessível. Requisitos
  são linhas em `stadium_requirement`; possuir o troféu libera dependentes na próxima leitura.
- XP reutiliza `Progression.reward/advance`, por participante, contra a média de nível
  visitante. Vitória única tem multiplicador inicial; derrotas decaem por tentativas.
  Cada escalado recebe histórico e XP; reservas não recebem. Sem recrutamento no estádio.
- Uma transação com lock do perfil contém match, cinco atualizações de XP/histórico e
  troféu. O lock também serializa lineup, recrutamento e duelos. `user_trophy` é a única
  fonte de conclusão permanente; não há flag duplicada de conclusão.
- V8 preserva source UUID/FK de challenger, adiciona `stadium_id` com FK própria e torna
  o jogador único opcional. CHECK distingue os dois modos e valida placares/pênaltis.
  FK composta do troféu garante mesmo perfil, estádio e resultado WIN; unicidade protege
  tanto troféu quanto conclusão do estádio por perfil.
- Ambos os modos usam `game_match` e UNIQUE `(profile_id, idempotency_key)`. Retry busca
  o snapshot antes de validar lineup/requisitos/conclusão. A chave identifica a seleção
  persistida no primeiro comando, mesmo que o lineup mude depois; o POST não recebe lineup.
  Reutilização em outro estádio ou modo gera conflito. Novas chaves após vitória são rejeitadas.
- `GET /stadiums` e `GET /stadiums/{id}` mostram estado, adversários, requisitos e troféu.
  Entrada no mapa e tela de estádio usam esses dados. A tela compartilha relógio de playback
  e localização de eventos com duelos. Em resposta incerta mantém a chave para recuperar
  a partida, e só permite nova tentativa após resposta definitiva.

## Consequences

Testes de domínio verificam mil seeds, pênaltis, invariantes e participação dos cinco.
Integração PostgreSQL cobre migrations limpas e upgrade, requisitos, ownership, retries,
concorrência, constraints, rollback no commit e recuperação. E2E usa servidor/engine/banco
reais com fixture de elenco isolada; o conteúdo de produção continua starter + Nilo.
A jornada com recrutamento de cinco por exploração permanece no M7.

## Alternatives considered

Tabela separada de partidas exigiria mais infraestrutura para compartilhar idempotência.
Somar pênaltis ao placar confundiria estatísticas e eventos de gols. Goleiro explícito e
física em tempo real aumentariam o escopo e contrariariam a especificação do MVP.
