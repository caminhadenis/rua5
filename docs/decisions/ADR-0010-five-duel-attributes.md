# ADR-0010 — Cinco atributos para duelos individuais

## Status

Aceito. Substitui os aspectos de atributos e simulação coletiva dos ADRs anteriores.

## Contexto

Todos os jogos novos, inclusive no estádio, são 1x1. O atributo de distribuição de
bola entre companheiros não participa desses duelos e não deve integrar o produto.

## Decisão

- Os únicos atributos são velocidade, drible, finalização, marcação e físico.
- API, progressão, snapshots, ordenação dos rivais e treinos usam esses cinco atributos.
- A academia oferece cinco setores, com finalização na fileira superior e os dois
  setores restantes centralizados na fileira inferior.
- O simulador coletivo v2 foi removido. Seu modo permanece apenas para ler registros
  antigos; a tentativa de simulá-lo é rejeitada.
- V21 elimina as colunas e registros do fundamento aposentado, adapta snapshots
  históricos e de tentativas em andamento, remove seus eventos e renumera a sequência.
  Placares, estatísticas, pênaltis, XP, nível, elenco, troféus e ordem já persistida dos
  oponentes são preservados. Bônus dos cinco atributos continuam intactos.
- Migrations já aplicadas permanecem imutáveis. As fórmulas dos duelos v1/v3 e seus
  resultados por seed não mudam, pois já usavam apenas os cinco atributos restantes.

## Consequências

O contrato de atributos possui cinco campos. Clientes anteriores devem recarregar
após a atualização. Recibos do fundamento aposentado deixam de estar disponíveis.
Resultados coletivos antigos são lidos do banco, sem possibilidade de ressimulação.
