# ADR-0013 — Treinador, abertura Rua 5 e retomada

## Status
Accepted — solicitação explícita do usuário.

## Context
O avatar era o starter. O cliente criava/carregava perfil diretamente e o estádio
aceitava um atleta. O usuário pediu uma jornada de formação de treinador, menu
pixelado, avatar único e cinco atletas no elenco para aceitar o desafio do estádio.
Também distinguiu INICIAR (nova jornada) e CONTINUAR (retomar o que foi salvo).

## Decision
- Avatar original fixo de professor de educação física: pele parda, cabelo preto,
  polo esportiva clara, bermuda escura, tênis e apito. Cores do time e starter não o alteram.
- Menu Rua 5 precede toda navegação. INICIAR abre formatura, nome e orientação;
  sair caminhando encontra Miguel, que pergunta as cores e oferece um dos três atletas.
- `/profile/new-game` cria outro perfil na sessão após a escolha das cores, sem
  apagar histórico. O último comando é idempotente e serializado na sessão.
- CONTINUAR lê perfil/progresso do servidor. Geometria cosmética da rua/interior
  fica em localStorage por profileId e é validada antes de restaurar. Não guarda XP
  ou elenco localmente. Sem localização válida, começa na entrada do bairro.
- OPÇÕES segue sem funcionalidade. Sem perfil recuperável, CONTINUAR é desabilitado.
- Dimas recusa na conversa quando faltam atletas. O backend exige cinco ou mais,
  com `409 STADIUM_ROSTER_INCOMPLETE` antes de qualquer efeito. Replay idempotente
  confirmado continua precedendo essa validação. Os cinco duelos seguem 1x1,
  permitindo repetir o mesmo atleta, sem lineup.

## Consequences
Persistência de progresso permanece no PostgreSQL, sem migration nova. O checkpoint
é cosmético e local ao navegador; mapa editado pode exigir ajustar pontos antigos.
A identidade atual é uma sessão HTTP volátil, sem autenticação pública. O save não
é recuperável após expiração/reinício do backend ou em outro dispositivo. Antes
que nome/cores criem um perfil, a formatura não tem checkpoint. Isso não equivale a
um sistema de contas ou slots de save, cuja definição permanece futura.
