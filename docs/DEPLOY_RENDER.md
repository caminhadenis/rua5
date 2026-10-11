# Publicar Rua 5 no Render com PostgreSQL no Neon

O frontend Vite compilado e a API Spring Boot são publicados juntos em um único
**Web Service Free**. O Dockerfile.render compila as duas pastas e inclui o frontend
no JAR. O navegador usa `/api/v1` no mesmo endereço do jogo. PostgreSQL fica no Neon;
o Blueprint não cria outro banco. O Compose de desenvolvimento continua separado.

## 1. Preparar o GitHub

Na raiz, confira os arquivos antes de fazer commit:

```bash
git status --short
git diff --check
```

Envie código, migrations, assets, lockfiles, `Dockerfile.render`, `render.yaml` e
esta documentação. `.env` e `.env.*` reais são ignorados; os exemplos são públicos.
Não inclua senha, URL com credenciais, dumps do banco ou tokens nos commits.

Se o repositório já está conectado ao GitHub:

```bash
git add .
git commit -m "Prepare Render deployment and persistent player accounts"
git push
```

Se ainda não está, crie um repositório vazio no GitHub e configure o remote usando
as instruções do próprio GitHub. Use a branch que contém esta versão ao criar o serviço.

## 2. Obter a conexão do Neon

No projeto que você já criou, abra **Connect**. Escolha o banco e a role que serão
usados pelo Rua 5 e desative **Connection pooling** para copiar o host direto.
O backend aplica migrations Flyway ao iniciar, por isso este roteiro usa conexão direta.
O banco deve ser dedicado ao jogo, vazio ou com o schema Flyway deste projeto.

Copie host, banco, usuário e senha separadamente. Exemplo fictício:

```text
Host: ep-exemplo.us-east-2.aws.neon.tech
Database: neondb
Role: neondb_owner
```

Monte a URL JDBC sem usuário e senha embutidos:

```text
jdbc:postgresql://ep-exemplo.us-east-2.aws.neon.tech:5432/neondb?sslmode=require
```

Use os valores reais do seu painel. Não use `localhost`, `postgres:5432` ou a URL
`postgresql://usuario:senha@...` diretamente no campo `DB_URL`. Se o painel exigir
parâmetros extras compatíveis com JDBC, mantenha-os na URL. O `sslmode=require`
exige criptografia da conexão.

O primeiro deploy aplica todas as migrations e seeds automaticamente. Não é preciso
criar tabelas à mão. Ele não transfere o progresso do PostgreSQL local ao Neon.

## 3. Criar o serviço pelo Blueprint

1. Entre no Render e conecte sua conta GitHub.
2. Escolha **New → Blueprint**.
3. Selecione o repositório e a branch com estes arquivos.
4. Use `render.yaml`, na raiz, como arquivo de configuração.
5. Confira o serviço `rua5`, com runtime **Docker** e plano **Free**.
6. Preencha os três campos solicitados: `DB_URL`, `DB_USER` e `DB_PASSWORD`.
7. Inicie o deploy e acompanhe os logs.

Os três valores são cadastrados no Render por `sync: false`; não vão para o Git.
O serviço usa `SPRING_PROFILES_ACTIVE=production`, que ativa login e CSRF. Este valor
deve permanecer configurado na nuvem. O Render fornece `PORT` automaticamente.
Nenhuma credencial precisa entrar no frontend.

Para escolher a região, prefira uma próxima à região do Neon. Se quiser configurar
manualmente, use **New → Web Service** com estes campos:

| Campo | Valor |
|---|---|
| Language / Runtime | Docker |
| Root Directory | vazio |
| Dockerfile Path | `Dockerfile.render` |
| Docker Build Context | `.` |
| Docker Command | vazio |
| Instance Type | Free |
| Health Check Path | `/health` |

Cadastre estas variáveis no modo manual:

| Variável | Valor |
|---|---|
| `SPRING_PROFILES_ACTIVE` | `production` |
| `DB_URL` | URL JDBC direta do Neon com SSL |
| `DB_USER` | role do Neon |
| `DB_PASSWORD` | senha da role |
| `JAVA_TOOL_OPTIONS` | `-Xms64m -Xmx256m` |

Não é necessário Static Site, proxy Nginx, variável VITE de API ou configuração CORS
para esta publicação. O jogo e a API usam a mesma origem.

## 4. Conferir o primeiro deploy

Nos logs, confira a conexão ao PostgreSQL, migrations aplicadas e inicialização do
Spring Boot. Depois abra:

```text
https://SEU-SERVICO.onrender.com/health
https://SEU-SERVICO.onrender.com/
```

O healthcheck deve responder `{"status":"UP"}`. Ele verifica o processo HTTP; o
cadastro/login e o jogo verificam a conexão real ao banco.

Na interface, crie uma conta com e-mail e senha, inicie uma jornada, escolha starter
e dispute um duelo. Recarregue e use CONTINUAR. Entre com a mesma conta em outro
navegador/celular e confirme o elenco. Faça também um redeploy e confira a retomada.

As senhas têm de 12 a 72 caracteres e no máximo 72 bytes UTF-8; são armazenadas
com BCrypt. Esta primeira versão não envia e-mails, não verifica a caixa postal e
não oferece recuperação de senha. Guarde a senha escolhida. Sessões persistem no
PostgreSQL, expiram após sete dias sem uso e usam cookie HttpOnly/Secure em produção.
Ao expirar, faça login novamente para recuperar a jornada da conta.

INICIAR cria outra jornada na mesma conta, preservando registros anteriores.
CONTINUAR e um novo login retomam a jornada mais recente. Não há seleção de jornadas
arquivadas. Saves locais antigos permanecem sem conta; não são adotados por e-mail.
No segundo aparelho, a posição cosmética pode começar na entrada do bairro; elenco,
XP e troféus vêm do servidor.

## 5. Validar a imagem na sua máquina

Este ambiente usa banco e volume próprios e não acessa o Neon nem o banco local do jogo:

```bash
docker compose -p rua5-deploy-validation -f compose.deploy-test.yaml up -d --build --wait
```

Abra `http://localhost:5176`. Login de produção fica ativo; o cookie Secure é desligado
somente neste teste local HTTP. O aplicativo tem limite de 512 MB, como no Render Free.
Para testar no navegador, com as dependências de desenvolvimento instaladas:

```bash
cd frontend
npm ci
npx playwright install chromium
npm run test:deploy
```

O teste cria contas descartáveis, disputa um duelo real e confirma retomada em outro
navegador e cadastro no celular. Na URL local padrão, reinicia automaticamente apenas
o serviço `game` do projeto `rua5-deploy-validation` e confere sessão/XP preservados.
`DEPLOY_BASE_URL` permite apontar para outro ambiente;
ao usá-lo num serviço publicado, o teste criará contas/jornadas nesse banco.

Para testar a retomada após reinício, crie uma jornada no navegador, execute na raiz:

```bash
docker compose -p rua5-deploy-validation -f compose.deploy-test.yaml restart game
```

Espere `/health` responder, recarregue a página e use CONTINUAR. Ao terminar, pare
os containers preservando o banco de teste:

```bash
docker compose -p rua5-deploy-validation -f compose.deploy-test.yaml down
```

## 6. Atualizações, limites e diagnóstico

Com Auto Deploy ativo, novos pushes à branch publicada geram novo build. O serviço
aplica novas migrations ao iniciar; nunca edite migrations já aplicadas. Faça backup
do banco antes de mudanças importantes. Reverter o código no Render não reverte schema.

O Render Free suspende o serviço após 15 minutos sem tráfego, e o próximo acesso
pode levar cerca de um minuto para acordá-lo. O menu aguarda até 90 segundos para
conectar e oferece nova tentativa. Dados e sessões continuam no Neon.

O Render tem quotas mensais de horas, tráfego e builds. O Neon Free tem quotas de
armazenamento, processamento e transferência; confira **Usage/Billing** nos dois
painéis. O plano gratuito é adequado para testes e uso pequeno e pode suspender
recursos ao atingir limites. O domínio `onrender.com` e HTTPS não exigem compra de domínio.
Mantenha os planos Free e acompanhe opções de cobrança ao cadastrar cartão.

| Sintoma | Verificar |
|---|---|
| Não conecta ao banco | host direto, role, senha, nome do banco e SSL |
| Erro Flyway | log da migration; banco correto e dedicado; não apagar histórico para contornar |
| Não encontra porta | `PORT` do Render e servidor em `0.0.0.0` |
| Jogo abre sem login na nuvem | `SPRING_PROFILES_ACTIVE=production` |
| Login não permanece | URL HTTPS e cookies permitidos; não desativar Secure na nuvem |
| POST retorna 403 | recarregar/entrar novamente para atualizar CSRF; usar o cliente desta versão |
| Primeiro acesso demora | suspensão do serviço gratuito; aguardar ou tentar novamente |
| Reinicia por memória | consumo real nos logs; heap é parte da memória total da JVM |

Referências oficiais: [Docker no Render](https://render.com/docs/docker),
[Blueprints](https://render.com/docs/blueprint-spec),
[limites gratuitos](https://render.com/docs/free),
[conexão Neon](https://neon.com/docs/connect/connect-intro),
[Spring Session JDBC](https://docs.spring.io/spring-session/reference/configuration/jdbc.html).
