# ADR-0009 — +0,25 por sessão de treino

## Status

Aceita. Substitui a regra de cinco sessões da ADR-0006.

## Contexto

O treino deve melhorar o atributo a cada sessão. O ganho solicitado é +0,25 no
fundamento escolhido, com influência imediata nas próximas partidas.

## Decisão

Cada sessão válida aumenta o bônus do fundamento em um quarto de ponto. O atributo
efetivo aceita frações e continua limitado a 99. Quatro sessões somam +1. Treino não
concede XP nem aumenta o nível; partidas continuam sendo a fonte de XP e level up.
O cooldown de um minuto por atleta, ownership, transação e idempotência permanecem.

A V20 guarda os bônus como contadores inteiros de quartos de ponto (0..392),
multiplicando por quatro os bônus inteiros existentes para preservar o valor ganho.
Os recibos aceitam atributos fracionados. Valores em múltiplos de 0,25 são exatos em
Double, usado no domínio e JSON; constraints mantêm os limites no banco.

Contadores parciais legados permanecem legíveis e são zerados no próximo treino do
fundamento, sem recompensa retroativa. Os campos de progresso da API são preservados
para compatibilidade; novas sessões retornam progressAfter = 0. Retry de sessão
antiga recupera seu recibo original, inclusive quando não havia ganho de atributo.

As fórmulas do engine usam atributos fracionados e mantêm os thresholds inteiros de
probabilidade. Para entradas inteiras, o cálculo e o consumo de RNG são os mesmos;
as versões 1, 2 e 3 e os snapshots históricos continuam reproduzíveis. Não há
arredondamento do atributo antes da ponderação dos duelos ou dos pênaltis. O engine
5x5 histórico mantém o truncamento original do goleiro e dos pesos de seleção.

## Consequências

A interface mostra o atributo atual e +0,25 por treino, em vez do contador 1/5.
Consumidores da API devem aceitar atributos numéricos fracionados. Nenhuma sessão,
recompensa de partida ou bônus já conquistado é recalculado retroativamente.
