# ADR-0001 — Engine de duelo e persistência idempotente

## Status

Accepted — Milestone 3.

## Context

O duelo precisa ser reproduzível independentemente de Spring, HTTP e banco. Duas abas ou
retries concorrentes não podem criar partidas duplicadas. Conteúdo pode mudar depois da partida.

## Decision

- `match/domain` contém somente Kotlin/JDK: contratos, validação dos participantes e
  `DuelMatchEngine`. O Spring apenas instancia o engine e coordena a transação.
- A versão `1` usa o algoritmo especificado de `java.util.Random`, inicializado apenas pela
  seed recebida, e probabilidades inteiras limitadas a 10%–90%. Cada chamada tem RNG próprio.
  Alterar regras, consumo de aleatoriedade ou eventos exige avaliar incremento de versão.
- Um duelo tem 20 posses alternadas, dez por lado. A seed determina quem começa. Cada posse
  avança um minuto virtual e resolve drible/desarme e, se houver drible, chute/gol ou erro.
  Não existe goleiro explícito. Empate permanece empate. O placar e as estatísticas são
  derivados dos eventos. A fixture da seed 42 protege o comportamento histórico da versão 1.
- Neste milestone os starters e o único NPC estão no nível 1. O snapshot usa seus stats base
  autoritativos; crescimento de stats, XP, contadores de vitórias e recompensas entram no M4.
- O application service gera a seed e persiste a entrada completa (IDs, nomes, níveis e
  stats), os eventos, o resultado, a versão e a seed. Replay de uma chave lê o snapshot salvo,
  sem simular novamente ou consultar a disponibilidade atual do NPC.
- A transação adquire o lock da linha de perfil já usado pela seleção de starter. Isso
  serializa comandos do mesmo perfil, inclusive em instâncias distintas da aplicação.
  `UNIQUE(profile_id, idempotency_key)` também protege a persistência.
- A chave vale por perfil. Reutilizá-la com outro desafiante ou `ownedPlayerId` retorna
  `409 IDEMPOTENCY_CONFLICT`. Uma chave nova cria uma revanche independente.
- Os novos repositories usam `JdbcTemplate` já disponível na stack, na mesma transação
  JPA/DataSource. JSONB preserva snapshots/eventos sem entidades acopladas ao engine.
- Nilo usa o spawn existente `benfica.court.01`; o banco não armazena geometria. Um perfil
  ainda sem checkpoint (estado do M1) pode desafiá-lo; um checkpoint de outro mapa é rejeitado.

## Consequences

O engine pode ser testado sem application context. Testes com HTTP real e PostgreSQL
verificam concorrência, ownership, rollback no commit, snapshots e constraints. Não há
novas dependências. O lock por perfil é suficiente para partidas síncronas curtas deste MVP.

O endpoint do M3 retorna apenas `match`, sem recompensas. A UI do mundo continua no M2;
playback e XP são escopo do M4, recrutamento do M5 e 5x5 do M6.

## Alternatives considered

- Reservar chaves em tabela separada: exige estados extras sem benefício para o comando
  síncrono atual; a partida e a constraint já são a reserva durável.
- Recalcular o resultado no retry: arrisca mudanças de conteúdo/versão e reexecução de efeitos.
- Estado aleatório global no engine: quebra determinismo e isolamento entre partidas.
