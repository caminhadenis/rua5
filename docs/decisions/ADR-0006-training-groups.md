# ADR-0006: Cinco treinos por ponto de atributo

## Status

Substituída por [ADR-0009](ADR-0009-quarter-point-training.md).

## Decisão

Cada atleta possui um contador independente de zero a quatro para cada fundamento.
Uma sessão concluída avança apenas esse contador. A quinta sessão reinicia o contador
e concede +1 ao bônus efetivo daquele fundamento; as quatro primeiras não alteram
atributo, nível, XP ou desempenho em partidas. O limite efetivo de 99 continua valendo.

V14 cria `owned_player_training_progress` para os contadores e registra o progresso
anterior e posterior em cada nova `training_session`, preservando as sessões históricas.
O bloqueio transacional do perfil e a chave de idempotência continuam protegendo o
contador e o bônus contra comandos concorrentes e repetidos. O intervalo global de um
minuto entre sessões permanece.

O cliente mostra o progresso e quantos treinos faltam. A treinadora Jo explica a regra
automaticamente ao entrar na academia.

## Motivo

O progresso parcial precisa ser visível sem antecipar o ganho de atributo em partidas.
Persistir contadores por atleta e fundamento mantém a regra no backend e permite
retomar os treinos após recarregar a página.
