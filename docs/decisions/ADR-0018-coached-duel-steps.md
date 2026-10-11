# ADR-0018 — Orientações do treinador em duelos incrementais

## Status

Accepted — solicitação explícita do usuário.

## Context

A partida inteira era simulada antes do playback. O usuário pediu intervenções durante
o duelo: apressar/cadenciar e ofensivo/defensivo, com impacto no risco e no cansaço.
A pausa de orientação não deve consumir tempo virtual. REST e autoridade do backend
continuam sendo requisitos; não há controle de futebol em tempo real.

## Decision

- Engine v4 puro e incremental para duelos de rua e estádio, com cinco trechos de
  quatro minutos virtuais. O início apenas reserva os participantes e snapshots.
  Cada avanço recebe ritmo (`SLOW`, `NORMAL`, `FAST`) e postura (`DEFENSIVE`,
  `BALANCED`, `OFFENSIVE`), além da etapa esperada e uma chave idempotente.
- Uma partida ativa por perfil, persistida em `coached_match` (V30). Retomada consulta
  a etapa atual. Estado, eventos, posse, esforço, seed e histórico de instruções são
  persistidos. Não se sorteiam lances futuros antes da orientação correspondente.
- Partidas novas na interface usam os endpoints `coached-matches`. Os endpoints
  originais `/matches` permanecem para compatibilidade, com engines v1/v3 e custo
  histórico de +18. Eles também respeitam a reserva de partida ativa.
- Ataques duram até 40/60/100 segundos virtuais em ritmo rápido/normal/lento,
  limitados pela fronteira do trecho. Cadenciar pode conservar a posse se vencer
  a disputa; o marcador pode desarmar. Mais ações também abrem respostas adversárias.
- Ataque pondera drible/velocidade/físico em 55/30/15; defesa pondera
  marcação/velocidade/físico em 65/25/10. Postura ofensiva soma 6 ao ataque e subtrai
  6 da defesa; defensiva faz o inverso. Curva sigmoid com escala 18 e limites 10–90%.
- A velocidade e o ritmo influenciam a separação do marcador (`FREE`/`PRESSURED`).
  Conversão depende da finalização e da qualidade da chance, sem reaplicar a
  marcação integral. Chutes pressionados podem ser bloqueados. Não há goleiro explícito.
- Cansaço em partida é contínuo: os limites máximos de redução são 18% velocidade,
  12% drible/marcação, 8% finalização e 10% físico. Esforço acumula por tempo da ação,
  posse e ritmo; físico maior reduz desgaste. Ritmo rápido multiplica esforço por
  1,55; lento por 0,65. O adversário usa ritmo normal e postura equilibrada.
- `GET /roster` acrescenta `coachedMatchStats` para a prévia autoritativa dos
  atributos v4 na Equipe; `matchStats` legado é preservado. Cartões mostram
  condição e cansaço, sem anunciar redução uniforme nos cinco atributos.
- Esforço total arredondado para cima é aplicado uma única vez ao atleta próprio
  na conclusão (`fatigue.policyVersion = "2"`), somado ao cansaço inicial congelado.
  Pensar nas pausas e fechar a página não recuperam o atleta dentro dessa partida.
  Recuperação natural e condições do elenco continuam com a política existente
  fora do duelo. Treino, tratamento, dispensa e recrutamento são bloqueados durante
  uma partida ativa, com retries confirmados anteriores preservados.
- XP, histórico, recrutamento, resultado final, esforço e avanço/troféu de estádio
  são confirmados na mesma transação do último avanço e do seu recibo durável.
  Partidas de estádio reservam a rodada no início, sem avançá-la até a conclusão.
- Mesma seed, snapshots, fadiga inicial, versão e sequência de instruções produzem
  os mesmos eventos. Um RNG por ação, derivado da seed e índice, permite retomada
  sem serializar `java.util.Random`. Resultado histórico inclui as cinco instruções
  em `request_snapshot`; versões anteriores não são recalculadas.
- Pausa automática vem habilitada e pode ser desligada. Mudanças durante o playback
  valem para o trecho seguinte e são indicadas como pendentes. A resposta de avanço
  contém apenas os eventos já resolvidos. `Pular` conclui os trechos restantes via
  comandos normais com a orientação escolhida. Acelerador só altera a apresentação.

## Consequences

Há mais requisições por partida (uma por trecho, nunca por evento). Cada avanço
é serializado pelo lock de perfil, valida ownership e etapa e tem recibo idempotente.
Resposta perdida mantém corpo/chave para retry; outra aba avançando exige atualização.
Não há temporizador de decisão, scheduler, WebSocket ou infraestrutura adicional.
Fechar um duelo incompleto deixa a partida reservada para CONTINUAR; não há abandono
que permita tentar outra seed sem concluir. Preferência de pausa é apenas local.

Os números são parâmetros de balanceamento, com testes de simetria, superioridade,
surpresas, ritmo, postura e desgaste. A nova versão exige reavaliar o balanceamento
do conteúdo sem reescrever resultados existentes.

## Alternatives considered

Simular tudo e alterar apenas a animação não faria os comandos influenciar o resultado.
Simulação contínua via WebSocket ou controle por evento acrescentaria infraestrutura
e custos de rede desnecessários ao fluxo de pausas aceito pelo usuário.
