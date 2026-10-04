# Estratégia de implantação pela internet

Data da pesquisa: 2026-10-03. Status: proposta para implementação; nenhum recurso
de hospedagem foi criado e nenhum deploy foi executado.

## Recomendação

Com a preferência por custo zero, começar com **Render Free + Neon Free**,
usando um Web Service Docker para aplicação e PostgreSQL externo para saves.
A hipótese é uma demonstração ou beta pequeno, com acesso ocasional. A opção
paga abaixo fica como evolução após medir uso e limitações.

Para a primeira publicação, empacotar o build estático do Vite no aplicativo
Spring Boot. O frontend continua TypeScript/Phaser, com responsabilidades próprias;
apenas a distribuição dos arquivos passa a compartilhar o servidor HTTP da API.
Isso mantém uma origem única e exige apenas um serviço de aplicação.

```text
Navegador no computador ou celular
                |
              HTTPS
                |
     Render Free Web Service / Docker
     /              -> frontend compilado
     /assets/...    -> assets estáticos
     /api/v1/...    -> monólito Spring Boot
                |
       conexão externa com TLS
                |
          Neon PostgreSQL Free
       contas, sessões e progresso
```

O diagrama aplica as seções 5, 25 e 40 de GAME_SPEC.md. É uma proposta de
empacotamento, sem mudança de autoridade, engine, API ou módulos. Registrar a
decisão em ADR quando a implementação for escolhida. Não é necessário adicionar
Redis, filas, WebSocket ou Kubernetes.

Spring Boot suporta servir arquivos estáticos do classpath; o futuro Dockerfile
na raiz deve compilar `frontend/dist`, copiá-lo para os recursos estáticos antes
do `bootJar` e produzir uma imagem final com JRE 21 e usuário sem privilégios.
Fonte: [Spring Boot — conteúdo estático](https://docs.spring.io/spring-boot/4.1/reference/web/servlet.html).

## Caminho gratuito

| Item | Serviço | Custo dentro das cotas |
| --- | --- | --- |
| Frontend compilado e API | Um Web Service Render Free, 512 MB | US$ 0 |
| Saves e contas | PostgreSQL Neon Free | US$ 0 |
| Endereço público e HTTPS | Subdomínio `onrender.com` | US$ 0 |

O anúncio oficial do Neon de 2026-10-02 informa **1 GB de armazenamento** e
**100 CU-hours por projeto/mês**, equivalentes a 400 horas no compute de 0,25 CU.
Também informa uma janela de restauração de seis horas. Conferir as cotas no
console ao criar o projeto; não planejar banco ativo 24 horas por dia com essa
franquia. Fonte: [Neon — plano gratuito atualizado](https://neon.com/blog/neon-free-plan-1-gb-per-project).

Limites e adaptações para este caminho:

- Render dorme após 15 minutos sem tráfego e a retomada leva aproximadamente
  um minuto. O primeiro acesso pode esperar; adaptar recuperação de conexão sem
  repetir comandos com novas chaves. Com frontend servido pelo mesmo container,
  o carregamento inicial também aguarda o servidor.
- Validar a JVM em 512 MB com pool JDBC pequeno. Não há medição atual que prove
  capacidade suficiente; se houver falta de memória, o gratuito nesse provedor
  pode não acomodar a aplicação sem ajustes.
- Neon é banco externo: escolher regiões próximas e usar conexão JDBC com TLS.
  Validar Flyway com conexão direta e a aplicação com a modalidade de conexão
  escolhida. Evitar atividade ociosa desnecessária do pool, limpeza de sessões
  e probes de banco que mantenham o compute ativo sem jogadores.
- Não usar pings artificiais para manter a aplicação acordada. A franquia de
  compute e o comportamento de suspensão fazem parte da proposta gratuita.
- Monitorar armazenamento, compute, banda e minutos de build. No Render,
  sem método de pagamento, exceder cotas pode suspender serviços/builds; com
  método cadastrado, pode gerar cobrança. Não prometer custo zero ilimitado.
- O Render pode suspender instâncias gratuitas com volume incomum de tráfego
  iniciado para serviços externos, incluindo bancos. Essa combinação precisa
  ser validada no beta, sem promessa de disponibilidade permanente.
- Fazer exportações periódicas e testar restauração; a janela curta do Neon
  não substitui a política de backup do save.

Fontes: [Render — limites gratuitos](https://render.com/docs/free) e
[Render — cobrança](https://render.com/docs/faq).

Autenticação e recuperação do perfil continuam necessárias antes de abrir o
jogo ao público, mesmo com hospedagem gratuita. Não há necessidade de contratar
domínio para compartilhar o link com jogadores.

## Comparação de provedores

| Opção | Adequação ao projeto | Quando escolher |
| --- | --- | --- |
| Render Free + Neon Free | Custo zero dentro das cotas, com suspensão por inatividade | Primeira demonstração ou beta pequeno |
| Render pago | Docker, banco gerenciado, HTTPS e preço de instância previsível | Quando disponibilidade ou limites exigirem upgrade |
| Railway | Docker e PostgreSQL, com cobrança por recursos consumidos | Alternativa se o consumo medido resultar em menor custo |
| VPS | Reaproveita os containers existentes, mas exige administrar sistema e banco | Se houver disposição para cuidar de atualizações, disponibilidade e backups |

O Hobby do Railway custa no mínimo US$ 5/mês e inclui US$ 5 de uso. Consumo
superior aumenta a fatura; não significa hospedar aplicação e banco por preço
fixo de US$ 5. A tabela atual cobra RAM, CPU, saída de rede e volumes separadamente.
Fonte: [Railway — preços e consumo](https://docs.railway.com/reference/pricing/plans).

Uma VPS pode reduzir a fatura de infraestrutura, mas transfere a operação para
o projeto. Por exemplo, a tabela da Hetzner lista CX23 a € 5,49/mês, excluindo
IPv4 e impostos; disponibilidade, backups e demais itens devem ser conferidos
antes de contratar. Não comparar esse valor diretamente com um serviço que
inclui operação de PostgreSQL gerenciado.
Fonte: [Hetzner — preços vigentes](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/).

Hospedar somente `frontend/dist` em um serviço estático deixa faltando a API
autoritativa e o banco. Um frontend em CDN pode ser uma evolução, com proxy
adequado para `/api` e validação dos cookies, métodos HTTP e cache.

## Alternativa paga no Render

Caso seja necessário eliminar a suspensão por inatividade, usar Web Service
pago e banco gerenciado na mesma região. Também é possível pagar somente a
aplicação e manter Neon Free enquanto suas cotas forem suficientes.

Valores em dólares, por mês, com uma instância de aplicação e uma de banco,
usando o workspace Hobby de US$ 0. Não incluem domínio, impostos nem excedentes
de banda, builds ou armazenamento.

| Cenário | Aplicação | PostgreSQL | Base mensal |
| --- | --- | --- | --- |
| Econômico, condicionado a medição | 512 MB / US$ 7 | 256 MB / US$ 6 | US$ 13 |
| Beta recomendado para iniciar a medição | 2 GB / US$ 25 | 256 MB / US$ 6 | US$ 31 |
| Banco com mais margem | 2 GB / US$ 25 | 1 GB / US$ 19 | US$ 44 |

Planos atuais de aplicação: `0.5c-512mb` e `1c-2g`. Planos de banco:
`0.1c-256mb` e `0.5c-1g`. São recursos distintos, cobrados separadamente.
Fonte: [Render — preços](https://render.com/pricing).

Os tamanhos acima são hipóteses, não capacidade comprovada do jogo. Medir uso
total de memória da JVM, tempo de inicialização, latência e conexões de banco.
O heap deve deixar espaço para memória nativa, metaspace e threads. O banco de
256 MB precisa de validação própria; subir para 1 GB se as medições exigirem.

O Render gratuito serve para experimentos: a aplicação dorme após 15 minutos
sem tráfego, e a retomada pode levar cerca de um minuto. Isso excede o timeout
atual de 15 segundos do cliente. O PostgreSQL gratuito do Render expira após
30 dias e não possui backups. No caminho gratuito, usar Neon para os saves.
Fonte: [Render — limites gratuitos](https://render.com/docs/free).

## Pontos encontrados no projeto

- Existem `backend/Dockerfile`, `frontend/Dockerfile`, Nginx e `compose.yaml`.
- O frontend usa URLs relativas `/api/v1` e `credentials: 'same-origin'`.
  Manter origem única permite preservar esse desenho.
- `ProfileSession` guarda o ID do perfil em `HttpSession`; ainda não há Spring
  Security nem conta persistente com login. Os dados do save estão no PostgreSQL,
  mas o vínculo de acesso depende da sessão do servidor.
- A seção 25.1 da especificação exige autenticação antes de publicação pública.
- `/health` hoje retorna `UP`, sem consultar a disponibilidade do banco.
- O backend lê `SERVER_PORT`; é necessário compatibilizá-lo com `PORT` do Render.
- O Nginx atual usa DNS interno do Docker Compose (`127.0.0.11`, `backend:8080`).
  Essa configuração não deve ser copiada diretamente para serviços separados no Render.
- O ambiente local utiliza PostgreSQL 18.6. Confirmar versão disponível no
  provedor e testar as migrations em banco limpo nessa versão antes do lançamento.

## Etapas de implementação

### 1. Preparar identidade e recuperação do save

Definir a forma de login antes de implementar o contrato de autenticação.
A recomendação técnica é Spring Security com sessão, conforme a especificação;
cadastro/senha ou um provedor de identidade são escolhas a confirmar nessa etapa.
Vincular o perfil à conta persistente e derivar identidade exclusivamente da sessão.

Persistir sessões no PostgreSQL com Spring Session JDBC é uma opção simples para
evitar logout em cada redeploy. Criar as tabelas com nova migration Flyway e
desativar criação automática de schema. Isso não substitui conta/login: após
expiração de sessão ou troca de dispositivo, a conta permite recuperar o perfil.
Fonte: [Spring Session — JDBC](https://docs.spring.io/spring-session/reference/configuration/jdbc.html).

Configurar cookies HttpOnly, Secure e SameSite apropriado, CSRF nos comandos,
logout e limites de tentativas de login. Ajustar o cliente para enviar o token
CSRF preservando as chaves de idempotência existentes. Testar isolamento entre
duas contas e acesso ao mesmo save após login em outro navegador.

### 2. Preparar o pacote de produção

Criar Dockerfile de produção com contexto na raiz do monorepo e build do frontend
incluído no backend. Manter a execução local atual. Usar profile de produção,
configuração externa e um futuro `render.yaml` para declarar serviço e banco,
sem credenciais no Git.

Configurações a preparar:

| Configuração | Origem e tratamento |
| --- | --- |
| `DB_URL` | URL JDBC construída a partir do host interno e nome do banco |
| `DB_USER`, `DB_PASSWORD` | Secretos fornecidos pelo provedor |
| Porta HTTP | Aceitar `PORT` do Render, preservando `SERVER_PORT` local |
| HTTPS encaminhado | Reconhecer o proxy confiável do provedor |
| Cookies e sessão | Configuração explícita de produção |
| Pool JDBC | Limite pequeno inicial, ajustado após medir conexões |
| JVM | Limites compatíveis com memória total do container |

A URL `postgresql://...` fornecida pelo provedor não deve ser passada diretamente
como URL JDBC. Usar `jdbc:postgresql://<host>:5432/<database>` e credenciais separadas,
seguindo os requisitos de TLS da conexão escolhida. Preferir a rede interna e
restringir acesso externo ao banco.

O servidor deve escutar em `0.0.0.0` na porta configurada. Fonte:
[Render — Web Services](https://render.com/docs/web-services).

Servir `/` e `index.html` com revalidação (`Cache-Control: no-cache`). Aplicar
cache longo somente a assets com hash; assets públicos sem hash precisam de
política própria. Respostas autenticadas da API não devem entrar em cache público.

### 3. Criar o ambiente e publicar uma versão validada

1. No caminho gratuito, criar Neon Free e Render Free em regiões próximas;
   na alternativa paga com banco Render, usar a mesma região para ambos.
2. Para público no Brasil, avaliar Virginia e Ohio com medição de latência;
   o Render não lista região brasileira atualmente. Não prometer latência sem medir.
3. Cadastrar secrets e configurar healthcheck/readiness que valide banco e
   inicialização após Flyway, com prazo suficiente para o startup da JVM.
4. Conectar o repositório e publicar somente commits que passaram na CI.
5. Usar primeiro o endereço HTTPS `onrender.com`; domínio próprio é opcional.
6. Executar smoke externo com conta de teste, sem usar conta ou save real.

As regiões têm redes privadas separadas. Fonte:
[Render — regiões](https://render.com/docs/regions).

### 4. Validar antes de abrir ao público

Na CI, executar backend lint/test/build com Testcontainers, frontend
lint/test/build e o smoke E2E do bairro em banco descartável. Adicionar testes
de autenticação, CSRF, cookies e retomada de sessão/conta.

No ambiente hospedado, verificar:

- Criar conta/perfil, escolher starter, desafiar, ganhar XP e recrutar.
- Completar a sequência de estádio e conferir troféu.
- Repetir comando após resposta perdida sem duplicar recompensas.
- Recarregar, reiniciar/redeployar a aplicação e recuperar o mesmo save.
- Fazer logout/login e recuperar o perfil após a sessão expirar.
- Confirmar que uma conta não acessa atletas ou progresso de outra.
- Abrir pelo celular em rede móvel e conferir controles e orientação horizontal.
- Aplicar migrations em banco limpo e testar upgrade de uma cópia representativa.
- Testar carga com uma meta explícita de usuários simultâneos e medir memória,
  latência, erros e conexões; ajustar o plano com base nos resultados.

### 5. Operação, backups e rollback

Começar com uma instância. Monitorar erros HTTP, latência, memória, CPU, conexões,
espaço do banco e consumo faturável, com alertas de orçamento e indisponibilidade.

No caminho gratuito, preparar exportações do Neon e testar restauração em banco
separado; sua janela de recuperação anunciada é de seis horas.
Na alternativa paga, Render mantém backups/PITR para PostgreSQL pago. Conferir a janela do plano,
realizar uma restauração em banco separado e verificar o save restaurado antes
de considerar o procedimento confiável. Definir a perda de dados aceitável e
prazo de recuperação; exportações externas podem complementar a retenção.
Fonte: [Render — recuperação e backups](https://render.com/docs/postgresql-backups).

Manter a imagem anterior para rollback da aplicação. Uma migration aplicada
não é desfeita ao reverter código: usar migrations compatíveis com a versão
anterior e corrigir problemas com nova migration. Restore de banco exige avaliar
o progresso criado depois do backup.

## Evolução após o beta

Se transferência de assets ou tráfego justificar, mover o frontend para CDN,
mantendo um proxy para `/api` na origem pública do jogo. A separação deve passar
por smoke de POST/PUT, cookies, CSRF e respostas de erro. Aumentar recursos a partir
de métricas; múltiplas instâncias só após validar sessões persistentes e conexões.

O próximo incremento sugerido é a fatia de autenticação e retomada do save.
Depois entram empacotamento de produção, configuração do Render e publicação.
