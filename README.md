# Jogo de Rua

RPG single-player de futebol descrito em [`docs/GAME_SPEC.md`](docs/GAME_SPEC.md).
O repositório contém o **Milestone 7**: o primeiro bairro pode ser concluído do perfil
novo ao troféu, com oito desafiantes recrutáveis, equipe de cinco e estádio autoritativo.
Há somente um bairro (Benfica), com áudio mínimo, orientação de progresso e recuperação de erros.

## Stack

- Frontend: TypeScript 6, Vite 8, Phaser 4 e Vitest.
- Backend: Kotlin 2.3, Spring Boot 4.1, Gradle 9.7 e JDK 21.
- Banco: PostgreSQL 18.6 e Flyway.
- Infraestrutura local: Docker Compose.

As versões npm estão fixadas em `frontend/package-lock.json`. As dependências JVM ficam
fixadas em `backend/gradle.lockfile`, e a distribuição Gradle está fixada no Wrapper.

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
é preservado. As portas publicadas são locais (`127.0.0.1`).

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

## API do Milestone 1

Enquanto a autenticação não é ativada, o backend associa o perfil a uma sessão HTTP criada
pelo próprio servidor. O cliente não envia nem escolhe um `profileId`. Exemplo com `curl`:

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
Na primeira visita, informe o nome, clique **Começar** e escolha um dos três starters.
Uma sessão existente entra no mundo com seu elenco persistido.

- **Setas / WASD:** caminhar; vá à direita até Nilo na quadra.
- Ao se aproximar de Nilo, a fala abre automaticamente uma vez por aproximação.
- **E / Enter:** reabrir o diálogo quando estiver próximo.
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
- **Equipe / T:** abrir o elenco, consultar atributos, selecionar um cartão e clicar em um
  dos cinco slots. **Salvar escalação** persiste a equipe; slots vazios são permitidos.
  Mover um jogador esvazia seu slot anterior. **Retirar** deixa o jogador na reserva.
- O conteúdo permite starter + oito recrutáveis. Vença quatro NPCs, convide-os e salve
  cinco jogadores na escalação para disputar o estádio. Os demais são reforços opcionais.

### API de recrutamento e lineup

- `GET /api/v1/challenges/{id}`: status `LOCKED`, `AVAILABLE` ou `RECRUITED` e histórico da sessão.
- `POST /api/v1/challenges/{id}/recruit`: sem body obrigatório; idempotente por perfil/desafiante,
  sem necessidade de `Idempotency-Key`. Retorna `{challengerId, ownedPlayerId}` estável.
- `GET /api/v1/roster`: elenco da sessão, com nível, XP, arquétipo, função e stats efetivos.
- `GET /api/v1/lineup` e `PUT /api/v1/lineup`: `{ "ownedPlayerIds": ["<id>", null, null, null, null] }`.
  O array deve ter cinco posições, sem IDs repetidos e somente com jogadores da sessão.
  PUT substitui a escalação inteira em uma transação e pode ser repetido com segurança.

V7 reconhece vitórias do M4 com recompensa persistida e libera seus convites. Nilo entra
no elenco no nível do desafiante, com XP e histórico zerados. Recrutar não concede XP adicional.
Detalhes e decisões em [ADR-0003](docs/decisions/ADR-0003-recruitment-and-lineup.md).

Nilo foi ajustado como adversário introdutório: as chances de vitória no nível 1 ficam
aproximadamente entre 71% e 82%, conforme o starter. Essa alteração vale para novos duelos;
resultados, XP e recompensas já salvos permanecem iguais.

O playback usa uma base de aproximadamente 30 segundos, acrescida das comemorações de gol.
O autor do gol levanta os braços, com mensagem por 1,8 s (mínimo de 0,9 s em 4×).
No final, o vencedor fica feliz e o perdedor cabisbaixo; em empate ficam neutros. Acelerar/pular só alteram a apresentação:
placar e recompensas já foram persistidos pelo servidor. Em falha de resposta, **Tentar
novamente** mantém a mesma chave de idempotência. Recarregar mantém XP/nível enquanto a
sessão continuar válida; a posição no mapa ainda volta à entrada.

O personagem colide com construções, cercas vivas e o NPC. A câmera acompanha o movimento
e respeita os limites do bairro. O diálogo e a seleção pausam o movimento.

Entre no **Centro de Treinamento do Benfica** pela porta do prédio marcado no mapa.
Lá dentro há seis setores com atletas treinando. Aproxime-se do treinador do setor
desejado, pressione **E** para conversar e **Enter** para escolher um atleta. Clique em
**Começar treino**. A atividade do atleta escolhido dura 5 segundos. São necessários
5 treinos do mesmo fundamento com o mesmo atleta para ganhar +1 nesse atributo, até 99.
O progresso e quantos faltam aparecem na tela de treino. Antes do quinto, a habilidade
e o desempenho na partida não mudam. A treinadora Jo explica a regra ao entrar no
centro. O treino não concede XP. Só há um
treino por vez e é preciso esperar 1 minuto antes de começar outro, mesmo com um
atleta diferente. A melhora aparece em Equipe e vale nas próximas partidas.

`POST /api/v1/training/sessions` recebe `Idempotency-Key: <uuid>` e JSON
`{"ownedPlayerId":"<uuid>","focus":"DRIBBLING"}`. Os focos aceitos são
`SPEED`, `DRIBBLING`, `PASSING`, `FINISHING`, `DEFENDING` e `PHYSICAL`.
`GET /api/v1/training/status` informa quando o próximo treino estará disponível e
o progresso por atleta e fundamento. A resposta do comando contém atributo e progresso
anterior/atual, além de `nextAvailableAt`. O servidor valida
posse, aplica cooldown e persiste a recompensa de forma transacional. Repetir a
mesma chave recupera o resultado; nova chave antes do prazo retorna
`409 TRAINING_COOLDOWN`.

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
de recrutamento e PUT do lineup, recupera os comandos e valida persistência após reload.
Uma fixture adicional cobre cinco escalados, reservas, movimento e remoção entre slots.
Capturas ficam em `frontend/test-results/`. Vitest cobre playback, seleção de lineup,
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

## Milestone 6 — Estádio

O ponto `benfica.stadium.entry` fica no sudeste do bairro, após os desafiantes mais fortes. Aproxime-se e use E/Enter
ou clique na placa. A tela exibe os cinco adversários e a disponibilidade autoritativa.
Com cinco jogadores na escalação salva, permite iniciar, acelerar/pular o playback e
ver XP individual e troféu. Após a vitória, a placa e a tela mostram **conquistado**,
inclusive após reload. O estádio não oferece revanche depois do troféu.

API da sessão:

- `GET /api/v1/stadiums`: estados `LINEUP_INCOMPLETE`, `LOCKED`, `AVAILABLE`, `COMPLETED`.
- `GET /api/v1/stadiums/benfica_stadium`: requisitos faltantes, adversários e troféu.
- `POST /api/v1/stadiums/benfica_stadium/matches`, com `Idempotency-Key: UUID` e sem payload necessário.
  Usa o lineup persistido; o cliente não escolhe seed, placar ou recompensas.
- Resposta `{match, rewards}`: `match.mode = STADIUM_5V5`, cinco participantes de cada lado,
  eventos, placar regulamentar, outcome, `penalties: {home, away} | null`, seed e engineVersion.
  `rewards.players` contém os cinco snapshots de XP/nível e `rewards.trophy` é nulo em derrota.
- Erros: `LINEUP_INCOMPLETE`, `STADIUM_LOCKED`, `STADIUM_REQUIREMENT_NOT_MET`,
  `STADIUM_ALREADY_COMPLETED` e `IDEMPOTENCY_CONFLICT` retornam 409; estádio inexistente, 404.
- A mesma chave retorna o snapshot original mesmo após vitória, troca do lineup ou bloqueio.
  Uma chave nova depois da conquista é rejeitada. Chaves são compartilhadas com duelos.

V8 adiciona estádio, escalação adversária, requisitos e troféus, preservando migrations antigas.
Duelo permanece engine v1; estádio usa v2, com primitivas compartilhadas e goleiro abstrato.
Pênaltis não somam ao placar regulamentar nem aos eventos `GOAL`.
Veja [ADR-0004](docs/decisions/ADR-0004-stadium-matches.md).

## Milestone 7 — Benfica do início ao troféu

O caminho introdutório segue Nilo → Cora → Davi → Bia, avançando para leste e sul desde a entrada.
Cada vitória permite um convite no resultado ou na tela Equipe. Rui, Sol, Teca e Zeca
oferecem alternativas mais fortes, com níveis de 2 a 5. A distância até o estádio diminui
conforme o nível dos desafiantes aumenta. Os diálogos indicam onde procurar.
O HUD orienta formar cinco, salvar a escalação e visitar o estádio no sudeste;
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

Reload restaura perfil/starter, XP/nível, recrutamentos, lineup e troféu do PostgreSQL,
enquanto a sessão HTTP continuar válida. A posição volta à entrada. A sessão ainda não
é uma conta persistente entre reinícios do backend; autenticação pública permanece fora
deste milestone.

O balanceamento usa os seeds reais da V9, os ajustes V11/V12 e engines existentes, sem alterar partidas
históricas. `MilestoneSevenIntegrationTest` simula 2.000 seeds por combinação:
primeiro duelo 71–80% de vitórias, primeiro time de cinco 26–31% no estádio e
um time com os reforços do bairro 55–59%. São probabilidades, não garantias. Explorar
melhora o time sem exigir elevar todos ao nível máximo.

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
desafia/recruta quatro NPCs, monta cinco slots e disputa até ganhar a taça. Não injeta
elenco, XP, seed ou placar e não escreve SQL. Perde respostas de duelo e estádio após o
commit para verificar idempotência; confere XP, reload, lineup, troféu e rejeição de nova
partida. Uma captura da conquista é salva em `frontend/test-results/`.
O antigo E2E de estádio com elenco injetado foi substituído por esse fluxo sem fixtures.
A suíte mantém os testes de colisão, playback, recrutamento/lineup com falhas de rede e
adiciona recuperação de conexão e preferência de som.

No backend, `MilestoneSevenIntegrationTest` completa o bairro com cada um dos três starters
via HTTP e engine real, recrutando os oito NPCs, sem preparar saves no banco. Confere
contagens de partidas/troféus, retries sem XP duplicado e migrations em PostgreSQL limpo.

### Personalização e moradores do bairro

Ao começar, confirme as duas cores do time antes de escolher o primeiro jogador.
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
