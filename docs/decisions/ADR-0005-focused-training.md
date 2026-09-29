# ADR-0005: Treino de fundamento com bônus por atleta

Regra de concessão atualizada pela [ADR-0006](ADR-0006-training-groups.md):
o bônus de +1 agora é concedido a cada cinco sessões do mesmo fundamento.

## Decisão

O treino do Benfica passa a melhorar em +1 o atributo efetivo escolhido, sem conceder XP.
O bônus pertence ao `owned_player`, é somado ao stat base e ao crescimento por nível e
é limitado a 99. Os seis bônus são colunas com constraints em V13. Partidas futuras
registram snapshots com esses valores; partidas já persistidas não são alteradas.

Uma sessão continua transacional e idempotente. O lock do perfil serializa comandos;
o intervalo de um minuto é consultado por perfil, impedindo alternar atletas para
contorná-lo. Sessões anteriores à V13 conservam o XP recebido e podem ser recuperadas
com a chave original. O cliente só envia o comando após cinco segundos de animação.

## Motivo

O usuário escolhe explicitamente um fundamento e espera ver esse fundamento melhorar.
Guardar bônus no atleta evita mudar a definição compartilhada de outros perfis e
mantém os snapshots históricos reproduzíveis.
