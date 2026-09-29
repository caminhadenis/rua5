# AGENTS.md — Street Football RPG

## 1. Fonte de verdade

Antes de alterar código, leia integralmente:

- `docs/GAME_SPEC.md`

Esse documento é a especificação funcional e arquitetural autoritativa do projeto.

Em caso de conflito:

1. instrução explícita mais recente do usuário;
2. `AGENTS.md`;
3. `docs/GAME_SPEC.md`;
4. código existente e comentários;
5. suposições do agente.

Não altere silenciosamente uma decisão arquitetural definida na especificação.

---

## 2. Objetivo do projeto

Construir um RPG single-player de futebol para navegador, com exploração 2D em pixel art, desafios 1x1 contra NPCs, recrutamento/evolução de jogadores e partidas 5x5 em estádios que liberam progressivamente novas áreas.

O jogo é **single-player conectado**:

- não há PvP;
- não há outros usuários compartilhando o mapa;
- o frontend usa internet normalmente;
- o backend é autoritativo para progresso e partidas;
- PostgreSQL guarda o estado persistente do jogador.

---

## 3. Regras de implementação

### MUST

- Manter o backend como **monólito modular**.
- Usar REST/JSON para comunicação frontend-backend no MVP.
- Manter o backend autoritativo para:
  - resultado de partidas;
  - XP;
  - level up;
  - recrutamento;
  - desbloqueios;
  - troféus;
  - regras de acesso aos estádios.
- Manter o `MatchEngine` isolado da camada HTTP, banco e framework.
- Fazer o `MatchEngine` determinístico quando receber a mesma `seed`, mesmos participantes e mesma `engineVersion`.
- Persistir mudanças de uma partida e suas recompensas de forma transacional.
- Usar migrations de banco.
- Validar no backend que recursos usados pelo cliente pertencem ao usuário/perfil autenticado.
- Implementar idempotência nos comandos que criam partidas ou concedem recompensas.
- Criar testes para regras de domínio antes ou junto com a implementação.
- Executar testes relevantes antes de declarar uma tarefa concluída.
- Preservar a separação entre conteúdo estático do mapa e estado persistente do jogador.
- Usar IDs estáveis (`mapId`, `spawnKey`, `playerDefinitionId`, etc.) e nunca depender do texto exibido ao usuário como chave.
- Usar arte, nomes e assets originais ou placeholders licenciados; não copiar assets de Pokémon, Brasfoot ou outras franquias.

### SHOULD

- Preferir a solução mais simples que satisfaça o MVP.
- Implementar uma fatia vertical completa antes de expandir conteúdo.
- Manter funções e classes pequenas e testáveis.
- Preferir composição a herança.
- Evitar lógica de domínio em controllers, scenes do Phaser ou repositories.
- Registrar decisões novas importantes em `docs/decisions/ADR-XXXX-<slug>.md`.
- Atualizar a documentação quando uma decisão deliberada mudar.
- Criar fixtures/seeds pequenos e legíveis.
- Usar nomes de domínio em inglês no código e português apenas em textos de interface/conteúdo, salvo decisão posterior.

### MUST NOT no MVP

Não introduzir sem necessidade comprovada:

- microservices;
- Kafka;
- RabbitMQ;
- Redis;
- WebSocket;
- SSE;
- Kubernetes;
- CQRS completo;
- Event Sourcing;
- GraphQL;
- física de futebol em tempo real;
- multiplayer;
- matchmaking;
- economia complexa;
- marketplace;
- chat;
- procedural generation.

Se uma tarefa parecer exigir um desses itens, primeiro verifique se o requisito pode ser atendido com a arquitetura existente.

---

## 4. Forma de trabalhar

Antes de implementar uma tarefa relevante:

1. leia a seção correspondente de `docs/GAME_SPEC.md`;
2. inspecione o código existente;
3. identifique o menor incremento vertical que entrega valor;
4. liste internamente os arquivos que provavelmente serão afetados;
5. implemente;
6. rode testes/lint/build pertinentes;
7. corrija regressões;
8. só então considere a tarefa concluída.

Não faça refactors amplos não solicitados junto de uma feature.

Se encontrar uma ambiguidade que não bloqueie o trabalho, escolha a alternativa mais simples compatível com a especificação e documente a suposição no código, teste ou ADR, conforme relevância.

Se a ambiguidade alterar significativamente domínio, persistência ou API pública, pare naquele ponto e apresente opções ao usuário em vez de inventar uma regra irreversível.

---

## 5. Ordem padrão de prioridade

Ao implementar do zero, siga os milestones de `docs/GAME_SPEC.md`.

A prioridade é obter primeiro este fluxo executável:

`abrir jogo -> escolher starter -> andar no mapa -> interagir com NPC -> iniciar desafio -> backend simular partida -> frontend reproduzir eventos -> ganhar XP -> recrutar jogador -> montar 5 -> vencer estádio -> ganhar troféu`

Não expanda para outros bairros antes de esse fluxo estar funcionando e testado.

---

## 6. Definition of Done

Uma tarefa de código só está pronta quando, quando aplicável:

- compila;
- testes relevantes passam;
- migrations aplicam em banco limpo;
- endpoint possui validação e erros coerentes;
- lógica crítica está coberta por teste;
- não há segredo hardcoded;
- não há duplicação óbvia de regra de domínio;
- documentação foi atualizada se houve mudança deliberada de contrato;
- a feature funciona no fluxo real, não apenas em mocks isolados.

Para milestones, execute também o smoke/E2E definido na especificação.

---

## 7. Convenções iniciais

### Monorepo

```text
/
├── AGENTS.md
├── README.md
├── docs/
├── frontend/
├── backend/
└── compose.yaml
```

### Frontend

- TypeScript
- Vite
- Phaser
- testes de lógica com Vitest
- Playwright somente para smoke/E2E de alto valor

### Backend

- Kotlin
- Spring Boot
- Gradle Kotlin DSL
- JDK 21+
- Spring Web
- Spring Data JPA
- Spring Validation
- Spring Security quando autenticação for ativada
- Flyway
- PostgreSQL
- JUnit 5
- Testcontainers para integração com PostgreSQL

Use versões estáveis compatíveis e mantenha lockfiles/versões explícitas no projeto.

---

## 8. Banco e migrations

- Não use `ddl-auto=create` ou equivalente como estratégia de schema.
- Flyway é a fonte de evolução do schema.
- Migrations já aplicadas não devem ser editadas; crie nova migration.
- Constraints importantes devem existir também no banco, não apenas no Kotlin.
- Índices devem ser justificados pelos acessos reais.
- Campos de auditoria devem usar timestamps UTC.

---

## 9. API

- Prefixo: `/api/v1`.
- JSON.
- Erros devem ter formato consistente.
- Comandos de partida devem aceitar uma chave de idempotência.
- O cliente nunca envia stats finais, XP final ou placar para persistência.
- O backend deriva tudo que afeta progresso.

---

## 10. Match Engine

O engine deve ser uma biblioteca de domínio pura.

Ele não pode depender diretamente de:

- Spring;
- JPA;
- HTTP;
- PostgreSQL;
- Phaser.

Entrada conceitual:

```text
MatchRequest
- mode
- home participants
- away participants
- seed
- engineVersion
```

Saída conceitual:

```text
MatchResult
- score
- winner
- events
- statistics
- seed
- engineVersion
```

Testes devem provar:

- determinismo;
- limites de stats;
- produção de eventos válidos;
- comportamento de empate/desempate;
- invariantes de score;
- compatibilidade da versão do engine quando aplicável.

---

## 11. Segurança

Mesmo sendo single-player:

- nunca confie em `userId` enviado pelo cliente;
- derive o usuário da autenticação/sessão;
- valide ownership;
- use cookies HttpOnly/Secure quando autenticação web for ativada;
- proteja operações mutáveis contra CSRF quando a estratégia de sessão exigir;
- não exponha stack traces no contrato HTTP de produção;
- não coloque secrets no repositório.

---

## 12. Escopo visual

O alvo é estética de RPG portátil 8/16-bit, mas com identidade própria.

Não replicar:

- sprites;
- mapas;
- personagens;
- nomes;
- UI;
- músicas;
- tiles;
- logos

de Pokémon ou qualquer outra franquia.

Durante o desenvolvimento, prefira placeholders simples e claramente substituíveis.

---

## 13. Regra para novas dependências

Antes de adicionar uma dependência:

1. confirme que a plataforma/stdlib não resolve adequadamente;
2. confirme que ela traz benefício concreto;
3. evite sobreposição com dependência já existente;
4. registre a motivação no PR/commit ou ADR se arquitetural.

Não adicione frameworks apenas por conveniência estética.

---

## 14. Critério final

Sempre priorize:

**jogo funcionando > arquitetura sofisticada**

e, dentro disso:

**domínio correto + testes + simplicidade > abstrações prematuras**.
