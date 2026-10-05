# ADR-0007: Treino dentro do centro de treinamento

## Decisão

O acesso aos cinco fundamentos passa do ponto externo `benfica.training.01` para o
interior do prédio `benfica.gym.entry`. O interior apresenta cinco setores fixos,
treinadores e atletas em atividade. Conversar com o treinador de um setor permite
iniciar o treino daquele fundamento; a animação de cinco segundos e o comando REST
autoritativo existentes são reutilizados. A treinadora Jo explica as regras na entrada.

O antigo ponto do mapa e sua marcação externa são removidos. O progresso, o intervalo e as recompensas
continuam definidos pelo backend, sem mudança no contrato da API ou no banco.

## Motivo

O centro funciona como local explorável do jogo, com cada modalidade identificável
antes de escolher o atleta.
