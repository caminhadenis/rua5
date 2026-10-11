# Rua 5

RPG single-player de futebol descrito em [`docs/GAME_SPEC.md`](docs/GAME_SPEC.md).
O repositório contém o **Milestone 7**: o primeiro bairro pode ser concluído do perfil
novo ao troféu, com desafiantes recrutáveis e cinco duelos individuais consecutivos no estádio.
Há somente um bairro (Benfica), com áudio mínimo, orientação de progresso e recuperação de erros.

## Stack

- Frontend: TypeScript 6, Vite 8, Phaser 4 e Vitest.
- Backend: Kotlin 2.3, Spring Boot 4.1, Gradle 9.7 e JDK 21.
- Banco: PostgreSQL 18.6 e Flyway.
- Infraestrutura local: Docker Compose.

As versões npm estão fixadas em `frontend/package-lock.json`. As dependências JVM ficam
fixadas em `backend/gradle.lockfile`, e a distribuição Gradle está fixada no Wrapper.

## Publicar gratuitamente no Render + Neon

O projeto inclui `render.yaml` e `Dockerfile.render` para publicar frontend e API
juntos em um único **Web Service Free**. O PostgreSQL já criado no Neon é configurado
no painel por `DB_URL`, `DB_USER` e `DB_PASSWORD`; nenhum segredo vai para o GitHub.
O ambiente `production` exige conta por e-mail/senha, usa CSRF e sessões persistidas
no PostgreSQL. Novo login recupera a jornada atual em outro aparelho.

Siga o [passo a passo de publicação](docs/DEPLOY_RENDER.md). O exemplo de variáveis
está em `.env.production.example`. Validação local da imagem de nuvem, com banco
separado e limite de 512 MB:

```bash
docker compose -p rua5-deploy-validation -f compose.deploy-test.yaml up -d --build --wait
cd frontend
npm run test:deploy
```

Abra `http://localhost:5176`. O Compose de desenvolvimento descrito abaixo conserva
o fluxo local sem login. Limites dos serviços gratuitos e retomada após reinício
estão documentados no guia.

## Rodar tudo com Docker Compose

Com Docker e o plugin Compose instalados, execute na raiz:

```bash
docker compose up -d --build --wait
```

Abra **http://localhost:5173**. O Compose compila frontend/backend, aguarda o PostgreSQL
ficar saudável, aplica as migrations e sobe o jogo. Não é necessário instalar Java,
Node ou Gradle no host para jogar dessa forma. O primeiro build baixa as dependências.

- Frontend: `http://localhost:5173` (build estático servido pelo Nginx).
- Backend/healthcheck: `http://localhost:8080/health`.
- PostgreSQL: `localhost:55432`.

O frontend encaminha `/api` ao serviço `backend`, preservando a sessão no mesmo domínio.
O backend acessa `postgres:5432` pela rede interna. O volume `postgres-data` existente
é preservado. Por padrão, as portas publicadas são locais (`127.0.0.1`);
`FRONTEND_HOST` permite liberar o frontend para a rede Wi-Fi.

```bash
docker compose ps
docker compose logs -f backend frontend
# Parar sem apagar o banco:
docker compose down
# Recompilar após alterações no código:
docker compose up -d --build --wait
```

Smoke do cliente compilado, proxy e sessão (com o Compose ativo e dependências de teste
instaladas em `frontend`):

```bash
cd frontend
npm run test:compose
```

Esse teste cria um perfil, escolhe starter, caminha até Nilo, disputa um duelo real e
confere XP e reload pela mesma origem. `COMPOSE_BASE_URL` permite testar outra porta.

As imagens contêm o código compilado; não há hot reload no Compose. Para desenvolvimento
com recarga do frontend, use a execução manual abaixo.

## Execução manual para desenvolvimento

Requer JDK 21+, Node.js 22.12+, npm e Docker. Não é necessário instalar Gradle globalmente.
Se o Compose completo estiver ativo, pare os aplicativos antes de usar as mesmas portas:

```bash
docker compose stop frontend backend
docker compose up -d postgres
```

Backend, em um terminal:

```bash
cd backend
DB_URL=jdbc:postgresql://localhost:55432/jogorua ./gradlew bootRun
```

Frontend, em outro terminal:

```bash
cd frontend
npm ci
npm run dev
```

Abra `http://localhost:5173`. O healthcheck do backend responde em `http://localhost:8080/health`.

## Jogar no celular

Os controles aparecem automaticamente apenas em celulares. Gire o aparelho para a
horizontal: segure ou arraste o dedo no direcional à esquerda para andar, inclusive
na diagonal. À direita, use a ação indicada (conversar, entrar, desafiar ou treinar),
Fechar/Sair e Equipe. Menus, seleção de atletas e partidas são operados por toque.
Tela cheia é opcional nos navegadores que a oferecem. No PC continuam os controles
por teclado e o layout habitual, mesmo com a janela estreita.

Para acessar o jogo do Compose em um celular na mesma rede Wi-Fi, adicione
`FRONTEND_HOST=0.0.0.0` ao arquivo `.env` na raiz e aplique a configuração:

```bash
docker compose up -d --no-deps --wait frontend
```

No celular, abra `http://<IP-local-do-computador>:5173`. O Nginx encaminha a API
ao backend pela rede interna do Docker. Backend e PostgreSQL continuam com suas
portas limitadas ao computador. Para voltar ao acesso somente local, remova a
variável do `.env` e execute o mesmo comando.

Para testar com recarga automática durante o desenvolvimento, mantenha o backend
local ativo e rode o frontend com acesso pela rede:

```bash
cd frontend
npm run dev -- --host 0.0.0.0
```

No celular, abra `http://<IP-local-do-computador>:5173` (ou a porta informada pelo
Vite). O proxy do Vite encaminha a API ao backend local.
Se a porta 5173 já estiver ocupada pelo Compose, especifique `--port 5175`.

Validação dos controles contra o backend ativo:

```bash
cd frontend
E2E_REUSE_BACKEND=1 npm run test:e2e -- mobile.spec.ts --workers=1
```

## API do Milestone 1

No desenvolvimento local sem login, o backend associa o perfil a uma sessão HTTP criada
pelo próprio servidor e persistida no PostgreSQL. Em produção, deriva o perfil da conta
autenticada. O cliente não envia nem escolhe um `profileId`. Exemplo local com `curl`:

```bash
curl -c /tmp/jogorua-cookie -H 'Content-Type: application/json' \
  -d '{"displayName":"Denis"}' http://localhost:8080/api/v1/profiles
curl -b /tmp/jogorua-cookie http://localhost:8080/api/v1/profile
curl http://localhost:8080/api/v1/starters
curl -b /tmp/jogorua-cookie -H 'Content-Type: application/json' \
  -d '{"playerDefinitionId":"starter_leo"}' \
  http://localhost:8080/api/v1/profile/starter
```

Repetir a última requisição com o mesmo starter retorna o mesmo `OwnedPlayer`; tentar trocar
para outro starter retorna `STARTER_ALREADY_SELECTED`.

## Duelo pela API (Milestones 3–4)

Depois de criar o perfil e escolher um starter, copie o `id` retornado pela seleção para
`ownedPlayerId`. Nilo é o primeiro desafiante, com ID `00000000-0000-4000-8000-000000000001`
e spawn `benfica.court.01`:

```bash
curl --fail-with-body -b /tmp/jogorua-cookie \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: 7e5745bd-e39a-41e7-943b-17773ef61933' \
  -d '{"ownedPlayerId":"<id retornado pela seleção do starter>"}' \
  http://localhost:8080/api/v1/challenges/00000000-0000-4000-8000-000000000001/matches
```

A resposta `200` contém `match`: `id`, `mode`, `sourceId`, snapshots `home`/`away`,
`homeScore`, `awayScore`, `outcome` (`WIN`, `DRAW`, `LOSS`, relativo ao jogador), `events`,
`statistics`, `seed`, `engineVersion` e `createdAt`. A versão inicial é `"1"`.
Cada evento informa `sequence` (começando em 1), `minute`, `type`, `side`, `actorPlayerId`,
`targetPlayerId`, `metadata`, `homeScore` e `awayScore` (placar após esse lance, derivado
no servidor da timeline persistida). IDs de atores correspondem aos snapshots: OwnedPlayer no
lado `HOME`, Challenger no lado `AWAY`. Os tipos são `POSSESSION`, `DRIBBLE_SUCCESS`,
`TACKLE`, `SHOT`, `SHOT_MISSED` e `GOAL`. O duelo permite empate.

A resposta também contém `rewards`: `ownedPlayerId`, `xpAwarded`, `previousLevel`,
`currentLevel`, `previousXp`, `currentXp`, `xpToNextLevel` (null no cap) e
`challengerProgress` (`attempts`, `wins`, `draws`, `losses`). Tudo é calculado e salvo pelo
backend na mesma transação da partida. Partidas históricas do M3 retornam `rewards: null`.
`GET /api/v1/roster` retorna o elenco atualizado da sessão, incluindo nome, nível, XP e contadores.

O XP base é 100/25/10 para vitória/empate/derrota. Vitórias sucessivas contra Nilo usam
100%/65%/35%/15%/5%; empates e derrotas também decrescem por tentativa. Vantagem de nível
reduz o ganho até zero com seis níveis de diferença. O cap é nível 15. Cada nível acrescenta +1 aos atributos, já a partir do nível 2. As regras e decisões
estão no [ADR-0002](docs/decisions/ADR-0002-duel-playback-and-progression.md).

- Repita o mesmo comando/chave para recuperar exatamente a partida persistida.
- Use outro UUID em `Idempotency-Key` para uma nova partida.
- Reutilizar a chave com outro jogador/desafiante retorna `409 IDEMPOTENCY_CONFLICT`.
- Chave ausente/inválida ou corpo inválido: `400 MALFORMED_REQUEST`.
- Jogador de outro perfil: `403 PLAYER_NOT_OWNED`.
- Perfil/jogador inexistente ou desafiante indisponível: `404` com código específico.

O cliente envia somente o jogador escolhido; seed, stats, versão e placar são determinados
pelo servidor. A entrada completa fica armazenada em `game_match.request_snapshot`, junto
do resultado, para reprodução independente de alterações posteriores no conteúdo.
A política de simulação e concorrência está em
[`ADR-0001`](docs/decisions/ADR-0001-duel-engine-and-idempotency.md).

Em outro terminal, instale exatamente as versões do lockfile e inicie o frontend:

```bash
cd frontend
npm ci
npm run dev
```

Abra `http://localhost:5173`.

## Jogar o fluxo dos Milestones 4 e 5

Backend e banco precisam estar ativos. O Vite encaminha `/api` ao backend em `localhost:8080`.
O menu pixelado **Rua 5** oferece **INICIAR**, **CONTINUAR** e **OPÇÕES**.
INICIAR abre a formatura na universidade: o reitor entrega o canudo, pede seu nome
e explica os desafios, recrutamento, cansaço e estádio. Após as falas, caminhe até
a saída. Miguel se aproxima na rua, pergunta as cores do time e oferece os três
starters existentes. O personagem controlado é sempre o mesmo treinador pardo,
de cabelo preto e uniforme de educação física; os atletas entram apenas nas partidas.

CONTINUAR fica disponível quando há um perfil na sessão e retoma o progresso do
PostgreSQL e a posição local na rua ou interior. INICIAR cria outra jornada, sem
apagar registros anteriores. OPÇÕES permanece desabilitado. Sessões persistem entre
reinícios do backend. Em produção, a conta por e-mail/senha permite retomar a jornada
atual em outro dispositivo; no modo local, depende do cookie.

- **Setas / WASD:** caminhar; vá à direita até Nilo na quadra.
- Ao entrar na área à frente de um desafiante, o personagem para, o NPC caminha até ele e a fala abre após a aproximação, uma vez por entrada na área.
- **E / Enter:** reabrir o diálogo quando estiver próximo e à frente do desafiante.
- **Enter / DESAFIAR:** escolher um cartão com boneco, nome, nível e XP do elenco e iniciar o duelo.
  Os cartões permitem seleção por clique ou teclado (Tab e setas).
- **E / Esc:** fechar o diálogo.
- Na MatchScene, veja os jogadores frente a frente, o placar atual em destaque e um lance
  por vez em uma única linha. Alterne **Acelerar** entre 1× e 4× ou clique **Pular**.
- O resultado mostra placar, XP, eventual level up e histórico contra Nilo.
- **Voltar ao bairro** consulta o elenco atualizado e abre a conversa com Nilo: parabéns na
  vitória, incentivo na derrota ou reação ao empate. **REVANCHE / Enter** abre a seleção novamente.
- Ao vencer Nilo, **Convidar para o time** fica disponível no resultado e na tela Equipe.
  O convite cria somente um jogador, mesmo após retries, revanches ou cliques simultâneos.
- **Equipe / T:** abrir o elenco e selecionar um cartão para consultar seus atributos,
  além dos convites, dispensa e conquistas. Disponível também nos interiores.
  O elenco tem no máximo **5 jogadores**; para contratar outro com o time cheio,
  selecione um atleta e confirme **Dispensar**. Ele vira desafiante no ponto atual
  do bairro (na entrada externa, se estiver dentro de um prédio), inclusive após reload.
  Nível, XP e treinos são preservados; é possível convidá-lo novamente quando houver vaga.
  Não há slots de posição ou escalação para salvar.
- Reúna pelo menos cinco atletas para desafiar Dimas. Com menos jogadores, ele
  recusa na conversa e a API rejeita sem criar partida. Escolha um atleta por duelo 1x1; pode repetir ou trocar.

### API de recrutamento e elenco

- `GET /api/v1/challenges/{id}`: status `LOCKED`, `AVAILABLE` ou `RECRUITED` e histórico da sessão.
- `POST /api/v1/challenges/{id}/recruit`: sem body obrigatório; idempotente por perfil/desafiante,
  sem necessidade de `Idempotency-Key`. Retorna `{challengerId, ownedPlayerId}` estável.
- `GET /api/v1/roster`: elenco ativo da sessão, com nível, XP, arquétipo, função e stats efetivos.
- `POST /api/v1/roster/{id}/dismiss`: `Idempotency-Key: UUID` e corpo
  `{ "mapId": "benfica", "x": 704, "y": 640 }`. Libera a vaga e preserva o atleta.
- `GET /api/v1/maps/benfica/released-players`: desafiantes dispensados da sessão e sua posição.
- Com cinco ativos, contratação nova retorna `409 ROSTER_FULL`; um retry já confirmado
  continua válido. `GET /challenges/{id}` inclui `rosterFull` para apresentar o bloqueio.
- `GET /api/v1/lineup` e `PUT /api/v1/lineup`: `{ "ownedPlayerIds": ["<id>", null, null, null, null] }`.
  Contrato legado mantido por compatibilidade, sem uso pela tela Equipe ou pelos duelos.
  O array deve ter cinco posições, sem IDs repetidos e somente com jogadores da sessão.
  PUT substitui a escalação inteira em uma transação e pode ser repetido com segurança.

V7 reconhece vitórias do M4 com recompensa persistida e libera seus convites. Nilo entra
no elenco no nível do desafiante, com XP e histórico zerados. Recrutar não concede XP adicional.
Detalhes e decisões em [ADR-0003](docs/decisions/ADR-0003-recruitment-and-lineup.md).

Nilo foi ajustado como adversário introdutório: as chances de vitória no nível 1 ficam
aproximadamente entre 71% e 82%, conforme o starter. Essa alteração vale para novos duelos;
resultados, XP e recompensas já salvos permanecem iguais.

O playback usa uma base de aproximadamente 30 segundos, acrescida das comemorações de gol.
Em um gol, a bola entra na rede antes de aparecer a mensagem e o placar do lance.
O autor do gol levanta os braços, com mensagem por 1,8 s (mínimo de 0,9 s em 4×).
No final, o vencedor fica feliz e o perdedor cabisbaixo; em empate ficam neutros. Acelerar/pular só alteram a apresentação:
placar e recompensas já foram persistidos pelo servidor. Em falha de resposta, **Tentar
novamente** mantém a mesma chave de idempotência. Recarregar mantém XP/nível enquanto a
sessão continuar válida; CONTINUAR retoma o último checkpoint local na rua ou interior.

O personagem colide com construções, cercas vivas e o NPC. A câmera acompanha o movimento
e respeita os limites do bairro. O diálogo e a seleção pausam o movimento.

Entre no **Centro de Treinamento do Benfica** pela porta do prédio marcado no mapa.
Lá dentro há cinco setores com atletas treinando. Aproxime-se do treinador do setor
desejado, pressione **E** para conversar e **Enter** para escolher um atleta. Clique em
**Começar treino**. A atividade do atleta escolhido dura 5 segundos. Cada treino
concede +0,25 no fundamento escolhido, até 99; quatro sessões somam +1. A melhora
fracionada aparece na tela e já vale nas próximas partidas. A treinadora Jo explica
a regra ao entrar no centro. O treino não concede XP nem aumenta o nível; o nível
sobe com XP das partidas e concede +1 em todos os atributos.
Não há espera entre sessões, mesmo com o atleta exausto. Ao terminar a animação,
clique em **Treinar novamente** para repetir imediatamente. Cada sessão gera +12 de cansaço. A melhora aparece em Equipe e vale nas próximas
partidas. Cada departamento tem um treinador; converse com ele e pressione Enter para
abrir a escolha do atleta.

`POST /api/v1/training/sessions` recebe `Idempotency-Key: <uuid>` e JSON
`{"ownedPlayerId":"<uuid>","focus":"DRIBBLING"}`. Os focos aceitos são
`SPEED`, `DRIBBLING`, `FINISHING`, `DEFENDING` e `PHYSICAL`.
`GET /api/v1/training/status` retorna `cooldowns: []`; os campos de
progresso são mantidos para compatibilidade, com zero após novas sessões. A resposta
do comando contém atributo anterior/atual (agora aceitando quartos de ponto) e
`nextAvailableAt` igual ao horário da nova sessão. Recibos históricos preservam seu
horário original ao repetir a chave, sem bloquear novas sessões. A V20 preserva os bônus existentes ao convertê-los em quartos
de ponto inteiros no banco; não concede recompensas retroativas por sessões parciais.
O servidor valida
posse e persiste bônus e desgaste de forma transacional. Repetir a
mesma chave recupera o resultado sem reaplicar ganho ou desgaste. A V23 remove
a espera entre treinos; o frontend permite apenas uma animação por vez.

O mapa está em [`frontend/src/assets/maps/benfica.json`](frontend/src/assets/maps/benfica.json),
no formato Tiled JSON (72 × 50 tiles de 32 px). Ele pode ser aberto no Tiled; preserve as
camadas `ground`, `collisions`, `spawns`, `interactions`, `landmarks`, `houses` e `buildings`. As propriedades
`mapId` e `spawnKey` são IDs estáveis independentes dos nomes exibidos. A propriedade de tile
`collides` controla as colisões. O conteúdo do mapa é estático e separado de estado persistente.

Os assets SVG originais e suas instruções de substituição estão em
[`frontend/public/assets/placeholders/README.md`](frontend/public/assets/placeholders/README.md).

Para parar o banco sem apagar os dados:

```bash
docker compose down
```

## Configuração

O Compose possui valores padrão destinados somente ao desenvolvimento local:

| Variável | Padrão |
| --- | --- |
| `POSTGRES_DB` | `jogorua` |
| `POSTGRES_USER` | `jogorua` |
| `POSTGRES_PASSWORD` | `jogorua` |
| `POSTGRES_PORT` | `55432` |
| `BACKEND_PORT` | `8080` |
| `FRONTEND_PORT` | `5173` |
| `FRONTEND_HOST` | `127.0.0.1` |

As portas podem ser sobrescritas no ambiente ou em `.env`. No Compose, a conexão com o
banco usa os valores `POSTGRES_*` acima. Na execução manual, o backend aceita estas variáveis:

| Variável | Padrão |
| --- | --- |
| `DB_URL` | `jdbc:postgresql://localhost:5432/jogorua` |
| `DB_USER` | `jogorua` |
| `DB_PASSWORD` | `jogorua` |
| `SERVER_PORT` | `8080` |

Em ambientes compartilhados ou de produção, forneça credenciais próprias por variáveis de
ambiente. Não reutilize os valores locais.

## Testes, lint e builds

Backend:

```bash
cd backend
./gradlew ktlintCheck test build
```

Os testes de integração precisam de Docker: o Testcontainers inicia PostgreSQL 18.6 limpo,
aplica Flyway e descarta o banco ao terminar. `MilestoneThreeIntegrationTest` executa o smoke
por HTTP real (`perfil → starter → duelo → XP/nível → roster → retry`), além de concorrência, ownership, rollback
no commit, constraints e reprodução dos snapshots. Os testes puros exercitam milhares de
seeds, limites de stats, score/eventos, empates, equilíbrio e uma fixture fixa da versão 1.

Para executar somente os testes novos:

```bash
cd backend
./gradlew test --tests '*ProgressionTest' --tests '*DuelMatchEngineTest' --tests '*MilestoneThreeIntegrationTest'
```

Frontend:

```bash
cd frontend
npm ci
npm run lint
npm test
npm run build
```

Suíte de smoke E2E até o Milestone 7 em Chromium (PostgreSQL local ativo; portas 8080 e 5174 livres):

```bash
cd frontend
npx playwright install chromium
DB_URL=jdbc:postgresql://localhost:55432/jogorua npm run test:e2e
```

O Playwright inicia backend e Vite automaticamente. Se o banco usar outra porta, por exemplo:

```bash
DB_URL=jdbc:postgresql://localhost:55432/jogorua npm run test:e2e
```

Os testes criam perfis novos no banco configurado. Usam teclado real para caminhar/colidir,
selecionam starter, desafiam Nilo pela API real e verificam timeline, acelerar, pular,
conclusão temporal, recompensa, roster e reload. Um teste perde deliberadamente a resposta
após o commit e confirma que o retry não duplica XP. O smoke de M5 também perde as respostas
de recrutamento, recupera o comando e valida persistência após reload.
Uma fixture adicional cobre consulta de saves legados com mais de cinco atletas, atributos fracionados,
navegação por teclado e ausência de chamadas à API legada de lineup.
Capturas ficam em `frontend/test-results/`. Vitest cobre playback,
apresentação de eventos, API/retry, movimento e integridade do mapa.

Validação sintática do Compose:

```bash
docker compose config
```

## Validar Flyway em banco limpo

O comando abaixo remove o volume local do projeto e, portanto, apaga os dados desse banco:

```bash
docker compose down -v
docker compose up -d postgres
cd backend
DB_URL=jdbc:postgresql://localhost:55432/jogorua ./gradlew bootRun
```

Ao iniciar, o backend aplica automaticamente as migrations de
`backend/src/main/resources/db/migration`. Em outro terminal, confirme a versão aplicada:

```bash
docker compose exec -T postgres psql -U jogorua -d jogorua \
  -c "SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank;"
```

As migrations esperadas são a baseline `1`, o schema mínimo `2`, os seeds de starters `3`,
o schema/seeds de duelo `4`, a progressão/recompensas `5`, o ajuste de Nilo `6`,
recrutamento/lineup `7`, estádio/troféus `8`, sete novos desafiantes do Benfica `9`,
cores do time `10`, treino/balanceamento inicial `11` e ajuste fino de Davi `12`.

## Estrutura

```text
/
├── backend/       # monólito modular Spring Boot
├── frontend/      # cliente Vite + Phaser
├── docs/          # especificação autoritativa
├── compose.yaml   # PostgreSQL local
└── AGENTS.md
```

Consulte `AGENTS.md` e `docs/GAME_SPEC.md` antes de avançar para qualquer milestone seguinte.

## Milestone 6 — Estádio com duelos 1x1

Aproxime-se do portão `benfica.stadium.entry` no sudeste e use E/Enter. O avatar
entra no interior; caminhe até Dimas, converse com E e confirme com Enter.
Os torcedores da casa apoiam o time do estádio e torcem contra você.

Escolha um atleta do elenco para cada duelo, podendo repetir ou trocar entre jogos.
Dimas possui cinco adversários, ordenados por nível e soma dos atributos efetivos;
o melhor entra por último. Vença os cinco consecutivamente para ganhar a taça.
Uma derrota encerra a tentativa e exige recomeçar pelo primeiro rival.
Empates são decididos nos pênaltis. Precisa reunir cinco atletas no elenco, sem montar lineup.

Na quadra há somente dois jogadores. A torcida usa avatares maiores, braços animados,
bandeiras e faixa vermelho/creme em arquibancadas nos quatro lados, fora da área de
jogo. Dimas aparece nas conversas: após cada duelo, a quadra dá lugar ao seu retrato
e comentário. Na vitória, ele anuncia o próximo rival; confirme para escolher seu
atleta e iniciar o próximo desafio. O playback permite acelerar ou pular. Você pode
retornar ao interior entre jogos; CONTINUAR após reload recupera a sequência ativa.

API da sessão:

- GET `/api/v1/stadiums/{id}`: status AVAILABLE/LOCKED/COMPLETED, cinco adversários
  ordenados e `series: {id, played, wins, finished} | null`.
- POST `/api/v1/stadiums/{id}/matches`: exige Idempotency-Key e corpo
  `{ownedPlayerId, seriesId, roundNumber}`. Envie o ID da última tentativa do GET
  (null antes da primeira); rodada 1 após derrota ou `played + 1` se ativa.
- Resposta: modo STADIUM_1V1 v3, um atleta por lado, eventos, placar/pênaltis,
  XP somente de quem participou e progresso da tentativa em `rewards.series`.
  Troféu somente na quinta vitória consecutiva.
- Comando de tela antiga recebe STADIUM_SEQUENCE_CHANGED; mesma chave recupera o
  resultado original sem duplicar XP/avanço. Nova chave após conquista é rejeitada.

A migration V19 preserva partidas e troféus antigos. Resultados 5x5 existentes são preservados; o simulador coletivo foi removido. Veja [ADR-0008](docs/decisions/ADR-0008-stadium-duel-series.md).

Versão local: [http://localhost:5173](http://localhost:5173). Para atualizar mantendo o banco:

```bash
docker compose up -d --build --wait
```

## Milestone 7 — Benfica do início ao troféu

O caminho introdutório segue Nilo → Cora → Davi → Bia, avançando para leste e sul desde a entrada.
Cada vitória permite um convite no resultado ou na tela Equipe. Rui, Sol, Teca e Zeca
oferecem alternativas mais fortes, com níveis de 2 a 5. A distância até o estádio diminui
conforme o nível dos desafiantes aumenta. Os diálogos indicam onde procurar.
O HUD orienta reunir cinco atletas e vencer os cinco duelos consecutivos no estádio;
após a vitória, mostra a conquista do bairro.

As quatro casas, a escola, a academia e o prédio têm plantas, pisos, móveis e moradores
próprios. Moradores e desafiantes possuem silhuetas variadas. As falas apresentam o
professor Dimas, antigo professor de educação física e treinador do estádio, e os atletas
Íris, Tito, Lia, Ivo e Mara. É conteúdo narrativo estático; o elenco do estádio permanece
autoritativo no backend.

Os sons de gol, vitória e recrutamento são sintetizados e originais (Web Audio, sem assets
ou dependências extras). O botão **Som** permite silenciar e lembra a preferência.
Requisições têm timeout de 15 segundos e as telas oferecem recuperação. A mesma chave é
mantida em retries de partida; resultados e recompensas vêm sempre do servidor.

CONTINUAR após reload restaura perfil/starter, XP/nível, recrutamentos e troféu do PostgreSQL,
enquanto a sessão HTTP continuar válida. A posição volta à entrada. A sessão ainda não
é uma conta persistente entre reinícios do backend; autenticação pública permanece fora
deste milestone.

O balanceamento usa os seeds reais da V9, os ajustes V11/V12 e engines existentes, sem alterar partidas
históricas. `MilestoneSevenIntegrationTest` simula 2.000 seeds por combinação:
primeiro duelo aproximadamente 72–85% de vitórias. A sequência completa do estádio
é mais difícil no nível inicial e fica mais provável com evolução e treino; as cinco
vitórias devem ocorrer na mesma tentativa. São probabilidades, não garantias.

Validação completa:

```bash
cd backend
./gradlew clean check build
cd ../frontend
npm run lint
npm test
npm run build
```

Smoke E2E com PostgreSQL isolado (pare o backend do Compose antes; portas 55434, 8080 e 5174 livres):

```bash
POSTGRES_PORT=55434 docker compose -p jogorua-m7-validation up -d --wait postgres
cd frontend
DB_URL=jdbc:postgresql://localhost:55434/jogorua npm run test:e2e -- --workers=1
cd ..
# Remove somente o banco temporário desta validação:
POSTGRES_PORT=55434 docker compose -p jogorua-m7-validation down -v
```

O teste `vertical-slice.spec.ts` cria perfil e starter pela interface, caminha com teclado,
desafia/recruta quatro NPCs, consulta o elenco sem slots, entra no estádio, conversa com
Dimas e disputa duelos individuais até vencer os cinco consecutivamente e ganhar a taça. Não injeta
elenco, XP, seed ou placar e não escreve SQL. Perde respostas de duelo e estádio após o
commit para verificar idempotência; confere XP, reload, elenco, troféu e rejeição de nova
partida. Uma captura da conquista é salva em `frontend/test-results/`.
O antigo E2E de estádio com elenco injetado foi substituído por esse fluxo sem fixtures.
A suíte mantém os testes de colisão, playback, recrutamento com falhas de rede e
adiciona recuperação de conexão e preferência de som.

No backend, `MilestoneSevenIntegrationTest` completa o bairro com cada um dos três starters
via HTTP e engine real, recrutando os oito NPCs, sem preparar saves no banco. Confere
contagens de partidas/troféus, retries sem XP duplicado e migrations em PostgreSQL limpo.

### Personalização e moradores do bairro

Depois da formatura, Miguel pergunta as duas cores do time antes de escolher o primeiro jogador.
Todos os recrutados usam esse uniforme e deixam de aparecer no mapa. As cores e o
elenco são restaurados pela sessão do servidor ao recarregar.

Os três starters aparecem com desenhos distintos e o uniforme escolhido. O bairro
inclui quatro casas, escola, academia, prédio residencial, lago e um estádio visível.
Aproxime-se de uma porta e pressione E ou Enter para entrar. Dentro, caminhe,
converse com os moradores e use Esc ou a porta para voltar ao mesmo ponto da rua.
Moradores fazem pequenos movimentos de espera; desafiantes puxam conversa
automaticamente. Nomes aparecem somente nos diálogos.

Para executar E2E enquanto outra instância ocupa 8080, defina `E2E_BACKEND_PORT`
(por exemplo, 18080) e `DB_URL` apontando para um PostgreSQL de teste. O Playwright
inicia backend e Vite com o proxy correspondente, sem interromper a outra instância.
Se já existir um backend local em 8080, `E2E_REUSE_BACKEND=1` reutiliza essa instância.

### Atributos dos duelos

Os atletas possuem cinco atributos: velocidade, drible, finalização, marcação e físico.
A academia oferece cinco setores. A V21 adapta os saves e os snapshots sem recalcular
placares ou recompensas, preservando os bônus dos atributos mantidos. O simulador
coletivo foi removido; registros antigos continuam legíveis. Ver [ADR-0010](docs/decisions/ADR-0010-five-duel-attributes.md).

### Cansaço dos atletas

Treinos geram +12 de desgaste; duelos de rua e estádio geram +18. Cada atleta
recupera 4 pontos por minuto real, inclusive fora do jogo. A partir de 30/60/85,
os atributos usados em partidas caem temporariamente 5%/10%/15%. Níveis, XP e
atributos conquistados são preservados; duelos seguem disponíveis mesmo exausto.
O próximo treino pode começar assim que a animação da sessão terminar, sem
tempo adicional de espera. Equipe e seleções mostram condição, recuperação e efeito nos atributos.
Regras e contrato: seção 11.6 de `docs/GAME_SPEC.md`, ADRs 0011/0012 e migrations V22/V23.


## Abertura e retomada

A decisão e os limites de save estão no [ADR-0013](docs/decisions/ADR-0013-coach-opening-and-continue.md).
A abertura não exige novas migrations. `/profile/new-game` exige chave de idempotência;
`STADIUM_ROSTER_INCOMPLETE` é a recusa autoritativa para menos de cinco atletas.
Os testes `opening.spec.ts`, `avatar-rendering.spec.ts` e `team-colors.spec.ts` cobrem
formatura/nome, novo jogo, retomada da rua/interior, identidade fixa e uniformes do elenco.

### Limite e dispensa do elenco

A V24 preserva os registros de atletas dispensados e o histórico, aplicando o limite
no servidor e no banco. Saves antigos com mais de cinco atletas continuam íntegros,
mas precisam abrir vaga antes de contratar. Qualquer atleta, inclusive o último ou o
starter, pode ser dispensado; o convite imediato permite recompor um elenco vazio.
A recontratação usa a mesma identidade e não concede XP, treinos ou vitórias extras.
Uma dispensa repetida com a mesma chave, mesmo após recontratação, devolve o recibo original.

`MilestoneFiveIntegrationTest` cobre limite, concorrência, validação, privacidade,
transações, progresso preservado e replay. `roster-limit.spec.ts` cobre o bloqueio da
sexta contratação, cancelar/confirmar dispensa, resposta perdida, posição no mapa,
reload, substituição e recuperação do starter. Ver [ADR-0015](docs/decisions/ADR-0015-roster-limit-and-dismissal.md).

### Centro de Recuperação

O centro fica isolado ao sul do Benfica, depois de uma trilha longa entre árvores.
Aproxime-se de uma maca ou balde de gelo e use E/Enter (Recuperar no celular) para
escolher um atleta. Macas e banhos de gelo recuperam todo o cansaço em 5 segundos,
sem diferença entre as estações. A recuperação natural permanece em 4. O tratamento continua fora do prédio e ao fechar o jogo; até
terminar, o atleta fica fora de treinos e partidas. Interromper no centro preserva o
cansaço recuperado. Ao terminar, o atleta fica disponível automaticamente.

A V25 persiste tratamentos e recibos idempotentes e amplia as posições de dispensa
para a trilha do sul. Testes: `RecoveryIntegrationTest`, `RecoveryPolicyTest` e
`frontend/e2e/recovery.spec.ts`. Decisão: `docs/decisions/ADR-0016-recovery-center.md`.


## Orientações do treinador durante os duelos

A interface usa o motor incremental v4: cinco trechos, com pausa para escolher ritmo
(Cadenciar/Normal/Apressar) e postura (Defensivo/Equilibrado/Ofensivo). O relógio para
na orientação. Desmarcar “Pausar para orientar” mantém o jogo contínuo; instruções
alteradas durante a animação entram no próximo trecho. Apressar cria mais ações e
mais desgaste; cadenciar conserva a posse e o fôlego. Postura troca força de ataque
por defesa. Cansaço cresce dentro da partida e depende do esforço e do físico.

CONTINUAR retoma um duelo incompleto salvo no PostgreSQL. XP, recrutamento e avanço
do estádio só acontecem ao concluir. Pular resolve o restante com as instruções
selecionadas. Respostas perdidas oferecem recuperação do mesmo comando, sem avançar
ou premiar duas vezes. Não se pode iniciar outra atividade enquanto o duelo está ativo.
Endpoints antigos e resultados históricos são preservados. Ver
[ADR-0018](docs/decisions/ADR-0018-coached-duel-steps.md).

Validação específica:

```bash
cd backend
./gradlew test --tests 'com.streetfootball.game.match.domain.*' --tests 'com.streetfootball.game.CoachedMatchIntegrationTest'
cd ../frontend
npm test
npm run lint
npm run build
npm run test:e2e -- coaching.spec.ts --workers=1
```
