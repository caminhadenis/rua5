# ADR-0008 — Estádios com cinco duelos consecutivos 1x1

## Status

Accepted. Substitui as regras de gameplay 5x5 do ADR-0004; preserva resultados históricos.

## Context

O produto passa a ter somente jogos individuais. Cada treinador possui cinco atletas;
o jogador precisa vencer todos consecutivamente para conquistar o estádio. Uma derrota
encerra a tentativa e exige reiniciar pelo primeiro rival.

## Decision

- Rua usa `DUEL_1V1` v1; novos jogos de estádio usam `STADIUM_1V1` v3, com um atleta por lado.
- O estádio não exige lineup ou cinco recrutados. O usuário escolhe um atleta próprio a
  cada duelo e pode repetir ou trocar esse atleta entre jogos.
- A força dos adversários é ordenada por nível, depois soma dos cinco atributos efetivos;
  ID estável desempata. O mais forte enfrenta o visitante por último.
- Cada tentativa salva os cinco snapshots ordenados. Mudanças de conteúdo não mudam uma
  sequência em andamento. Os comandos não aceitam adversário, seed, atributos ou placar.
- O POST exige `{ownedPlayerId, seriesId, roundNumber}` e `Idempotency-Key`; `seriesId`
  é o ID da última tentativa retornada no GET, ou `null` antes da primeira. Após derrota,
  a próxima rodada é 1 e o servidor cria uma tentativa nova. Comandos de uma tela antiga
  retornam `STADIUM_SEQUENCE_CHANGED`, evitando pular rivais entre abas.
- Uma vitória avança, uma derrota encerra; só cinco vitórias na mesma tentativa concedem
  o troféu. XP/histórico do atleta escolhido, partida, avanço e troféu são transacionais.
  XP usa retorno decrescente com o número de duelos anteriores naquele estádio.
- Empate regulamentar resolve-se por pênaltis determinísticos, sem somá-los ao placar
  de gols. Após cinco cobranças pareadas, há morte súbita; a rodada 26 força uma decisão
  pareada probabilística para assegurar término. Rua mantém os empates existentes.
- V19 adiciona tentativas e referências de rodada sem editar migrations aplicadas.
  Constraints validam contadores, rodada única, resultado e troféu ligado a tentativa
  com cinco vitórias. Partidas e troféus legados continuam disponíveis.
- O portão abre um interior explorável. Só conversar com o treinador e confirmar abre
  a seleção do duelo. Torcedores da casa têm conversas sem comandos ou recompensas.
- O playback reutiliza a apresentação e coreografia do duelo individual, com torcida
  animada e maior em arquibancadas nos quatro lados, fisicamente separadas da quadra.
  Torcedores, bandeiras e faixas vermelho/creme nunca sobrepõem a área de jogo.
- Dimas aparece só nas interações, sem avatar na tela do duelo. O fim do playback
  troca para uma conversa com seu retrato, comentário do resultado e anúncio do próximo
  atleta do backend. Depois da confirmação, o usuário escolhe seu próprio atleta antes
  do corte para o próximo duelo. Essa troca de telas não cria partidas ou recompensas.

## Consequences

Recarregar ou sair e voltar retoma a tentativa ativa. Retry da chave original retorna o
mesmo snapshot, inclusive depois de perder ou conquistar o troféu. Nova chave após o
troféu é rejeitada. O editor de lineup permanece opcional e não controla partidas.
O engine 5x5 permanece apenas para compatibilidade/reprodução de histórico, sem endpoint
que crie novos jogos desse modo.

## Alternatives considered

Simular a sequência inteira em um POST impediria trocar o atleta entre duelos. Contar
vitórias acumuladas entre tentativas contrariaria a exigência de reiniciar após derrota.
