# ADR-0015 — Limite de cinco atletas e dispensa no mapa

## Status

Accepted

## Context

O usuário pediu um limite de cinco jogadores e a possibilidade de dispensar qualquer
atleta pelo menu, fazendo-o virar um desafiante no lugar da dispensa.

## Decision

O elenco ativo tem no máximo cinco atletas, incluindo o starter. `RosterPolicy` e
um trigger PostgreSQL guardam inserções/reativações; o lock existente de perfil
serializa recrutamento, dispensa e comandos de progresso. Convites com elenco cheio
recebem `ROSTER_FULL` e mantêm sua disponibilidade; retries já confirmados precedem
essa validação. A V24 é uma nova migration e não altera migrations anteriores.

Dispensar desativa OwnedPlayer, sem apagar progresso ou histórico. `released_player`
guarda a posição no Benfica e a identidade do challenger por perfil. NPCs recrutados
voltam na posição da dispensa para essa jornada; outros usuários veem seu spawn usual.
Starters recebem um challenger privado. O frontend combina conteúdo estático com a
listagem privada, oculta o spawn anterior e não modifica o mapa estático. A geometria
é validada por mapa e limites; atributos e nível continuam autoritativos.

A Equipe está disponível na rua e nos interiores. Dispensas em interiores usam a
posição externa da entrada. É possível dispensar o último atleta e recontratá-lo
imediatamente: `recruitment_by_dismissal` registra essa elegibilidade sem forjar
vitórias. Recontratar reativa a mesma identidade, preservando nível, XP, treinos,
histórico e recuperação de cansaço. Duelo contra dispensado usa esses atributos.
Referências na lineup legada são removidas e novos comandos exigem atleta ativo.

A dispensa usa recibo durável por perfil/chave de idempotência. Retry após recontratar
não dispensa novamente; payload diferente com a mesma chave é conflito. A interface
mantém o mesmo comando após resposta incerta e repete só as consultas após confirmação.

## Consequences

Saves legados com mais de cinco atletas não são truncados: bloqueiam novas contratações
até o treinador abrir uma vaga. O histórico persiste sem recriar atletas ou recompensas.
Nenhuma política de XP, engine ou cadeia de troféus muda. Não há novos serviços.

## Alternatives considered

Excluir OwnedPlayer perderia progresso e quebraria referências históricas. Retornar
sempre ao spawn original não atenderia o ponto da dispensa. Bloquear a dispensa do
starter ou do último jogador contrariaria a escolha livre solicitada; convite imediato
permite recuperar um elenco vazio sem exigir uma partida impossível.
