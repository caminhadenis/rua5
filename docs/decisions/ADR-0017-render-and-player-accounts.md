# ADR-0017 — Publicação Render/Neon e contas persistentes

## Status

Accepted

## Context

O usuário pediu preparação para GitHub e nuvem gratuita, informou PostgreSQL no Neon
e escolheu frontend/API juntos e login por e-mail/senha. A seção 25 exige autenticação
antes da publicação pública. Sessões em memória perdiam a identidade após reinício.

## Decision

O build de publicação inclui o frontend estático no JAR Spring Boot e usa um único
Web Service Free no Render, ligado ao Neon por JDBC/SSL. Mantêm-se TypeScript/Phaser,
REST, monólito modular, PostgreSQL e engines atuais. Compose de desenvolvimento conserva
suas imagens. `production` exige autenticação; ambientes locais mantêm o fluxo existente.

Spring Security implementa cadastro, login por formulário, BCrypt, rotação da sessão,
logout e CSRF. Spring Session JDBC persiste sessões no PostgreSQL pela V27; o customizer
oficial de PostgreSQL tolera criação concorrente de atributos. A sessão dura sete dias
sem uso, com cookie persistente HttpOnly, Secure em produção e SameSite=Lax. Limpeza de
sessões expiradas é horária para evitar acordar continuamente o banco gratuito.

V28 cria contas e ownership. Uma conta aponta para sua jornada atual; `game_profile.user_id`
permite várias jornadas preservadas, em vez do UNIQUE conceitual da seção 19.2. Isso mantém
o contrato existente de INICIAR sem apagar histórico. A FK composta garante no banco que
a jornada atual pertence à conta. Perfis locais antigos permanecem sem dono e não podem
ser reivindicados por uma identidade enviada pelo navegador. A produção deriva perfil
da conta autenticada, ignorando atributos locais antigos de perfil.

Nova jornada usa recibo durável por conta (por sessão apenas no modo local), chave de
idempotência e lock transacional PostgreSQL. V29 persiste o snapshot da resposta; retries
não criam outra jornada, não mudam a conta de volta para um save antigo e não retornam
estado mutável como se fosse a resposta original. Conta, perfil atual e recibo são
persistidos na mesma transação. Nenhuma regra de partida ou recompensa muda.

O menu conecta ao servidor antes de liberar INICIAR, aguarda até 90 segundos no primeiro
acesso e permite retry. Cadastro/login aparecem somente quando o backend exige contas.
O cliente atualiza CSRF após login e inclui o token em comandos mutáveis.

## Consequences

Reiniciar ou suspender o backend não perde o save nem a sessão; um novo login em outro
aparelho recupera a jornada atual. Posição geométrica continua cosmética/local por perfil.
Não há interface de seleção de jornadas arquivadas, e-mail de verificação ou recuperação
de senha nesta entrega. Apenas login/cadastro exigem BCrypt; não se adiciona serviço de e-mail.

Spring Security e Session JDBC são dependências necessárias para autenticação e sessões
duráveis na stack existente, sem Redis, JWT ou serviço externo de identidade. Os lockfiles
fixam versões. O frontend corrige apenas source-map-js 1.2.1 → 1.2.2 no lockfile por um
alerta de segurança da cadeia de build, sem adicionar dependência direta.

O serviço gratuito pode suspender por inatividade/quotas. A imagem é validada localmente
com limite de 512 MB e banco isolado. O Neon e Render ainda precisam receber credenciais
no painel; nenhuma credencial real integra imagem, Blueprint ou repositório.

## Alternatives considered

- Static Site separado: exigiria proxy adicional ou comunicação entre origens para cookies.
- Sessão em memória: insuficiente diante de reinícios/suspensão do Render Free.
- Redis/JWT: desnecessários para a sessão web com PostgreSQL já existente.
- Login social: usuário escolheu e-mail e senha.
