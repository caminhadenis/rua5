# Placeholders do bairro

Estes SVGs foram desenhados originalmente para este projeto com formas simples, sem assets
de terceiros. São placeholders editáveis, renderizados como texturas pelo Phaser.

- `tiles.svg`: atlas horizontal de 160 × 32 px, cinco tiles de 32 × 32 px, sem margem/espaçamento.
  Ordem: grama, calçamento, quadra, alvenaria e cerca viva.
- `src/assets/placeholders/coach.svg`: avatar fixo controlado pelo usuário, pardo e de cabelo preto,
  com polo, bermuda, tênis e apito. Tem 128 × 120 px e doze quadros de 32 × 40 px;
  não recebe as cores do time nem muda com o starter. É rasterizado antes do recorte.
- `rua5-logo.svg`: nome original do jogo com letras de 5 × 7 pixels, usado no menu.
- `src/assets/placeholders/player.svg`: spritesheet dos atletas, de 128 × 120 px, com quadros de 32 × 40 px. As linhas são
  frente, lateral direita (espelhada para esquerda) e costas. Cada linha tem quatro fases:
  pernas alinhadas, passada esquerda, pernas alinhadas e passada direita. Braços alternam
  e o corpo oscila 1 px; a sombra e a caixa de colisão permanecem estáveis.
- `src/assets/placeholders/challenger.svg`: Nilo, camisa coral, 32 × 40 px.
- `src/assets/placeholders/duel-emotions.svg`: sheet de 64 × 80 px, quadros de 32 × 40 px. Colunas: feliz
  com braços levantados, triste/cabisbaixo. Linhas: jogador amarelo, Nilo coral.
  Usado como fundo CSS no duelo, mantendo os sprites do mapa independentes.

Para trocar a arte, mantenha as dimensões, nomes e ordem dos tiles. Se mudar o formato para
PNG, atualize os caminhos e o carregamento em `BootScene.ts`, além da imagem do tileset em
`src/assets/maps/benfica.json`. A colisão dos personagens usa uma caixa de 18 × 14 px junto aos
pés (offset 7, 26); adapte-a em `WorldScene.ts` caso as dimensões mudem.
`BootScene.ts` registra os quadros da caminhada. `PlayerWalkAnimation.ts` acompanha a distância
real percorrida após a física: a passada para no repouso, nas paredes e durante o diálogo.

O mapa é estático e editável no Tiled. Mover o objeto de spawn/interação preservando seu
`spawnKey` move o personagem/NPC sem alterar IDs. O objeto `court` da camada `landmarks`
define o retângulo usado para desenhar as linhas da quadra. Nomes e diálogo do NPC ficam
em `src/game/maps/interactions.ts`; esse conteúdo é apenas apresentação, sem regras de
disponibilidade, partida ou progresso.

- `house.svg`: exterior original de casa (96 × 80 px); as quatro casas usam retângulos
  autorados na camada `houses`, sobre áreas sólidas já existentes.
- `resident.svg`: morador original (32 × 40 px), com roupa casual; conversa manual.
- As variantes de uniforme são produzidas a partir dos SVGs locais em `teamColors.ts`.
  Apenas roupas são recoloridas; os SVGs originais continuam servindo os adversários.

`resident-physio.svg` e `resident-masseur.svg` são avatares pixelados originais dos profissionais do Centro de Recuperação. Macas, baldes de gelo e a vegetação da trilha são desenhados em código no Phaser.

Os moradores também possuem variantes originais de vestido, barba, trança, boné e
cabelo cacheado em SVG 32×40. Os desafiantes ganharam coque, boné e barba; essas
silhuetas seguem o sistema de uniformes nos cartões e duelos. Nenhum asset externo
ou gerado em runtime é necessário.
