# ADR-0019 — Ganho de treino conforme o cansaço

## Status

Aceita por solicitação explícita do usuário. Substitui o ganho fixo da ADR-0009.

## Contexto

O treino deve render menos conforme o atleta fica cansado. O usuário aprovou
+0,25 descansado, +0,20 cansado, +0,15 muito cansado e +0,05 exausto.

## Decisão

O backend calcula o ganho pela condição antes do comando, após a recuperação
natural até o horário da sessão e antes do custo de +12. Os limites existentes
30/60/85 definem as condições. O ganho é limitado ao que falta para o atributo
permanente chegar a 99. Exaustão não impede o treino; XP e nível não mudam.

A V31 converte os contadores inteiros de quartos de ponto para centésimos,
multiplicando por 25, com intervalo 0..9800. Recibos usam NUMERIC(4,2) no banco;
o domínio projeta os atributos permanentes em centésimos para evitar resíduos de
aritmética binária. A API mantém seus campos numéricos e os recibos existentes.
Idempotência e transações preservam os ganhos, desgaste e respostas históricas.
Nenhum atributo, partida ou recompensa anterior é recalculado.

Jo explica os ganhos apenas na introdução do centro, com uma informação por fala.
A seleção e conclusão do treino não exibem ganhos ou comparações de atributos.
O mural e a recepção de Amélia também apresentam um assunto por fala.

## Consequências

Descanso e recuperação melhoram o rendimento dos próximos treinos. Saves antigos
preservam todos os bônus e resultados. O frontend não calcula nem prevê ganhos.
