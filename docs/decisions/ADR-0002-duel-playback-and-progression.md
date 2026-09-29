# ADR-0002 — Playback e progressão do duelo

## Status

Accepted — Milestone 4.

## Context

O M3 já salva o resultado completo e serializa comandos por perfil. O M4 conecta o NPC
à API, apresenta a partida e aplica XP uma única vez. Recrutamento e lineup continuam no M5.

## Decision

- O mesmo application service/transação salva `game_match`, seu snapshot `rewards`, o
  OwnedPlayer e `challenger_progress`. O lock por perfil protege também duas abas com
  chaves diferentes. Retry retorna o snapshot original, mesmo após outras partidas.
- V5 adiciona `challenger_progress` (tentativas, vitórias, empates, derrotas e último jogo
  em UTC) com PK perfil/desafiante e constraints de contagem. Status de recrutamento,
  desbloqueio e comando de recrutamento ficam para M5.
- Partidas do M3 mantêm `rewards = null`; não recebem XP nem progresso retroativo no retry.
- `Progression` é domínio puro. XP é o saldo dentro do nível, com custo
  `round(100 * level^1.35)`. Ao atingir nível 15, descarta excedente e mantém saldo zero;
  novas partidas no cap concedem zero XP, mas continuam registrando o resultado.
- Balanceamento inicial, reversível e centralizado: vitória 100 XP, empate 25, derrota 10.
  Vitórias usam o número de vitórias anteriores contra aquele NPC, por perfil, nos fatores
  100%, 65%, 35%, 15%, 5% (5% daí em diante). Empates/derrotas usam o mesmo fator indexado
  por tentativas anteriores, evitando farm sem vitória.
- O fator de nível, percentual inteiro, é `floor(100 * max(0, 6 - max(0, playerLevel -
  opponentLevel)) / 6)`. Inimigos de nível igual/maior não penalizam; seis níveis de vantagem
  zeram o XP. O resultado inteiro é truncado após combinar os dois percentuais. O nível
  utilizado é o anterior à partida. Esses números não são contrato de API.
- Stats efetivos usam crescimento uniforme `level - 1` (um ponto por nível desde o nível 2), limitado a 99,
  sem alterar stats base. Modificadores por arquétipo são opcionais e ficam para balanceamento.
  O engine permanece na versão 1: recebe snapshots efetivos como entrada, sem mudança em seu algoritmo.
- `GET /api/v1/roster` retorna somente o elenco da sessão, com nome, nível, XP, custo para
  próximo nível e contadores. A tela inicial conecta perfil/starters existentes ao mundo.
- O NPC único usa seu ID de conteúdo fixo, associado ao `spawnKey` existente; o backend
  continua validando existência, disponibilidade e ownership. Não há geometria no banco.
- `MatchScene` usa uma cadência base de 30 segundos a 1× ou 7,5 segundos a 4×, com pausas extras em gols e um lance
  por vez em uma única linha e opção de pular. O duelo mostra sprites frente a frente e
  placar atual em destaque. Apenas mostra placares/outcome/rewards recebidos; não soma
  gols nem aplica fórmula de XP no cliente. Voltar ao mundo recarrega o roster do servidor.
- Gols exibem braços levantados e sorriso por 1,8 s a 1×, com mínimo de 0,9 s em 4×.
  O último gol também aguarda sua comemoração antes do resultado; pular continua imediato.
  Ao fim, o outcome do backend seleciona vencedor feliz e perdedor cabisbaixo; empate deixa
  ambos neutros. Sprites SVG originais ampliam os placeholders existentes.
- V6 reduz os stats de Nilo para speed 40, dribbling 40, passing 40, finishing 35,
  defending 45 e physical 40. A meta é aproximadamente 70%–80% de vitórias para starters
  no nível 1; Aderlou chega perto de 82% por sua defesa. O teste usa os seeds migrados e
  20 mil partidas por starter/nível (1 e 2), mantendo empates e derrotas possíveis.
  Starters continuam no nível 1; a alteração de crescimento beneficia todos os níveis
  existentes em partidas novas, sem modificar XP, níveis ou snapshots históricos.
- A apresentação da API adiciona `homeScore` e `awayScore` a cada evento, calculados no
  backend a partir da timeline persistida. Isso também funciona para partidas históricas;
  não altera eventos armazenados, simulação, seed, versão do engine ou recompensas.
- A fala de Nilo abre automaticamente ao entrar no alcance de interação (60 px). Fechá-la
  não a reabre imediatamente: uma nova aproximação exige antes sair além de 80 px, evitando
  oscilação na borda. E/Enter continuam permitindo conversa manual; desafio exige confirmação.
- A UI conserva chave e jogador durante falha de resposta e permite repetir o mesmo POST.
  Pular/acelerar não envia comandos ao servidor. O progresso já foi confirmado antes do playback.
  Recarregar a página recupera o elenco pela sessão, sem reaplicar recompensa.
- O elenco é apresentado em cartões com sprite, nome, nível e XP do servidor, usando radios
  nativos para seleção por clique e teclado. A seleção fica bloqueada enquanto um comando
  aguarda resposta ou retry. Ao retornar ao bairro, o outcome autoritativo escolhe a fala de
  Nilo (parabéns, incentivo ou empate), com opção de revanche; não há nova recompensa.
- Painéis HTML acessíveis são controlados pelo ciclo de vida das scenes Phaser, sem novo
  framework. A geometria e o movimento do mundo permanecem no Phaser.

## Consequences

O fluxo completo cabe no REST síncrono existente. Rollback inclui todas as alterações e
retries não dependem do estado atual do jogador. Há cobertura de domínio, integração com
PostgreSQL limpo e navegador real, incluindo resposta perdida, pular e conclusão temporal.
A identidade ainda é a sessão local do M1; a autenticação pública permanece fora deste milestone.

## Alternatives considered

- Confirmar recompensa após playback: exigiria outro comando e um estado intermediário desnecessário.
- Somar gols ou calcular XP no cliente: quebra a autoridade do backend.
- Atualizar migrations antigas ou recompensar partidas legadas: altera história já persistida.
