# Street Football RPG — Product & Engineering Specification

> **Status:** especificação autoritativa para o MVP  
> **Idioma do produto:** pt-BR inicialmente  
> **Código:** inglês  
> **Tipo de jogo:** RPG 2D single-player conectado  
> **Plataforma inicial:** Web  
> **Documento destinado a:** desenvolvedor humano e agentes de código (especialmente Codex)

---

# 1. Como ler esta especificação

Os termos abaixo são normativos:

- **MUST** — obrigatório para o escopo descrito.
- **SHOULD** — recomendação forte; desviar somente com justificativa.
- **MAY** — opcional.
- **MUST NOT** — explicitamente fora do escopo ou proibido.

Quando houver conflito entre uma ideia futura e o MVP, o MVP vence.

O objetivo deste documento não é antecipar todos os detalhes possíveis do jogo. O objetivo é definir contratos, invariantes e decisões suficientes para permitir implementação incremental sem o agente inventar uma arquitetura diferente a cada etapa.

---

# 2. Visão do produto

## 2.1 Pitch

Um RPG de futebol com exploração de cidade em pixel art.

O usuário controla um treinador fixo, pardo e de cabelo preto, com polo esportiva, bermuda, tênis e apito. Esse avatar é igual para todos os perfis e independente dos atletas e das cores do time. Ele anda por bairros, encontra desafiantes, escolhe atletas para duelos individuais, recruta jogadores e evolui seu elenco.

Ao preparar seus atletas, o jogador enfrenta cinco duelos 1x1 consecutivos em cada estádio. Cada treinador possui cinco jogadores, com o mais forte por último. Vencer todos na mesma tentativa concede um troféu e libera progressivamente níveis maiores da jornada; uma derrota exige recomeçar pelo primeiro rival:

```text
bairro
  ↓
cidade
  ↓
estado
  ↓
região
  ↓
continente
  ↓
mundo
```

A estrutura de progressão lembra RPGs clássicos de exploração e coleção, mas o universo, regras, arte, personagens e identidade do jogo devem ser originais.

---

# 3. Princípios de design

## 3.1 Explorar é parte central do jogo

O jogador não deve ficar apenas em menus.

O loop deve incentivá-lo a:

- andar pelo mapa;
- encontrar quadras;
- conversar com NPCs;
- descobrir jogadores;
- revisitar locais;
- descobrir desafios mais fortes;
- montar diferentes combinações de time.

## 3.2 Partidas são simuladas, não controladas em tempo real

O jogo não pretende ser FIFA/eFootball.

Durante uma partida, o jogador observa uma simulação textual/visual curta, semelhante conceitualmente a um manager retrô:

```text
12' Juninho roubou a bola.
14' Caio tentou o drible.
15' Caio passou pelo marcador!
16' Caio chutou...
16' GOL!
```

O foco é:

- atributos;
- composição;
- progressão;
- probabilidade;
- eventos;
- narrativa emergente.

## 3.3 O jogador precisa ter razões para explorar

Repetir indefinidamente o NPC mais fraco não pode ser a estratégia ótima.

O sistema MUST aplicar retorno decrescente de XP em revanches e/ou diferença de nível.

## 3.4 Colecionar jogadores deve importar

Novos jogadores não são apenas skins.

Eles devem possuir combinações distintas de:

- stats;
- arquétipo;
- nível inicial;
- potencial de crescimento;
- função tática.

## 3.5 O MVP precisa provar diversão antes de quantidade

Não construir “o Brasil inteiro” antes de validar um bairro.

---

# 4. Escopo do MVP

## 4.1 Fatia vertical obrigatória

O MVP MUST permitir o seguinte fluxo:

```text
abrir menu pixelado Rua 5: INICIAR, CONTINUAR, OPÇÕES
  ↓
INICIAR: nova formatura na universidade (CONTINUAR: retomar jornada existente)
  ↓
receber canudo do reitor, informar nome e ouvir orientações
  ↓
caminhar até a saída e conversar com Miguel na rua
  ↓
escolher as cores do time e criar a nova jornada
  ↓
escolher 1 de 3 starters
  ↓
entrar em um bairro
  ↓
andar livremente
  ↓
interagir com um desafiante
  ↓
escolher um jogador do elenco
  ↓
simular desafio 1x1 no backend
  ↓
reproduzir os eventos no frontend
  ↓
receber XP
  ↓
evoluir nível quando aplicável
  ↓
desbloquear recrutamento
  ↓
recrutar jogadores
  ↓
reunir cinco atletas no elenco
  ↓
entrar no estádio do bairro e caminhar até o treinador
  ↓
simular cinco duelos 1x1, escolhendo um atleta por jogo
  ↓
vencer todos consecutivamente
  ↓
ganhar troféu
  ↓
estádio passa a ficar concluído
```

## 4.2 Conteúdo mínimo sugerido

O MVP SHOULD conter:

- 1 bairro;
- 1 mapa principal;
- 3 starters;
- 8 a 12 desafiantes;
- 10 a 15 definições de jogador;
- 1 estádio;
- 1 time adversário do estádio;
- níveis 1 a 15 utilizáveis;
- 1 troféu;
- 3 a 4 arquétipos de jogador;
- 1 tela de equipe;
- 1 tela de partida;
- 1 tela/menu inicial.

## 4.3 Não escopo do MVP

MUST NOT implementar inicialmente:

- PvP;
- mundo compartilhado;
- mercado entre jogadores;
- chat;
- clãs;
- guildas;
- ranking global;
- partidas controladas em tempo real;
- física da bola;
- goleiro explícito;
- lesões;
- contratos;
- salários;
- transferências entre usuários;
- inventário complexo;
- crafting;
- múltiplos continentes;
- dezenas de mapas;
- mobile nativo;
- Steam;
- editor administrativo;
- IA generativa em runtime;
- lootboxes.

---

# 5. Plataforma e arquitetura

## 5.1 Decisão

A plataforma inicial MUST ser Web.

O jogo é “offline” apenas no sentido de **não ser multiplayer online**.

Ele MAY exigir conexão com o backend para jogar.

## 5.2 Visão arquitetural

```text
┌──────────────────────────────────────────────┐
│                  Browser                     │
│                                              │
│  TypeScript + Vite + Phaser                  │
│                                              │
│  - mapa                                      │
│  - sprites                                   │
│  - input                                     │
│  - animações                                 │
│  - diálogos                                  │
│  - HUD                                       │
│  - reprodução dos eventos da partida         │
└───────────────────┬──────────────────────────┘
                    │ HTTPS / REST / JSON
                    ▼
┌──────────────────────────────────────────────┐
│             Kotlin + Spring Boot             │
│                                              │
│  monólito modular                            │
│                                              │
│  - profile                                   │
│  - roster                                    │
│  - challenges                                │
│  - match                                     │
│  - progression                               │
│  - recruitment                               │
│  - stadiums                                  │
│  - trophies                                  │
└───────────────────┬──────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────┐
│                 PostgreSQL                   │
│                                              │
│  estado persistente e conteúdo autoritativo  │
└──────────────────────────────────────────────┘
```

## 5.3 Por que não desktop inicialmente

Desktop não traz vantagem relevante ao MVP.

A carga gráfica é pequena:

- tilemap 2D;
- sprites;
- poucos NPCs ativos;
- colisões simples;
- simulação matemática;
- texto.

Se futuramente distribuição desktop for desejada, o cliente web MAY ser empacotado com tecnologia apropriada, desde que isso não contamine o MVP.

---

# 6. Stack recomendada

## 6.1 Frontend

MUST:

- TypeScript;
- Vite;
- Phaser.

SHOULD:

- Tiled para autoria de mapas;
- Vitest para lógica/frontend testável;
- Playwright para poucos smoke tests E2E.

Não adicionar React no MVP sem necessidade clara.

Se telas de aplicação crescerem muito no futuro, React MAY ser introduzido como shell/overlay, sem transferir o game loop do Phaser para React.

## 6.2 Backend

MUST:

- Kotlin;
- Spring Boot;
- Gradle Kotlin DSL;
- Spring Web;
- Spring Validation;
- Spring Data JPA;
- Flyway;
- PostgreSQL;
- JUnit 5.

SHOULD:

- Testcontainers PostgreSQL para integração;
- Spring Security quando autenticação for ativada;
- JDK 21 ou superior compatível com a versão de Spring utilizada.

## 6.3 Infra local

MUST existir uma forma simples de executar PostgreSQL localmente.

Preferência:

```text
compose.yaml
```

A primeira experiência de desenvolvimento SHOULD ser próxima de:

```bash
docker compose up -d postgres
cd backend && ./gradlew bootRun
cd frontend && npm install && npm run dev
```

Os comandos reais devem ser documentados no `README.md`.

---

# 7. Estrutura de repositório

Estrutura alvo:

```text
/
├── AGENTS.md
├── README.md
├── compose.yaml
├── docs/
│   ├── GAME_SPEC.md
│   └── decisions/
│       └── ...
├── frontend/
│   ├── src/
│   │   ├── game/
│   │   │   ├── scenes/
│   │   │   ├── entities/
│   │   │   ├── input/
│   │   │   ├── ui/
│   │   │   └── maps/
│   │   ├── api/
│   │   ├── state/
│   │   ├── config/
│   │   └── main.ts
│   ├── public/
│   │   ├── assets/
│   │   ├── maps/
│   │   └── audio/
│   └── ...
└── backend/
    ├── src/main/kotlin/.../
    │   ├── profile/
    │   ├── roster/
    │   ├── challenge/
    │   ├── match/
    │   ├── progression/
    │   ├── recruitment/
    │   ├── stadium/
    │   ├── trophy/
    │   └── shared/
    ├── src/main/resources/
    │   └── db/migration/
    └── ...
```

Os módulos acima são **módulos lógicos dentro do monólito**, não serviços independentes.

---

# 8. Divisão de responsabilidades

## 8.1 Frontend é responsável por

- renderização;
- movimento;
- câmera;
- animações;
- áudio;
- colisão do mundo;
- interação com pontos do mapa;
- telas;
- input;
- reprodução temporal de eventos;
- feedback visual;
- caches não autoritativos.

Frontend MUST NOT decidir:

- placar final;
- XP final;
- level up final;
- quem foi recrutado;
- troféus;
- se um estádio foi vencido;
- se um estádio está desbloqueado;
- stats persistidos.

## 8.2 Backend é responsável por

- identidade/perfil;
- propriedade do elenco;
- regras de progressão;
- regras de desafio;
- Match Engine;
- resultados;
- recompensas;
- recrutamento;
- lineup;
- acesso a estádios;
- troféus;
- persistência.

## 8.3 PostgreSQL é responsável por

Persistência autoritativa de:

- perfis;
- jogadores definidos no universo;
- jogadores possuídos;
- progresso contra desafiantes;
- lineup;
- partidas;
- troféus;
- estádios;
- requisitos;
- conteúdo de gameplay que o backend precise consultar.

---

# 9. Mapas e Tiled

## 9.1 Princípio

A geometria do mapa é conteúdo do cliente.

O banco não deve armazenar cada tile ou coordenada de parede.

## 9.2 Layers sugeridos

```text
ground
roads
decorations
buildings
foreground
collisions
interactions
spawns
```

## 9.3 Identificadores estáveis

Objetos interativos no mapa MUST possuir identificador estável.

Exemplo:

```text
spawnKey = "benfica.court.01"
```

O banco referencia `spawnKey`, não `x/y`, sempre que possível.

Isso permite editar o mapa no Tiled sem migration de banco para cada deslocamento visual.

Exemplo:

```text
challenger:
  id: 42
  map_id: "benfica"
  spawn_key: "benfica.court.01"
```

O frontend encontra no Tiled o objeto de spawn correspondente.

## 9.4 Carregamento

Somente o mapa atual precisa estar ativo.

O JSON do mapa é um asset estático em `frontend/src/assets/maps`, com URL contendo
hash de conteúdo no build. Isso evita combinar código novo com mapa antigo no cache
do navegador após uma atualização. O HTML inicial deve ser revalidado (`Cache-Control: no-cache`).

Ao trocar de área:

1. salvar checkpoint/posição relevante;
2. descarregar scene/map atual;
3. carregar próxima scene/map;
4. buscar estado dinâmico necessário.

Não manter uma cidade inteira renderizada em uma única scene.

---

# 10. Modelo de domínio

## 10.1 PlayerDefinition

Representa um jogador existente no universo do jogo.

Campos conceituais:

```text
id
name
archetype
preferredRole
rarity
baseStats
growthProfile
recruitable
```

Stats iniciais do MVP:

```text
speed
dribbling
finishing
defending
physical
```

A V21 mantém somente esses cinco atributos no domínio, na API, no banco e no treino,
adaptando snapshots existentes sem recalcular resultados ou recompensas. O simulador
coletivo v2 foi removido; registros históricos continuam legíveis. Ver ADR-0010.

Todos MUST permanecer dentro de intervalo válido, inicialmente:

```text
1..99
```

## 10.2 OwnedPlayer

Representa a versão pertencente a um perfil.

```text
id
profileId
playerDefinitionId
level
xp
wins
draws
losses
recruitedAt
version
```

## 10.3 Archetype

Arquétipos iniciais sugeridos:

- `DRIBBLER`
- `FINISHER`
- `PLAYMAKER`
- `MARKER`

Arquétipos ajudam a:

- comunicar identidade;
- ponderar decisões do Match Engine;
- variar crescimento;
- criar composições interessantes.

Eles MUST NOT substituir stats individuais.

## 10.4 Starter

Antes de escolher um dos três starters, o usuário escolhe a cor principal e a
secundária do time, com prévia do uniforme. A confirmação cria o perfil com essas
cores; recarregar antes de escolher o starter retoma a escolha do jogador.
Na abertura, Miguel pergunta quais serão as cores do time após a formatura.
As cores são cosméticas, persistidas no perfil e usadas pelo primeiro jogador e
por todos os recrutados, inclusive nos cartões, duelos e poses de emoção.
Pele, cabelo e identidade do atleta são preservados. NPCs ainda no bairro mantêm
seus uniformes originais. Perfis existentes conservam amarelo/azul-escuro.
Não há edição posterior de cores nesta entrega.

Na criação do jogo, o usuário escolhe um dentre três starters.
As três opções exibem desenhos distintos do atleta já usando as cores confirmadas.

Sugestão:

```text
Starter A — veloz/driblador
Starter B — finalizador/físico
Starter C — marcador/armador equilibrado
```

Os três SHOULD ser aproximadamente equivalentes em poder, mas diferentes em estilo.

---

# 11. Progressão

## 11.1 Levels

MVP:

```text
level 1..15
```

A arquitetura SHOULD permitir aumentar o limite depois.

## 11.2 XP

Uma fórmula simples e centralizada MUST definir XP necessário.

Valor inicial recomendado:

```text
xpForNextLevel(level) =
round(100 * level ^ 1.35)
```

A fórmula é balanceamento, não contrato de API.

Ela MUST ficar centralizada/configurável no domínio e coberta por testes.

## 11.3 Stats efetivos

O sistema não deve sobrescrever stats base.

Conceito:

```text
effectiveStat =
clamp(
  baseStat + levelGrowth + trainingBonus,
  1,
  99
)
```

Implementação atual de balanceamento:

```text
levelGrowth = level - 1
```

Cada nível concede +1 em todos os atributos, limitado a 99. O nível 2 já produz
melhora, sem alterar stats base ou resultados históricos. Modificadores por arquétipo
abaixo são possibilidades futuras, não são aplicados no cálculo atual.
`trainingBonus` é persistido no atleta possuído, começa em zero e aumenta apenas no
fundamento treinado em +0,25 a cada sessão, respeitando o limite efetivo de 99.
Os atributos efetivos aceitam quartos de ponto e influenciam imediatamente as partidas.
O treino não concede XP nem altera o nível; level up continua dependendo do XP de partidas.

O `archetypeModifier` pode variar por stat.

Exemplo conceitual de DRIBBLER:

```text
dribbling: 1.25
speed:     1.10
finishing: 0.90
defending: 0.75
physical:  0.85
```

Esses números são defaults de MVP e MAY ser reajustados mediante testes de balanceamento.

## 11.4 Retorno decrescente

Revanche contra o mesmo desafiante MUST reduzir XP.

Tabela inicial:

```text
1ª vitória: 100%
2ª vitória: 65%
3ª vitória: 35%
4ª vitória: 15%
5ª+ vitória: 5%
```

Também aplicar modificador por diferença de nível.

Exemplo:

```text
player >= opponent + 6 levels -> XP final pode chegar a 0 ou mínimo simbólico
```

A fórmula final deve ser testável e centralizada.

## 11.5 Centro de treinamento

O prédio `benfica.gym.entry` abriga o centro de treinamento do Benfica. O jogador entra
no edifício, percorre cinco setores e conversa com um único treinador em cada setor.
Cada setor oferece um fundamento fixo (velocidade, drible, finalização, marcação
ou físico); a mensagem do treinador pergunta se o jogador quer treinar e informa
“Clique Enter para treinar”. Enter abre a tela de escolha de um atleta próprio. O diálogo
fica em uma faixa compacta no alto da tela, fora da área do personagem.
O frontend apresenta o atleta escolhido por cinco segundos na atividade correspondente:
esteira, três cones, chutes a gol, perseguição ou musculação. Apenas um
treino pode ocorrer por vez. Cada sessão concede +0,25 no atributo escolhido, sem XP,
se o valor efetivo ainda for menor que 99. Quatro sessões somam +1; cada ganho fracionado
já altera o atributo efetivo e o desempenho em partidas. Nível e XP não mudam.
O valor atual e o ganho por sessão são mostrados na tela, e a treinadora da academia explica
a regra em diálogo automático quando o jogador entra no prédio. O treino só pode ser
iniciado após conversar com o treinador do setor correspondente. Não há tempo de espera
entre sessões, mesmo com o atleta exausto. Ao concluir os cinco segundos, o botão
“Treinar novamente” permite outra sessão imediatamente. O desgaste continua seguindo
a seção 11.6. `GET /training/status` mantém `cooldowns: []` por compatibilidade; novos
recibos retornam `nextAvailableAt` igual ao horário da própria sessão.
O comando usa `Idempotency-Key`; retry retorna o mesmo resultado sem reaplicar bônus.
O backend deriva o perfil da sessão, valida a posse e persiste o bônus. Os snapshots de
duelos e estádio passam a usar esse bônus; partidas históricas não mudam. Treinos não
alteram placares ou recompensas de partidas já realizadas. A V20 converte os bônus
inteiros existentes em quartos de ponto, preservando seu valor. Contadores parciais
antigos são zerados no próximo treino daquele fundamento, sem recompensa retroativa;
retries de sessões antigas devolvem o resultado original. Ver ADR-0009.

## 11.6 Cansaço individual

Por decisão explícita do usuário, o MVP passa a ter cansaço entre atividades (ADR-0011).
Cada atleta começa com zero, inclusive em saves existentes. Treino gera +12;
duelo de rua ou estádio gera +18, em vitória, empate ou derrota. O valor é limitado
entre 0 e 100 e recupera 4 pontos por minuto real, inclusive fora do jogo.
A recuperação é calculada sob demanda pelo relógio do backend; consultar o elenco
não altera o estado persistido. Trocar de fundamento, NPC, mapa ou atleta não zera desgaste.

| Cansaço | Condição | Penalidade nos cinco atributos |
|---|---|---|
| 0 ≤ valor < 30 | Disposto | 0% |
| 30 ≤ valor < 60 | Cansado | 5% |
| 60 ≤ valor < 85 | Muito cansado | 10% |
| 85 ≤ valor ≤ 100 | Exausto | 15% |

A partida usa o cansaço antes do comando em um snapshot fixo, com atributos
`clamp(permanentStat * (1 - penaltyPercent / 100), 1, 99)`. O desgaste recebido
na atividade afeta atividades posteriores. O engine permanece puro e suas versões
não mudam, pois recebem os atributos já ajustados. Snapshots e recompensas históricas
não são recalculados. A política de desgaste tem versão 1 nos novos recibos.

Por nova solicitação explícita, o intervalo entre treinos foi removido (ADR-0012).
Cansaço também não bloqueia treinos. Treinos continuam concedendo +0,25, sem XP ou mudança de nível;
o limite de 99 é verificado sobre atributos permanentes, antes da penalidade.
Cansaço nunca bloqueia duelos de rua, inclusive com um único atleta. O estádio exige cinco atletas no elenco, independentemente da condição individual. Cansaço não muda XP, requisitos,
retorno decrescente, troféus ou regras de retomada do estádio.

`GET /roster` preserva `stats` permanentes e acrescenta `matchStats` ajustados e
`fatigue` com `value`, `condition`, `penaltyPercent`, `nextConditionAt` e
`fullyRecoveredAt` (horários UTC, nulos quando não aplicáveis). Condições usam
`RESTED`, `TIRED`, `VERY_TIRED`, `EXHAUSTED`. Esses campos são projeções do tempo atual.
Recibos de treino, recompensa de rua e cada recompensa individual de estádio incluem
`fatigue: { before, after, gained, policyVersion }`; recibos históricos usam `null`.
`gained` indica o custo da atividade, mesmo quando o limite de 100 absorve parte dele.
A interface mostra condição, penalidade, previsão de recuperação e desgaste recebido,
com atualização autoritativa periódica enquanto a seleção estiver aberta.

Partida/treino, desgaste e progresso são uma única transação. Comandos do perfil
continuam serializados pelo lock existente. Retry recupera o recibo original antes
de validar estado mutável e não aplica desgaste ou bônus outra vez. A V22 adiciona
campos com constraints. A V23 permite intervalo zero para novos treinos e preserva
os horários de recibos históricos somente para replay idempotente; nenhum prazo antigo
bloqueia uma nova sessão. Se o comando for confirmado e a atualização do elenco falhar,
o cliente repete somente essa consulta, sem criar outra sessão.

## 11.7 Centro de Recuperação

Por solicitação explícita, `benfica.recovery.entry` fica isolado no extremo sul do Benfica,
numa clareira acessível por uma trilha longa e sinuosa entre árvores com colisão. Academia,
estádio, desafiantes e portas anteriores mantêm suas posições. A recuperação natural
continua em 4 pontos por minuto; não há atalho ou transporte para o centro.

O interior explorável contém fisioterapeuta, massagista, três macas e dois grandes
baldes de gelo. Avatares de visitantes descansam nas macas como ambientação; atletas
do próprio elenco aparecem com sua identidade e uniforme no local do tratamento.
Aproximar-se de uma maca ou balde e usar E/Enter (Recuperar no celular) abre a escolha
individual do atleta. Não existe ação de iniciar tratamento à distância na interface.

Qualquer estação, maca ou banho de gelo, recupera todo o cansaço em cinco segundos.
Não há diferença de velocidade entre elas; a escolha é apenas de ambientação. Durante
o tratamento, essa regra substitui a recuperação natural, sem somá-la.
O atleta fica indisponível para novos treinos, duelos, estádios e dispensa enquanto
estiver em tratamento. Ao atingir zero, fica disponível automaticamente, sem precisar
retornar ao prédio. É possível interromper no local, preservando o cansaço já recuperado;
a partir dali volta a recuperar naturalmente. Atletas sem cansaço não iniciam tratamento.

O relógio do backend calcula recuperação e conclusão sob demanda, inclusive após sair,
recarregar ou fechar o jogo. O estado e os recibos são persistidos em PostgreSQL pela V25,
sem scheduler. O cliente nunca reduz cansaço por conta própria. A ocupação é individual
por jornada: um atleta por maca ou balde, sem compartilhar o centro entre usuários.
Comandos idempotentes por perfil serializam a ocupação e preservam recibos antes das
validações mutáveis. Seleções de treino e duelo desabilitam atletas em recuperação;
a tela Equipe continua permitindo consultar seus atributos. Ver ADR-0016.

---

# 12. Desafiantes de rua

## 12.1 Conceito

Um `Challenger` é um NPC ligado a:

- um jogador do universo;
- um mapa;
- um spawn;
- uma dificuldade;
- regras de disponibilidade.

Campos conceituais:

```text
id
playerDefinitionId
mapId
spawnKey
difficulty
minRequiredTrophies
enabled
```

## 12.2 Fluxo

```text
aproximar-se
  ↓
interagir
  ↓
diálogo
  ↓
DESAFIAR
  ↓
selecionar OwnedPlayer
  ↓
POST match
  ↓
backend simula
  ↓
frontend reproduz
  ↓
resultado/recompensas
```

A seleção de OwnedPlayer usa cartões com sprite, nome, nível e XP retornados pelo backend,
com destaque para o selecionado e navegação por clique ou teclado. Ao voltar ao bairro após
o resultado, o desafiante conversa conforme o outcome recebido: parabeniza a vitória,
incentiva após a derrota ou comenta o empate. A conversa permite fechar ou iniciar revanche.
Essas reações são apresentação; não recalculam resultado ou recompensa. Se o jogador
foi recrutado no resultado, ele sai do mapa e não abre essa conversa de revanche.

Desafiantes puxam conversa automaticamente ao se aproximar, uma vez por aproximação.
Durante a exploração, os desafiantes caminham em trajetos curtos e repetitivos de
ida e volta, com pequenas pausas nas pontas e ritmos diferentes. Os percursos começam
no spawn ou na posição do último encontro, respeitam as colisões do mapa e evitam
sobreposição com outros NPCs. Eles param perto do treinador e durante diálogos,
seleções, onboarding ou quando a cena está suspensa; retomam ao voltar à exploração.
Ao notar o treinador, a aproximação e a conversa automáticas têm prioridade sobre
o percurso. Isso também vale para atletas dispensados. Desafiantes, atletas dispensados e Miguel
usam a mesma animação de caminhada do treinador: quatro poses por direção, pernas
e braços alternados a cada 16 pixels, frente/perfil/costas e repouso ao parar.
As silhuetas dos NPCs usam a geometria dos passos do treinador com a aparência e
paleta próprias. Patrulhas, aproximações e o passeio de Miguel animam os membros;
a colisão dos pés permanece 18×14, sem oscilar com os quadros. A movimentação é apresentação
local do cliente: os IDs, spawns e posições persistidas de dispensa são preservados.
Não há nomes flutuando sobre personagens; o nome aparece apenas durante a conversa.
Moradores comuns usam os mesmos controles de proximidade, mas só conversam após E/Enter.
Suas falas apresentam o estádio e a dificuldade do adversário, sem desafios ou recompensas.
As casas, a escola, o centro de treinamento e o prédio residencial possuem portas com IDs estáveis.
Entrar troca para uma sala local, onde o personagem pode andar e conversar com moradores.
Encostar na soleira de qualquer entrada ou saída faz a passagem automaticamente,
sem E/Enter. Na rua, o avatar retorna um pouco afastado da porta para evitar
reentrada imediata; a posição respeita o lado externo de cada edifício. Os interiores e as falas são conteúdo estático
do cliente; no centro, os comandos de treino e recompensas continuam autoritativos no
backend. Moradores fazem pequenos movimentos de espera.
O mapa do Benfica também inclui um estádio visível e um lago decorativo.
Moradores e edifícios são conteúdo estático do mapa com IDs estáveis.
O Benfica usa 72×84 tiles, incluindo a trilha isolada do Centro de Recuperação ao sul. O estádio fica no sudeste, no fim da rota dos
desafiantes: Nilo → Cora → Davi → Bia → Rui → Sol → Teca → Zeca. A distância de cada
desafiante ao estádio diminui conforme a dificuldade aumenta. Interiores possuem
plantas, móveis, cores e posições de moradores diferentes. Os moradores apresentam
progressivamente o professor Dimas (antigo professor de educação física, conhecido
pelo cronômetro) e os cinco rivais do estádio: Íris, Tito, Lia, Ivo e Mara, em duelos individuais. Essas falas são apresentação estática; a escalação
da partida continua vindo do backend.

## 12.3 Revanche

O jogador MAY desafiar novamente.

A revanche:

- concede XP reduzido;
- não deve duplicar recrutamento;
- não pode duplicar recompensas únicas.

---

# 13. Recrutamento

## 13.1 Regra inicial

Ao vencer um desafiante recrutável pela primeira vez:

```text
recruitmentStatus = AVAILABLE
```

O jogador pode então escolher:

```text
CONVIDAR PARA O TIME
```

No M5, o jogador recrutado começa no nível do desafiante, com XP e histórico zerados.
O convite aparece no resultado da partida e na tela Equipe. Ao confirmar o recrutamento,
o jogador passa a vestir as cores do time e desaparece do mapa, incluindo colisão e
interação. O cliente deriva a presença do NPC do elenco retornado pelo servidor,
usando `playerDefinitionId`; reload mantém essa ausência. Vencer sem convidar mantém
o desafiante disponível no mapa para novas conversas e revanches. Vitórias válidas anteriores
do M4 são reconhecidas pela V7 quando há progresso e recompensa persistida; partidas
legadas sem recompensa não desbloqueiam recrutamento retroativamente.

## 13.2 Persistência

Recrutamento MUST ser idempotente.

Uma mesma definição de jogador não pode ocupar duas vagas para o mesmo perfil.
Recontratar um dispensado reativa o mesmo OwnedPlayer e preserva seu progresso.

Constraint recomendada:

```text
UNIQUE(profile_id, player_definition_id)
```

## 13.3 Elenco

O elenco ativo MUST ter no máximo cinco jogadores, incluindo o starter.
Com cinco, um convite novo retorna `409 ROSTER_FULL`, sem consumir a disponibilidade.
Retries de uma contratação já confirmada continuam retornando a mesma identidade,
mesmo com o time cheio. Comandos por perfil são serializados; a V24 também protege
inserções e reativações no banco. Saves antigos com mais de cinco são preservados,
mas não podem contratar até dispensar atletas e deixar menos de cinco ativos.

A tela Equipe mostra contagem de vagas (n/5), elenco, atributos, dispensa, convites e conquistas, sem slots de posição
ou editor de escalação. Todas as novas partidas usam um atleta por lado, escolhido
antes de cada duelo.

## 13.4 Dispensa

Pelo menu Equipe, disponível durante a exploração da rua e dos interiores (botão
ou T), o treinador pode dispensar qualquer atleta, inclusive o starter ou o último.
A ação pede confirmação e libera uma vaga. O atleta vira um desafiante exclusivo
daquela jornada na posição do treinador no mapa principal; dentro de um prédio,
fica do lado de fora, na posição de entrada mantida no bairro. Essa localização é
persistida no servidor e reaparece após reload; o spawn estático anterior permanece
oculto somente para esse perfil. Ao ser recontratado, ele desaparece do mapa.

OwnedPlayer é preservado com `roster_active = false`: nível, XP, histórico, treino,
cansaço e referências de partidas não são apagados. O duelo contra o dispensado
usa seu nível e atributos treinados, com o cansaço recuperado pelo relógio do backend.
Ele não pode ser usado como atleta próprio para novos duelos, estádios, treinos ou
lineup. Sua posição na lineup legada é removida na mesma transação.

O convite passa a `AVAILABLE` sem exigir nova vitória, permitindo recuperar um elenco
vazio. O banco distingue essa origem com `recruitment_by_dismissal`, sem inventar
vitórias nem alterar regras de XP. Desafiantes globais continuam disponíveis para
outros perfis na posição original. Starters dispensados recebem um challenger privado.
O histórico de partidas, treinos e tentativas de estádio permanece válido.

`POST /roster/{id}/dismiss` exige `Idempotency-Key: UUID`; o recibo durável precede
validações mutáveis. Repetir uma dispensa antiga após recontratar devolve o recibo
sem dispensar novamente; trocar atleta ou posição com a mesma chave recebe conflito.
Posições aceitam apenas o mapa atual Benfica e coordenadas finitas dentro dos limites.
A posição é apresentação geométrica; o cliente nunca define nível ou atributos.
Falhas fazem rollback de toda a operação. Ver ADR-0015.

---

# 14. Elenco e seleção individual

O elenco ativo contém de zero a cinco atletas. Antes de cada duelo de rua ou estádio, o jogador
escolhe um único OwnedPlayer. Pode usar o mesmo atleta nos cinco jogos do estádio ou
trocar entre duelos. Roles continuam descrevendo os atletas, sem posições simultâneas
ou bônus de composição em partidas. Não há distribuição de atletas por posições na
tela Equipe. A API e a persistência legadas de lineup são mantidas por compatibilidade,
sem uso pela interface ou influência nas novas partidas.

# 15. Estádios e troféus

## 15.1 Hierarquia conceitual

Tipos:

```text
NEIGHBORHOOD
CITY
STATE
REGION
CONTINENT
WORLD
```

MVP implementa somente `NEIGHBORHOOD`.

## 15.2 Stadium

Campos conceituais:

```text
id
name
type
mapId
spawnKey
difficulty
enabled
```

## 15.3 Requisitos

Requisitos devem ser data-driven.

Exemplo futuro:

```text
Fortaleza Stadium
requires:
- Benfica Trophy
- Aldeota Trophy
- Papicu Trophy
```

Não escrever cadeia de `if` hardcoded por estádio.

## 15.4 Acesso

Antes de iniciar partida:

- perfil deve possuir pelo menos cinco atletas, sem exigir lineup ou usar todos em cada duelo;
- atleta escolhido deve pertencer ao perfil da sessão;
- requisitos devem estar atendidos;
- estádio não pode já estar concluído;
- perfil deve ter acesso à área.

Backend MUST validar tudo.
Ao conversar com Dimas, um elenco menor que cinco recebe uma recusa explícita antes de abrir a seleção. O POST também rejeita com `409 STADIUM_ROSTER_INCOMPLETE`, antes de criar partida ou tentativa; retries já confirmados continuam precedendo as verificações mutáveis.

## 15.5 Sequência e troféu

Cada treinador possui exatamente cinco jogadores. O backend ordena por nível e soma
dos cinco atributos efetivos, com ID estável para desempatar; o mais forte fica por último.
O início da tentativa persiste esses snapshots para manter a ordem após reload.

Cada partida é 1x1. Vitória avança para o próximo adversário. Uma derrota encerra
imediatamente a tentativa; o próximo comando válido cria outra, desde o primeiro rival.
Somente cinco vitórias consecutivas na mesma tentativa concedem o troféu.
Empate regulamentar tem desempate determinístico por pênaltis no estádio.

Cada duelo aplica XP/histórico somente ao atleta que participou. XP decai pelo número
de duelos já disputados no estádio. Partida, avanço, XP e eventual troféu são transacionais.
Uma tentativa ativa pode ser retomada ao sair/entrar ou recarregar.

## 15.6 Repetição

Depois do troféu conquistado:

```text
POST /stadiums/{id}/matches
```

MUST rejeitar nova tentativa no MVP.

O frontend deve mostrar o estádio como conquistado.

---

# 16. Match Engine

## 16.1 Regra central

O Match Engine é o coração do produto.

Ele MUST ser:

- determinístico por seed;
- independente de framework;
- testável;
- versionado;
- rápido;
- capaz de gerar eventos narrativos.

## 16.2 Contrato conceitual

```kotlin
interface MatchEngine {
    fun simulate(request: MatchRequest): MatchResult
}
```

```text
MatchRequest
- mode
- home
- away
- seed
- engineVersion
```

```text
MatchResult
- homeScore
- awayScore
- outcome
- events
- statistics
- seed
- engineVersion
```

## 16.3 Modos

```text
DUEL_1V1
STADIUM_1V1
```

Novos jogos sempre possuem um participante por lado. O modo histórico `STADIUM_5V5` v2 é preservado somente para ler registros antigos; nenhum endpoint cria partidas nesse modo.

## 16.4 Primitivas

Exemplos:

```text
possession
dribble
tackle
shot
shot_on_target
shot_off_target
save
goal
turnover
foul (future)
```

## 16.5 Probabilidades

Evitar regras do tipo:

```text
if dribbling > defending then always success
```

Usar probabilidade suavizada.

Função conceitual recomendada:

```text
probability =
sigmoid((attackScore - defenseScore) / scale)
```

Ou uma função equivalente limitada.

Exemplo de score de drible:

```text
attackScore =
0.55 * dribbling +
0.25 * speed +
0.20 * physical

defenseScore =
0.60 * defending +
0.20 * speed +
0.20 * physical
```

Os pesos são parâmetros de balanceamento.

O Match Engine MUST evitar chance exata 0% ou 100% em situações normais.

## 16.6 1x1

Modelo sugerido:

1. determinar posse inicial pela seed;
2. executar uma sequência limitada de posses;
3. em cada posse:
   - gerar aproximação;
   - resolver duelo;
   - se atacante vencer, resolver chute;
   - se defender vencer, trocar posse;
4. avançar relógio virtual;
5. terminar após limite de tempo/eventos.

Duração visual alvo:

```text
20–45 segundos reais
```

O backend MAY simular tudo em milissegundos.

## 16.7 Duelo de estádio

`STADIUM_1V1` v3 usa a simulação regulamentar do duelo v1 e acrescenta pênaltis
determinísticos quando necessário. Sempre há um vencedor. Os pênaltis são eventos
separados de `GOAL` e não mudam o placar regulamentar.

## 16.8 Compatibilidade histórica

O modo 5x5 v2 permanece apenas nos registros históricos; seu simulador foi removido.

## 16.9 Empate

Desafio 1x1:

- empate é permitido;
- empate concede pouco XP;
- não libera recrutamento.

Estádio:

- empate deve disparar desempate determinístico;
- preferência MVP: `penalty shootout` abstrato;
- resultado final do estádio sempre deve ter vencedor.

## 16.10 Eventos

Formato conceitual:

```json
{
  "sequence": 14,
  "minute": 7,
  "type": "SHOT_MISSED",
  "actorPlayerId": "p_12",
  "targetPlayerId": null,
  "metadata": {
    "zone": "RIGHT"
  }
}
```

O backend SHOULD enviar eventos estruturados, não apenas texto pronto.

O frontend monta a mensagem localizada:

```text
"Juninho chutou para fora!"
```

Isso facilita idioma, animação e mudança de copy.

Eventos MAY carregar `messageKey`:

```text
match.shot.missed
```

## 16.11 Seed

Cada partida MUST armazenar:

```text
seed
engineVersion
```

A mesma entrada + seed + engineVersion MUST produzir o mesmo resultado.

Não usar relógio atual como fonte adicional de aleatoriedade depois que a seed foi definida.

## 16.12 Engine version

Começar com:

```text
engineVersion = "1"
```

Quando uma mudança quebrar reprodutibilidade histórica:

```text
engineVersion = "2"
```

Não é necessário manter engines antigos executáveis para sempre no MVP, mas a versão deve ser registrada para depuração.

---

# 17. Partida: fluxo transacional

## 17.1 Desafio de rua

Comando:

```text
POST /api/v1/challenges/{challengerId}/matches
```

Passos de backend:

```text
1. obter profile da sessão
2. validar challenger
3. validar OwnedPlayer
4. validar ownership
5. validar disponibilidade
6. reservar/validar idempotency key
7. gerar seed
8. carregar snapshots de stats
9. simular MatchEngine
10. calcular XP
11. atualizar OwnedPlayer
12. atualizar ChallengerProgress
13. liberar recruitment quando aplicável
14. persistir Match
15. commit
16. retornar MatchResult + Rewards
```

Se qualquer passo persistente falhar:

```text
rollback
```

## 17.2 Estádio

- obter o perfil sob lock;
- recuperar comando idempotente antes das validações mutáveis;
- validar acesso, requisitos, ausência de troféu e ownership do atleta;
- validar `seriesId` e `roundNumber` contra a última tentativa;
- iniciar tentativa se a anterior terminou, salvando os cinco oponentes ordenados;
- simular um duelo com o próximo adversário;
- persistir partida, XP/histórico individual e avanço/derrota;
- na quinta vitória consecutiva, conceder troféu;
- commit e devolver resultado com progresso da tentativa.

Comando de tela desatualizada recebe `STADIUM_SEQUENCE_CHANGED`; uma chave repetida
recupera o resultado original sem reaplicar qualquer efeito.

---

# 18. Idempotência

Problema:

```text
cliente envia POST
backend conclui
resposta se perde
cliente repete POST
```

Sem idempotência, o usuário poderia receber:

- dois matches;
- XP duplicado;
- dois level-ups;
- recompensas duplicadas.

## 18.1 Regra

Endpoints que criam partida MUST aceitar:

```text
Idempotency-Key: UUID
```

O mesmo usuário + mesma key:

- MUST retornar semanticamente o mesmo resultado;
- MUST NOT executar recompensas novamente.

Uma constraint no banco SHOULD garantir unicidade.

---

# 19. Modelo de dados

Nomes finais podem ser ajustados, mas os conceitos abaixo devem permanecer.

## 19.1 app_user

Para fase com autenticação.

```text
id UUID PK
email
password_hash
created_at
updated_at
```

No primeiro milestone local, autenticação MAY ser adiada usando perfil seed de desenvolvimento.

Código de produção não deve aceitar identidade arbitrária fornecida pelo cliente.

## 19.2 game_profile

```text
id UUID PK
user_id UUID UNIQUE
display_name
starter_selected BOOLEAN
primary_color #RRGGBB
secondary_color #RRGGBB
current_map_id
current_spawn_key
created_at
updated_at
version
```

## 19.3 player_definition

```text
id VARCHAR PK
name
archetype
preferred_role
rarity

speed
dribbling
finishing
defending
physical

recruitable
enabled
```

Opcionalmente growth modifiers podem ser colunas ou JSONB pequeno.

Preferir colunas quando consultadas e validadas frequentemente.

## 19.4 owned_player

```text
id UUID PK
profile_id UUID FK
player_definition_id VARCHAR FK
level
xp
wins
draws
losses
recruited_at
version

UNIQUE(profile_id, player_definition_id)
```

## 19.5 challenger

```text
id UUID PK
player_definition_id VARCHAR FK
map_id
spawn_key
difficulty
enabled
```

## 19.6 challenger_progress

```text
profile_id UUID FK
challenger_id UUID FK
attempts
wins
draws
losses
recruitment_status
last_played_at

PK(profile_id, challenger_id)
```

Status:

```text
LOCKED
AVAILABLE
RECRUITED
```

Ou modelagem equivalente sem estado redundante.

## 19.7 user_lineup (legado)

Persistência mantida por compatibilidade, sem editor na interface:

```text
profile_id
slot_index 1..5
owned_player_id

PK(profile_id, slot_index)
UNIQUE(profile_id, owned_player_id)
```

Backend MUST validar ownership.

## 19.8 stadium

```text
id VARCHAR PK
name
type
map_id
spawn_key
difficulty
trophy_id
enabled
```

## 19.9 stadium_requirement

```text
stadium_id
required_trophy_id

PK(stadium_id, required_trophy_id)
```

## 19.10 stadium_opponent_player

```text
stadium_id
slot_index
player_definition_id
level

PK(stadium_id, slot_index)
```

## 19.11 trophy_definition

```text
id VARCHAR PK
name
description
```

## 19.12 user_trophy

```text
profile_id
trophy_id
won_at
match_id

PK(profile_id, trophy_id)
```

## 19.13 match

```text
id UUID PK
profile_id UUID FK
mode
source_type
source_id
home_score
away_score
outcome
seed BIGINT
engine_version
events JSONB
statistics JSONB
rewards JSONB
idempotency_key
created_at

UNIQUE(profile_id, idempotency_key)
```

Guardar eventos em JSONB no MVP é aceitável.

Não criar tabela `match_event` sem necessidade concreta de consulta analítica por evento.

---

# 20. API REST

Contrato inicial.

## 20.1 Bootstrap

```http
GET /api/v1/game/bootstrap
```

Objetivo:

retornar dados mínimos para entrar no jogo:

```json
{
  "profile": {},
  "currentMap": {},
  "roster": [],
  "lineup": [],
  "trophies": [],
  "availableStadiums": []
}
```

Evitar transformar bootstrap em payload gigantesco.

## 20.2 Criar perfil

```http
POST /api/v1/profiles
```

```json
{
  "displayName": "Denis",
  "primaryColor": "#2266aa",
  "secondaryColor": "#dd3344"
}
```

Cores aceitam exatamente `#RRGGBB`, são normalizadas para minúsculas e aparecem nas
respostas de criação e de `GET /api/v1/profile`. API e banco validam o formato.
Para compatibilidade com clientes anteriores, omitir as cores usa `#f7d154` e
`#24354a`. A interface sempre oferece a escolha antes de criar o perfil.

### Nova jornada

`POST /api/v1/profile/new-game` recebe o mesmo corpo de criação e exige
`Idempotency-Key: UUID`. Cria um novo perfil e o associa à sessão, sem apagar o
perfil e as partidas anteriores. Durante a mesma sessão, retry do último comando
retorna o mesmo perfil; reutilizar a chave com outro corpo recebe
`409 IDEMPOTENCY_CONFLICT`. O comando é serializado na sessão do servidor.
O endpoint legado `/profiles` mantém seu contrato. A nova jornada é criada após
Miguel confirmar as cores, para evitar um perfil incompleto antes da formatura.

## 20.3 Starters

```http
GET /api/v1/starters
POST /api/v1/profile/starter
```

Request:

```json
{
  "playerDefinitionId": "starter_dribbler"
}
```

Selecionar starter MUST ser idempotente no sentido de não conceder múltiplos jogadores.

Depois de definido, não alterar no MVP.

## 20.4 Estado do mapa

```http
GET /api/v1/maps/{mapId}/state
```

Pode retornar:

```json
{
  "challengers": [
    {
      "id": "...",
      "spawnKey": "benfica.court.01",
      "status": "AVAILABLE"
    }
  ],
  "stadiums": [
    {
      "id": "benfica_stadium",
      "spawnKey": "benfica.stadium.entry",
      "status": "LOCKED"
    }
  ]
}
```

## 20.5 Checkpoint de posição

```http
PUT /api/v1/profile/checkpoint
```

Preferir semântica de checkpoint:

```json
{
  "mapId": "benfica",
  "spawnKey": "benfica.street.04"
}
```

Não persistir cada pixel.

Se for necessário restaurar posição fina no mapa, MAY guardar `x/y`, mas checkpoints estáveis são preferíveis.

## 20.6 Elenco

```http
GET /api/v1/roster
POST /api/v1/roster/{id}/dismiss
GET /api/v1/maps/{mapId}/released-players
```

Dispensa: `Idempotency-Key: UUID`, corpo `{ "mapId": "benfica", "x": 704, "y": 640 }`.
Retorna `{ ownedPlayerId, challengerId, mapId, x, y }`. A listagem de dispensados é
privada da sessão e retorna `{ id, playerDefinitionId, name, level, mapId, x, y }`.
GET roster lista somente atletas ativos.

## 20.7 Lineup (API legada)

Mantida por compatibilidade. A tela Equipe não consulta nem salva escalações e os
duelos não usam esse contrato.

```http
GET /api/v1/lineup
PUT /api/v1/lineup
```

Request:

O M5 aceita sempre cinco posições ordenadas, com `null` para slots vazios enquanto o
elenco é montado. GET e PUT retornam o mesmo formato. IDs não nulos devem ser distintos
e pertencer à sessão. PUT substitui tudo atomicamente; slots ocupados ficam em `user_lineup`.

```json
{
  "ownedPlayerIds": [
    "...",
    "...",
    "...",
    "...",
    null
  ]
}
```

## 20.8 Challenge info

```http
GET /api/v1/challenges/{id}
```

Retorna dados visíveis do oponente, histórico, possível recompensa e `rosterFull`.
Para dispensados, usa o nível preservado e permite convite imediato.

## 20.9 Iniciar duelo

```http
POST /api/v1/challenges/{id}/matches
Idempotency-Key: <uuid>
```

```json
{
  "ownedPlayerId": "..."
}
```

Response exemplo:

```json
{
  "match": {
    "id": "...",
    "mode": "DUEL_1V1",
    "homeScore": 2,
    "awayScore": 1,
    "outcome": "WIN",
    "seed": 183771,
    "engineVersion": "1",
    "events": []
  },
  "rewards": {
    "xpAwarded": 92,
    "previousLevel": 3,
    "currentLevel": 4,
    "recruitmentUnlocked": true
  }
}
```

## 20.10 Recrutar

```http
POST /api/v1/challenges/{id}/recruit
```

Deve:

- validar status;
- ser idempotente;
- exigir uma vaga para novo atleta ou reativação;
- criar OwnedPlayer uma única vez ou reativar o dispensado;
- marcar recrutamento concluído.

No M5, a idempotência é natural por perfil da sessão + desafiante, sem chave adicional.
A resposta estável contém `challengerId` e `ownedPlayerId`. Repetir o convite não reaplica
XP ou nível. O lock de perfil serializa partidas, recrutamento e substituição do lineup.

## 20.11 Estádios

```http
GET /api/v1/stadiums
GET /api/v1/stadiums/{id}
```

## 20.12 Iniciar estádio

```http
POST /api/v1/stadiums/{id}/matches
Idempotency-Key: <uuid>
```

Corpo obrigatório:

```json
{
  "ownedPlayerId": "...",
  "seriesId": null,
  "roundNumber": 1
}
```

`GET /stadiums/{id}` retorna `opponentLineup` na ordem dos cinco duelos e `series`
com `id`, `played`, `wins`, `finished`, ou `null` antes da primeira tentativa.
Os status são `AVAILABLE`, `LOCKED` e `COMPLETED`, sem requisito de lineup.
O POST envia o ID da última tentativa consultada; após derrota, `roundNumber` volta
a 1 e o servidor cria um novo ID. Em tentativa ativa, a rodada é `played + 1`.

Resposta: `match.mode = STADIUM_1V1`, um participante por lado,
`match.penalties` apenas no desempate e `outcome` WIN/LOSS.
`rewards.players` possui somente o atleta que jogou; `rewards.series` informa
o avanço; `rewards.trophy` só existe na quinta vitória consecutiva.
Retry com a chave original precede validações de disponibilidade; chave nova após
conquista retorna `STADIUM_ALREADY_COMPLETED`.
Ver `docs/decisions/ADR-0008-stadium-duel-series.md`.

## 20.13 Histórico

MAY:

```http
GET /api/v1/matches?limit=20
GET /api/v1/matches/{id}
```

Não é bloqueador do primeiro milestone.

## 20.14 Recuperação

`POST /api/v1/recovery/sessions` exige `Idempotency-Key: UUID` e recebe
`{ "ownedPlayerId": "UUID", "stationId": "benfica.recovery.bed.01" }`.
Stations oficiais: `benfica.recovery.bed.01` a `.03`, `benfica.recovery.ice.01` e `.02`.
Método, taxa, cansaço e horários são derivados pelo backend. Resposta:
`{ session: { id, ownedPlayerId, stationId, method, startedAt, completesAt, cancelledAt }, fatigue, policyVersion }`.

`POST /api/v1/recovery/sessions/{id}/cancel` exige a mesma forma de chave de idempotência,
corpo vazio e posse do tratamento pela sessão. Devolve o mesmo formato, com `cancelledAt`.
Chaves repetidas devolvem o recibo original; mudar ação, atleta, estação ou tratamento
com uma mesma chave retorna `409 IDEMPOTENCY_CONFLICT`. Retry de interrupção antiga nunca
interrompe um tratamento novo.

`GET /roster` acrescenta `recovery: { sessionId, stationId, method, completesAt }` durante
tratamento ativo e `null` ao terminar. As previsões em `fatigue` usam a taxa ativa.
Erros de domínio: `PLAYER_RECOVERING`, `PLAYER_ALREADY_RESTED`,
`RECOVERY_STATION_OCCUPIED`, `RECOVERY_SESSION_CHANGED` (409), estações/tratamentos
inexistentes (404), posse de atleta alheio (403). IDs e corpo inválidos recebem 400.
A ampliação do mapa permite posições de dispensa no Benfica até y=2672;
checkpoints cosméticos antigos continuam válidos.

---

# 21. Formato de erro

MUST ser consistente.

Exemplo:

```json
{
  "code": "STADIUM_REQUIREMENT_NOT_MET",
  "message": "Você ainda não pode entrar neste estádio.",
  "details": {
    "missingTrophies": ["..."]
  },
  "traceId": "..."
}
```

Códigos de domínio sugeridos:

```text
PROFILE_NOT_FOUND
STARTER_ALREADY_SELECTED
OWNED_PLAYER_NOT_FOUND
PLAYER_NOT_OWNED
CHALLENGER_NOT_AVAILABLE
RECRUITMENT_NOT_AVAILABLE
PLAYER_ALREADY_RECRUITED
LINEUP_INCOMPLETE
STADIUM_LOCKED
STADIUM_ALREADY_COMPLETED
IDEMPOTENCY_CONFLICT
```

Frontend deve mapear `code` para mensagem amigável quando necessário.

---

# 22. Frontend: scenes

Scenes sugeridas:

```text
BootScene
PreloadScene
MainMenuScene
GraduationScene
WorldScene
TeamScene
MatchScene
StadiumMatchScene (pode compartilhar base com MatchScene)
```

Evitar scene por detalhe pequeno.

## 22.1 BootScene

- config;
- health/bootstrap mínimo;
- direcionar fluxo.

## 22.2 PreloadScene

- tiles;
- spritesheets;
- fontes;
- áudio.

### Menu e formatura

O menu sempre aparece ao abrir o cliente, com uma quadra de futebol vista de cima
em estilo pixelado ao fundo e o título Rua 5 centralizado. INICIAR começa a cerimônia de uma nova
jornada; CONTINUAR só é habilitado quando a sessão tem um perfil recuperável;
OPÇÕES permanece desabilitado. A consulta de save e a retomada oferecem retry.
A graduação tem dezoito colegas sentados, reitor idoso, entrega animada do canudo,
campo de nome (1–40 caracteres após trim) e falas sobre exploração, duelos,
convites, treinamento, cansaço, cinco atletas e a sequência do estádio.
Só após terminar as falas o avatar pode caminhar até a saída, usando teclado ou
direcional de toque. Miguel se aproxima automaticamente na rua e encaminha a
escolha das cores e dos três starters. Depois da confirmação do servidor, Miguel
parabeniza a escolha e comenta os pontos fortes daquele atleta, explica o menu
Equipe/Elenco (T), o ganho de XP e nível nos desafios e o treino de fundamentos
sem XP. Oferece acompanhar o treinador numa caminhada automática até a academia,
por um trajeto que respeita as colisões. O passeio é opcional; ao chegar, Miguel
apresenta os cinco setores e permite entrar ou continuar explorando. Durante o
passeio não há encontros nem comandos de progresso, e girar o celular para a
vertical pausa a caminhada. O avatar de treinador permanece o mesmo
nos interiores, no bairro e após retomar a jornada; cartões e partidas mostram
os atletas escolhidos.

## 22.3 WorldScene

Responsável por:

- carregar tilemap;
- personagem;
- colisões;
- câmera;
- interações;
- NPCs;
- entrada de estádio.

Não deve conter regras de XP ou simulação.

O minimapa fixo do Benfica mostra a posição atual do treinador, as ruas e três
pontos com legenda: E (estádio), T (centro de treinamento) e R (centro de recuperação).
Ele aparece no canto superior direito do desktop e abaixo do direcional no celular,
fora dos alvos de toque. É ocultado em diálogos, seleções e outras scenes e volta
quando a exploração é retomada. Não concede transporte ou acesso à distância.

Pessoas distintas têm nomes distintos no bairro, nos interiores e nos setores de
treino. Os IDs de conteúdo são preservados. A V26 renomeia somente a dribladora
`npc_iris_01` para Estela; Íris permanece a defensora do estádio. Snapshots históricos
continuam com os nomes originais. Moradores têm estilos de roupa, pele, cabelo,
barba e acessórios variados; atletas conservam sua identidade visual no mapa,
cartões e duelos, mudando a roupa apenas ao serem recrutados.

### Controles no navegador do celular

Somente celulares (entrada por toque e menor dimensão da tela até 600 CSS pixels)
exibem controles de toque e layout próprio. Reduzir a janela do PC não ativa esses
controles; o desktop mantém setas/WASD, E/Enter, Esc e T.
No celular, jogar requer orientação horizontal. Na vertical, uma tela orienta girar
o aparelho e o movimento fica interrompido. Tela cheia é opcional quando disponível.
O direcional à esquerda aceita toque contínuo, arraste e diagonais, com a mesma
velocidade normalizada e colisões do teclado. À direita, a ação muda conforme o
contexto: conversar, entrar, continuar, desafiar ou treinar; há também fechar/voltar
e acesso à equipe no bairro. Nos interiores, sair está disponível por toque.
Os controles ocupam faixas laterais fora do canvas; menus e partidas usam a área
completa e seus botões existentes. Diálogos usam texto DOM legível no celular.
Seleções de atletas, treino e estádio usam cartões compactos no celular. O duelo
adapta quadra e placar à altura disponível; no resultado, recompensas e ações ficam
ao lado da quadra. Ações principais permanecem visíveis, sem rolar o painel nas
telas horizontais comuns. Elencos extensos podem rolar somente a lista de atletas;
conteúdo excepcional mantém rolagem acessível. O layout do PC é preservado.
Os alvos de toque têm pelo menos 44×44 CSS pixels, respeitam áreas seguras e aceitam
dedos independentes. Soltar/cancelar o toque, perder foco, girar o aparelho ou trocar
de scene limpa o movimento; abrir diálogo ou seleção bloqueia a locomoção.
Não há dependência adicional, aplicativo nativo ou mudança de autoridade do backend.
O smoke `frontend/e2e/mobile.spec.ts` cobre toque real em navegador emulado, rotação,
ausência dos controles no PC, diálogo/duelo real e acesso à academia/estádio.

## 22.4 TeamScene

- roster;
- stats;
- level;
- arquétipo;
- consulta dos atributos de um atleta selecionado;
- convites de recrutamento e bloqueio quando o elenco tem cinco;
- dispensa confirmada do atleta selecionado;
- conquistas;
- sem slots de posição ou botão de salvar escalação.

## 22.5 MatchScene

Recebe um `MatchResult`.

Ela não calcula o resultado.

Ela:

```text
event 1
wait
render
event 2
wait
render
...
```

Deve permitir:

- velocidade normal;
- acelerar;
- pular para resultado final.

Isso melhora UX e testes.

---

# 23. Frontend: API e estado

Criar uma camada de API isolada:

```text
src/api/gameApi.ts
src/api/types.ts
```

Scenes não devem montar URLs espalhadas.

Preferir DTOs explícitos.

O estado cliente é cache da verdade do backend.

Após comandos importantes:

- aplicar response autoritativa;
- ou invalidar/recarregar dado afetado.

Não inventar state management global pesado no MVP.

Um store simples MAY ser suficiente.

---

# 24. Persistência e save

O save de progresso principal fica no PostgreSQL. CONTINUAR consulta o perfil da
sessão, restaura elenco/XP/recrutamentos/troféus pelos endpoints autoritativos e
retoma a posição geométrica local associada ao `profileId`. Esse checkpoint
cosmético registra rua ou interior e é atualizado a cada 500 ms, ao suspender a
scene e ao ocultar/sair da página. Conteúdo inválido ou localização desconhecida
é descartado. Ele não guarda estatísticas ou recompensas e não autoriza partidas.
Sem checkpoint local, a retomada começa na entrada do bairro; uma jornada ainda
sem starter retorna ao encontro com Miguel. A formatura antes da confirmação das
cores ainda não tem save. INICIAR usa novo perfil, sem copiar progresso.

A identidade ainda depende da sessão HTTP local, que não sobrevive ao reinício do
backend. Retomada entre dispositivos ou reinícios do servidor exige a futura
identidade persistente/autenticação; esta entrega não inventa conta ou token de save.

IndexedDB/localStorage MAY ser usado para:

- volume;
- preferências visuais;
- última configuração de controles;
- cache;
- dados não autoritativos.

Não usar armazenamento local como fonte única de:

- XP;
- level;
- troféu;
- elenco.

---

# 25. Autenticação

## 25.1 Estratégia incremental

Para desenvolvimento inicial:

- um profile seed MAY ser utilizado somente em ambiente `dev`.

Antes de publicação pública:

- autenticação MUST existir.

## 25.2 Estratégia recomendada

Aplicação web same-origin ou com proxy:

- Spring Security;
- sessão;
- cookie `HttpOnly`;
- `Secure` em produção;
- `SameSite` apropriado;
- proteção CSRF conforme estratégia.

JWT não é obrigatório.

Não adicionar refresh token/JWT apenas por moda.

## 25.3 Ownership

Nunca receber:

```text
userId
profileId
```

do cliente e confiar neles para autorização.

O backend deriva identidade da sessão.

---

# 26. Concorrência

Apesar de single-player, podem existir:

- duas abas;
- retries;
- double-click;
- reconexões.

Usar:

- idempotência;
- constraints;
- transações;
- optimistic locking onde adequado.

Campos `version` em entidades mutáveis críticas são recomendados.

Não implementar locks distribuídos.

---

# 27. Transações

Uma partida e seus efeitos formam uma unidade lógica.

Exemplo:

```text
Match
+ XP
+ level up
+ challenger progress
+ recruitment unlock
```

Ou:

```text
Match
+ XP
+ trophy
```

Não deixar estado parcialmente persistido.

O Application Service deve controlar a transação.

O `MatchEngine` permanece puro.

---

# 28. Conteúdo inicial

## 28.1 Starters

Os starters iniciais são:

```text
Cabeleira
Aderlou
Loraco
```

Eles são placeholders e podem ser substituídos.

### Cabeleira — Armador veloz

```text
speed      74
dribbling  70
finishing  58
defending  48
physical   52
```

Visual: cabelo marrom e bigode.

### Loraco — Finalizador veloz

```text
speed      72
dribbling  61
finishing  81
defending  39
physical   62
```

Visual: cabelo loiro.

### Aderlou — Defensor

```text
speed      58
dribbling  62
finishing  55
defending  78
physical   66

Visual: cabelo preto.
```

Balanceamento é provisório.

## 28.2 Progressão de NPCs

Exemplo:

```text
NPC 1–3: level 1–2
NPC 4–6: level 2–4
NPC 7–9: level 4–6
NPC raro: level 6–7
Estádio: média equivalente a level 6–8
```

O primeiro NPC, Nilo, permanece no nível 1 com stats speed 40, dribbling 40,
é aproximadamente 70%–80% de vitórias com qualquer starter no nível 1 (Aderlou, por
sua defesa, fica perto de 82%), sem garantia de vitória.

O bairro deve conduzir naturalmente até o estádio.

Após o ajuste V11, os níveis dos oito desafiantes do Benfica são: Nilo 1, Cora 1,
Davi 1, Bia 2, Rui 2, Sol 3, Teca 4 e Zeca 5. Cora, Davi e Bia têm atributos
iniciais menores; V12 reduz um pouco mais a finalização de Davi para equilibrar o
segundo duelo com todos os starters. A mudança vale apenas para novos snapshots de partidas e para
recrutamentos futuros; histórico e atletas já recrutados preservam seus valores.

---

# 29. UX da partida

## 29.1 Tela

O duelo 1x1 usa apresentação de RPG com uma simulação visual dirigida pelos eventos
autoritativos: os atletas percorrem diferentes faixas da quadra, a bola acompanha quem
tem a posse e dribles, desarmes, chutes, defesas e gols recebem coreografias próprias.
Essa encenação não recalcula física, resultado ou placar. O placar atual fica em destaque
e há **apenas um lance por vez, em uma única linha**. A fala do NPC abre automaticamente
ao se aproximar; iniciar o desafio continua sendo uma ação explícita.
O desafiante MUST conservar na seleção, no duelo e nas poses finais o mesmo corpo, pele,
cabelo e uniforme original com que aparece no mapa. Se recrutado, conserva corpo, pele e
cabelo e troca somente a roupa pelas cores do time do perfil.

```text
┌─────────────────────────────────────────┐
│ LEO · Nv. 2       1 × 0     NILO · Nv. 1│
│                                         │
│        jogador     VS     adversário    │
│                                         │
│  07' Cabeleira passou pelo marcador!     │
│          [ACELERAR] [PULAR]              │
└─────────────────────────────────────────┘
```

Cada evento da API carrega `homeScore` e `awayScore` correspondentes àquele instante,
derivados no backend dos eventos persistidos. O cliente só os apresenta durante o playback.
O resultado final e as recompensas continuam vindo do backend.

No gol, o autor levanta os braços e sorri. O lance fica em exibição por 1,8 segundos
na velocidade normal e ao menos 0,9 segundos ao acelerar, inclusive no último gol.
Pular leva diretamente ao resultado. No fim, o vencedor fica feliz e o perdedor
cabisbaixo; empate mantém poses neutras.

Entrar no estádio abre um interior explorável com o avatar junto à entrada. O jogador
caminha até Dimas e conversa para abrir a seleção de um atleta e iniciar o próximo duelo.
Torcedores da casa apoiam os atletas de Dimas e torcem contra o visitante; suas falas
não iniciam partidas ou concedem recompensas.

O playback mostra somente dois atletas na quadra. Ao redor há avatares de torcedores
maiores, com rostos, uniformes e animações de braços, bandeiras e faixas nas cores
vermelho/creme do estádio. A torcida ocupa arquibancadas separadas nos quatro lados;
nem torcedores nem acessórios podem sobrepor a superfície de jogo, inclusive em telas
estreitas. Dimas não aparece durante o desafio.

Ao terminar cada duelo, a quadra é substituída pela tela de conversa com o retrato de
Dimas. Na vitória, ele elogia o desempenho e apresenta pelo nome o próximo adversário
retornado pelo backend; antes do quinto duelo, avisa que é seu melhor atleta. Confirmar
“Próximo adversário” abre a escolha do jogador do usuário; iniciar corta para a quadra
com esses dois atletas. Na derrota, explica que será preciso recomeçar. A conversa
mostra placar, XP e avanço autoritativos. Só a quinta vitória entrega a taça, visível em
Conquistas após reload.
Na derrota, a interface oferece recomeçar desde o primeiro rival. Há retorno ao
interior entre duelos. Animações e comentários não alteram a simulação.

## 29.2 Timing

O backend retorna tudo imediatamente.

Frontend anima.

Não usar request por evento.

## 29.3 Feedback de atributos

Eventos devem ser coerentes com atributos, mas não previsíveis.

Jogador forte:

- maior chance;
- não garantia.

Jogador fraco:

- ainda pode surpreender.

---

# 30. Balanceamento

## 30.1 Objetivo

Evitar:

- stat único dominante;
- level tornando stats irrelevantes;
- grind infinito;
- estádio decidido quase sempre por RNG.

## 30.2 Métricas de simulação

Criar testes/benchmarks de balanceamento que executem milhares de partidas localmente.

Exemplos:

```text
mesma força vs mesma força:
win rate próximo de 50/50 (desconsiderando empate)

+10 rating equivalente:
vantagem perceptível, mas não 100%

time equilibrado vs time desequilibrado:
pequena diferença
```

Esses testes não precisam rodar em todo build se forem custosos; podem ser uma suite separada.

## 30.3 Propriedades

Testar invariantes:

- score nunca negativo;
- eventos de goal correspondem ao score;
- sequência é ordenada;
- minuto não regride;
- mesma seed reproduz resultado;
- jogador inexistente não aparece em evento;
- stats efetivos permanecem 1..99.

---

# 31. Testes

## 31.1 Backend unit

Obrigatórios:

### Progression

- XP requerido;
- level up simples;
- múltiplos levels;
- cap;
- retorno decrescente.

### Match Engine

- determinismo;
- goal/score invariant;
- empate;
- desempate no estádio;
- eventos válidos.

### Stadium rules

- quatro atletas rejeitados sem efeitos; cinco ou mais aceitos, independentemente do lineup;
- requisito ausente rejeitado;
- já vencido rejeitado;
- quinta vitória consecutiva concede trophy;
- derrota encerra tentativa e próximo duelo reinicia pelo primeiro rival;
- ordem persistida e mais forte por último;
- retry não avança outra rodada; comando desatualizado é rejeitado.

### Recruitment

- só após condição;
- não duplica jogador;
- limita o elenco a cinco sob concorrência e permite retry já confirmado;
- dispensa preserva progresso, retorna o desafiante no ponto escolhido e permite recontratar;
- valida posse, posição, privacidade, rollback e retries após recontratar.

## 31.2 Backend integration

Com PostgreSQL real via Testcontainers:

- migrations;
- repository;
- constraints;
- transaction rollback;
- idempotency;
- endpoint de duelo;
- endpoint de estádio.

## 31.3 Frontend

Unit:

- parse de API;
- playback queue;
- mapping de event -> presentation;
- seleção individual de atletas.

Smoke E2E:

```text
abrir
-> starter
-> mundo
-> challenge
-> match
-> reward
```

Não tentar testar cada animação pixel a pixel.

---

# 32. Observabilidade

MVP SHOULD ter logs estruturados suficientes para depuração.

Por partida, registrar:

```text
matchId
profileId
mode
sourceId
seed
engineVersion
homeScore
awayScore
durationMs
```

Não logar senha/token.

Incluir `traceId` em erro HTTP.

Prometheus/Grafana não são necessários inicialmente.

---

# 33. Segurança

Mesmo single-player, o cliente é não confiável.

Backend MUST:

- validar IDs;
- validar ownership;
- validar limites;
- ignorar stats enviados pelo cliente;
- calcular recompensas;
- usar query parametrizada/JPA;
- proteger autenticação;
- limitar payloads;
- não expor detalhes internos em erros de produção.

Cheat prevention absoluta não é objetivo do MVP.

Autoridade de servidor já cobre as manipulações triviais.

---

# 34. Performance

## 34.1 Frontend

Metas qualitativas:

- 60 FPS em máquina comum quando possível;
- mapa carregado por área;
- spritesheets;
- evitar imagens gigantes;
- destruir scenes/objetos desnecessários;
- não criar DOM por frame.

## 34.2 Backend

Uma partida é barata.

Target conceitual:

```text
simulação << tempo de reprodução visual
```

Não usar processamento assíncrono, fila ou worker para partidas.

## 34.3 Banco

Índices iniciais prováveis:

```text
owned_player(profile_id)
challenger_progress(profile_id)
match(profile_id, created_at)
user_trophy(profile_id)
```

Não adicionar índices especulativos demais.

---

# 35. Assets e propriedade intelectual

O projeto pode usar como referência:

- RPGs portáteis;
- pixel art;
- jogos de manager;
- futebol de rua.

Mas MUST possuir identidade própria.

Proibido copiar:

- sprites de Pokémon;
- tilesets;
- nomes;
- músicas;
- mapas;
- logos;
- diálogos;
- UI pixel-perfect de outra franquia.

Durante MVP, usar placeholders originais simples.

---

# 36. Milestones de implementação

## Milestone 0 — Scaffold

### Entregas

- monorepo;
- `frontend`;
- `backend`;
- compose Postgres;
- healthcheck;
- Flyway;
- lint/test/build básicos;
- README com execução.

### Aceite

```text
docker compose up -d postgres
backend sobe
frontend sobe
GET /health responde
migration aplica do zero
```

---

## Milestone 1 — Domínio e banco mínimo

### Entregas

- schema:
  - game_profile;
  - player_definition;
  - owned_player;
- seeds dos 3 starters;
- endpoint de profile;
- endpoint de starters;
- seleção de starter.

### Aceite

- criar profile;
- listar starters;
- escolher starter;
- OwnedPlayer criado uma vez;
- repetir comando não duplica.

---

## Milestone 2 — Mundo explorável

### Entregas

- tilemap do bairro;
- personagem;
- movimento;
- colisão;
- câmera;
- pontos de interação;
- 1 desafiante visível.

### Aceite

- abrir jogo;
- carregar mapa;
- caminhar;
- colidir;
- chegar ao NPC;
- diálogo abrir.

Ainda não precisa de partida completa.

---

## Milestone 3 — Match Engine 1x1

### Entregas

- engine puro;
- seed;
- eventos;
- score;
- testes;
- endpoint de desafio.

### Aceite

- mesma entrada + seed = mesmo resultado;
- endpoint persiste match;
- retorna eventos;
- score bate com eventos de goal;
- idempotência funciona.

---

## Milestone 4 — Playback + XP

### Entregas

- MatchScene;
- reprodução temporal;
- acelerar/pular;
- XP;
- level up;
- challenger_progress;
- retorno decrescente.

### Aceite

Fluxo:

```text
NPC
-> desafiar
-> backend
-> playback
-> resultado
-> roster atualizado
```

---

## Milestone 5 — Recrutamento + elenco

### Entregas

- recruitment;
- roster UI;
- consulta de atributos dos atletas;
- constraints.

### Aceite

- vencer NPC;
- desbloquear;
- recrutar;
- jogador aparece no roster;
- não duplicar;
- consultar os atletas, com limite de cinco ativos e sem slots de posição;
- dispensar para liberar uma vaga e reencontrar o desafiante no ponto da dispensa.

O editor de cinco slots da entrega original foi removido após a adoção de duelos
1x1 em todos os jogos. A API e o schema legados permanecem por compatibilidade.

---

## Milestone 6 — Estádio com sequência 1x1

### Entregas

- treinador com cinco oponentes, ordenados do mais fraco ao mais forte;
- duelos individuais, engine v3 com desempate;
- tentativa persistida por perfil/estádio;
- escolha individual de atleta, sem exigir lineup;
- cinco vitórias consecutivas concedem troféu;
- derrota encerra tentativa e exige recomeçar;
- estádio bloqueado após conquista.

### Aceite

```text
menos de cinco atletas próprios -> recusa
cinco ou mais atletas próprios -> permitido
quatro vitórias -> sem troféu
quinta vitória consecutiva -> troféu
derrota em qualquer rodada -> próxima tentativa começa pelo primeiro
retry -> mesmo duelo, sem duplicar XP/avanço
segunda tentativa após troféu -> rejeitada
```

---

## Milestone 7 — Vertical slice polida

### Entregas

- 8–12 NPCs;
- balanceamento inicial;
- áudio mínimo;
- feedback visual;
- loading/erro;
- persistence/reload;
- smoke E2E.

### Conteúdo e polimento implementados no M7

Somente Benfica: a rota principal mantém Nilo (1), Cora (2), Davi (2), Bia (3), Rui (4), Sol (4), Teca (5)
e Zeca (6). A migration V9 adiciona os sete novos recrutáveis sem mudar resultados
históricos, engines ou regras de XP. Cada spawn permanece conteúdo estático no Tiled.
A V11 ajusta os níveis posteriores conforme a seção 28.2 e adiciona treino, sem
reescrever a V9 nem partidas persistidas. O mapa foi ampliado de 54×38 para 72×50
tiles, com três desafiantes distribuídos nas novas áreas e um ponto de treino. A V17
acrescenta Íris na quadra leste, Bento perto do lago, Lua na praça sul e Cauê na área
oeste, totalizando doze desafiantes no bairro sem alterar a rota principal.
A V18 acrescenta Nina ao norte, Beto a oeste, Joca no centro-leste e Maiara no
sudeste, totalizando dezesseis desafiantes espalhados pelo mapa.
A seleção e o recrutamento usam o ID do NPC abordado; a Equipe consulta todos os convites.
O refinamento V16 concentra os diálogos da academia em uma faixa superior compacta,
mantém somente o treinador em cada setor e originalmente aplicava cooldown de um minuto por atleta.
A V23 remove a espera entre treinos após a inclusão do cansaço; o atleta pode repetir
a sessão assim que a animação terminar (ADR-0012).

O HUD orienta reunir cinco atletas → estádio → cinco vitórias consecutivas → conquista. Há quatro trilhas sintetizadas originais em loop para menu, formatura solene, ambiente
da cidade e disputa. Aceitar o duelo inicia sua música; o resultado interrompe a disputa
e toca vitória, empate ou derrota. O alerta acompanha o “!” do desafiante. Apito, gol,
entrega do diploma, troféu e convite também têm efeitos. O botão “Som: ativar” libera
o áudio no menu após interação; a opção de silêncio mantém a preferência local e
interrompe inclusive sons em andamento. Ocultar a aba pausa o áudio; retornar restaura
a trilha atual. Ver ADR-0014.
As chamadas HTTP expiram após 15 segundos para permitir retry nas telas existentes.
Reload abre o menu; CONTINUAR restaura progresso do servidor durante a sessão HTTP e o último checkpoint local.
Autenticação e retomada entre reinícios do servidor não fazem parte desta entrega local.

Validação: `MilestoneSevenIntegrationTest` completa o bairro com os três starters e
mede simulações com conteúdo real, incluindo os primeiros quatro duelos e a chance de completar a sequência do estádio.
O smoke `vertical-slice.spec.ts` percorre a
seção 37 pela interface, sem SQL/fixtures de progresso, incluindo respostas perdidas,
recrutamento, consulta do elenco, interior/treinador, duelos consecutivos, conquista, reload e bloqueio permanente do estádio.

### Aceite final do MVP

Um novo perfil consegue completar o bairro do início ao troféu sem manipular banco manualmente.

---

# 37. Fluxo E2E autoritativo do MVP

Este é o principal teste de produto:

```text
GIVEN
não existe progresso do usuário

WHEN
seleciono INICIAR

THEN
vejo a formatura, informo meu nome e recebo o canudo

WHEN
saio da universidade

THEN
Miguel oferece escolher as cores do time e depois 1 dos 3 starters

WHEN
escolho o starter

THEN
recebo exatamente 1 OwnedPlayer

WHEN
entro no bairro

THEN
vejo o personagem e consigo caminhar

WHEN
interajo com um desafiante

THEN
posso selecionar um jogador possuído

WHEN
inicio o desafio

THEN
o backend cria exatamente 1 match
e calcula o resultado

WHEN
o frontend recebe o resultado

THEN
reproduz os eventos em sequência

WHEN
vence

THEN
XP é aplicado uma única vez

AND
recruitment fica disponível quando aplicável

WHEN
recruto

THEN
o jogador aparece no roster uma única vez

WHEN
tenho menos de 5 jogadores

THEN
o treinador do estádio recusa o desafio sem criar partida

WHEN
tenho ao menos 5 jogadores

THEN
posso escolher um atleta para cada duelo de estádio

WHEN
entro no estádio

THEN
entro no interior, posso caminhar e falar com os torcedores

AND
converso com o treinador para escolher o atleta

AND
o backend valida ownership e requisitos

WHEN
venço os cinco duelos consecutivos

THEN
ganho o troféu

AND
o estádio fica concluído

AND
não consigo disputar novamente o mesmo estádio
```

---

# 38. Decisões arquiteturais que NÃO devem ser revisitadas sem motivo

Para o MVP:

1. Web primeiro.
2. Phaser no cliente.
3. Kotlin + Spring Boot no backend.
4. PostgreSQL.
5. REST.
6. Monólito modular.
7. Backend autoritativo.
8. Match Engine no backend.
9. Match Engine determinístico por seed.
10. Eventos simulados enviados em lote.
11. Sem WebSocket.
12. Sem Redis.
13. Sem mensageria.
14. Sem microservices.
15. Sem futebol em tempo real.
16. Um bairro primeiro.

Se surgir uma necessidade real de mudar uma dessas decisões, criar ADR.

---

# 39. ADRs

Formato:

```text
docs/decisions/
ADR-0001-short-title.md
```

Template:

```markdown
# ADR-0001 — Title

## Status
Accepted

## Context

## Decision

## Consequences

## Alternatives considered
```

Não criar ADR para decisão trivial.

---

# 40. Estratégia de deploy

## 40.1 MVP

Arquitetura suficiente:

```text
Static Frontend
     |
     v
Spring Boot instance
     |
     v
Managed PostgreSQL
```

Não precisa auto-scaling sofisticado.

## 40.2 Ambientes

SHOULD:

```text
local
test
production
```

Staging MAY ser adicionado depois.

## 40.3 Config

Usar environment variables para:

```text
DB_URL
DB_USER
DB_PASSWORD
allowed origins
cookie/security flags
```

Nada secreto no Git.

---

# 41. Evoluções futuras

Não implementar agora, mas a arquitetura deve permitir.

## 41.1 Novos bairros

Adicionar:

- tilemap;
- challengers;
- players;
- stadium;
- requirements.

## 41.2 Cidade/estado/região

Reusar `stadium_requirement`.

## 41.3 Jogadores raros

Desafiante pode depender de:

- troféu;
- horário/evento;
- progresso;
- desafio secreto.

Evitar lógica hardcoded espalhada.

## 41.4 Skills

Jogadores MAY ter skills:

```text
Long Shot
Interceptor
Quick Dribbler
Playmaker
Clutch Finisher
```

Não implementar antes do core estar balanceado.

## 41.5 Energia/stamina

Cansaço entre atividades foi incluído no MVP por solicitação explícita do usuário.
A regra autoritativa está na seção 11.6; ver ADR-0011. Não há lesões ou itens de recuperação.

## 41.6 Itens/equipamentos

Possível, mas alto risco de desviar o foco.

## 41.7 Mobile

PWA primeiro; app nativo somente se houver motivo.

## 41.8 Desktop

Empacotamento futuro é possível.

## 41.9 Cloud analytics

Pode analisar:

- win rates;
- abandono;
- grind;
- NPCs mais difíceis.

Somente depois de usuários reais.

---

# 42. Ideias de game design para experimentar após o MVP

Estas são sugestões, não requisitos.

## 42.1 Personalidade de bairro

Exemplo:

```text
Bairro A: drible e velocidade
Bairro B: físico e marcação
Bairro C: marcação e físico
```

Isso cria identidade regional.

## 42.2 NPC raro escondido

Um jogador forte pode aparecer após:

- vencer certos NPCs;
- conquistar troféu;
- acessar rua secundária.

## 42.3 Diálogo contextual

Após várias vitórias:

```text
"Já deu, tu tá muito acima daqui."
```

Ajuda a explicar XP baixo.

## 42.4 Rival

Um NPC recorrente pode evoluir em paralelo e reaparecer em fases futuras.

## 42.5 Sinergia

Pequenos bônus por composição:

- criador + finalizador;
- marcador + armador.

Manter bônus transparente e pequeno.

## 42.6 Evolução visual

Level milestone pode adicionar:

- pequena variação de sprite;
- badge;
- efeito.

Evitar trocar identidade do personagem.

---

# 43. Naming e IDs

IDs de conteúdo devem ser estáveis e legíveis.

Bom:

```text
benfica
benfica_stadium
starter_leo
npc_juninho_01
trophy_benfica
```

Evitar usar nome exibido como FK.

O nome visível pode mudar:

```text
"Estádio do Benfica"
```

sem mudar:

```text
benfica_stadium
```

---

# 44. Internacionalização

MVP pt-BR.

Mesmo assim:

- eventos estruturados;
- textos não hardcoded no engine;
- `messageKey` quando útil.

Isso reduz custo futuro de tradução.

Não precisa instalar framework pesado de i18n imediatamente.

---

# 45. Versionamento de contratos

API:

```text
/api/v1
```

Match Engine:

```text
engineVersion
```

Database:

```text
Flyway
```

Content IDs:

estáveis.

Esses quatro mecanismos devem evitar que evolução futura destrua saves ou debugging.

---

# 46. Checklist de qualidade antes de expandir o mundo

Antes de criar o segundo bairro:

- [ ] starter funciona;
- [ ] save no backend funciona;
- [ ] reload mantém progresso;
- [ ] 1x1 é divertido o suficiente;
- [ ] eventos não parecem repetitivos demais;
- [ ] XP não incentiva grind burro;
- [ ] recrutamento funciona;
- [ ] elenco e seleção individual funcionam sem slots de posição;
- [ ] sequência 1x1 exige cinco vitórias e reinicia após derrota;
- [ ] estádio transacional;
- [ ] idempotência comprovada;
- [ ] smoke E2E verde;
- [ ] não há dependência arquitetural desnecessária.

Se vários itens falharem, não aumentar conteúdo ainda.

---

# 47. Primeira definição de sucesso

O projeto terá provado sua viabilidade quando uma pessoa puder jogar aproximadamente 15–30 minutos no primeiro bairro e sentir este loop:

```text
"quero ver quem tem ali"
      ↓
"vou desafiar"
      ↓
"esse jogador seria bom pro meu time"
      ↓
"quero evoluir mais um pouco"
      ↓
"agora meu atleta está pronto"
      ↓
"vou tentar o estádio"
      ↓
"ganhei o troféu"
```

Essa sensação é mais importante do que quantidade de features.

---

# 48. Orientação específica para agentes de código

Ao receber esta especificação, o agente deve:

1. não tentar implementar o documento inteiro em uma única mudança;
2. seguir os milestones;
3. começar pelo menor fluxo verificável;
4. manter contratos explícitos;
5. criar testes junto da regra de domínio;
6. não adicionar infraestrutura especulativa;
7. reportar divergências encontradas entre código e spec;
8. preferir alterações reversíveis;
9. não “melhorar” a arquitetura trocando stack sem solicitação;
10. usar critérios de aceite como evidência de conclusão.

---

# 49. Prompt recomendado para iniciar o projeto no Codex

Use algo próximo de:

```text
Leia AGENTS.md e docs/GAME_SPEC.md integralmente antes de alterar arquivos.

Implemente somente o Milestone 0 da especificação.

Objetivo:
- criar o monorepo;
- frontend Vite + TypeScript + Phaser;
- backend Kotlin + Spring Boot + Gradle Kotlin DSL;
- PostgreSQL via compose;
- Flyway configurado;
- healthcheck;
- testes/build mínimos;
- README com instruções de execução.

Restrições:
- não implemente gameplay ainda;
- não adicione Redis, mensageria, WebSocket, microservices ou React;
- use versões estáveis compatíveis;
- não hardcode secrets.

Antes de concluir:
- execute builds e testes relevantes;
- valide que a migration aplica em banco limpo;
- reporte arquivos criados, comandos executados e qualquer bloqueio.
```

Se a instalação do Codex utilizada suportar Goals, o mesmo resultado pode ser expresso como um objetivo verificável:

```text
/goal Entregar o Milestone 0 de docs/GAME_SPEC.md, verificando que frontend e backend compilam, testes básicos passam, PostgreSQL sobe pelo compose, Flyway aplica em banco limpo e o README permite reproduzir a execução. Preserve todas as restrições de AGENTS.md e não avance para gameplay.
```

Depois:

```text
Implemente somente o Milestone 1.
```

e assim sucessivamente.

---

# 50. Referências técnicas úteis

Documentação oficial recomendada para implementação:

- Phaser: https://docs.phaser.io/
- Tiled JSON format: https://doc.mapeditor.org/en/stable/reference/json-map-format/
- Spring Boot: https://docs.spring.io/spring-boot/
- Kotlin: https://kotlinlang.org/docs/home.html
- PostgreSQL: https://www.postgresql.org/docs/
- Flyway: https://documentation.red-gate.com/flyway
- Testcontainers: https://testcontainers.com/
- Vite: https://vite.dev/
- OpenAI Codex docs: https://developers.openai.com/learn/codex

---

# 51. Resumo executivo para o agente

Se precisar reduzir tudo a dez regras:

1. É um RPG web single-player de futebol.
2. Phaser controla o jogo visual.
3. Spring Boot controla as regras.
4. PostgreSQL controla o save.
5. O backend é autoritativo.
6. Match Engine é puro, determinístico e versionado.
7. REST retorna a partida inteira; frontend apenas reproduz.
8. Uma partida + recompensas é transacional e idempotente.
9. Primeiro entregar um bairro completo; não expandir cedo.
10. Não sobrearquitetar.
