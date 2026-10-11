import type Phaser from 'phaser'

export function drawTacticsRoom(scene: Phaser.Scene, player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody): void {
  const board = scene.add.rectangle(480, 202, 276, 103, 0x805f43).setDepth(2)
  scene.physics.add.existing(board, true)
  scene.physics.add.collider(player, board)
  const chalk = scene.add.graphics().setDepth(2).setName('tactics-board')
  chalk.fillStyle(0x204d43).fillRect(350, 157, 260, 87)
  chalk.lineStyle(2, 0xf5ead2).strokeRect(364, 171, 90, 57)
  chalk.lineBetween(409, 171, 409, 228).strokeCircle(409, 200, 13)
  for (const [x, y] of [[386, 190], [430, 210], [389, 215]]) chalk.strokeCircle(x!, y!, 4)
  chalk.lineStyle(2, 0xf7d154).lineBetween(386, 190, 430, 190)
    .lineBetween(430, 190, 423, 184).lineBetween(430, 190, 423, 196)
  scene.add.text(477, 174, 'RITMO\nATAQUE\nDEFESA', {
    fontFamily: 'monospace', fontSize: '15px', color: '#fff4ce', lineSpacing: 4,
  }).setDepth(3)
  scene.add.text(480, 266, 'MURAL DE TÁTICAS', {
    fontFamily: 'monospace', fontSize: '12px', color: '#f7d154', backgroundColor: '#152b32', padding: { x: 6, y: 3 },
  }).setOrigin(0.5).setDepth(3)
  // Original pennants, a trophy and a keepsake of her former pupil.
  for (const x of [122, 850]) {
    scene.add.triangle(x, 125, 0, 0, 35, 0, 17, 44, 0xd6b36b).setStrokeStyle(2, 0xf5ead2)
  }
  const trophy = scene.add.graphics().setDepth(3)
  trophy.fillStyle(0xf7d154).fillRect(163, 148, 20, 16).fillRect(171, 162, 4, 12).fillRect(162, 174, 22, 5)
  trophy.lineStyle(3, 0xf7d154).strokeCircle(161, 155, 6).strokeCircle(185, 155, 6)
  scene.add.rectangle(745, 290, 140, 58, 0x805f43).setStrokeStyle(3, 0xd6b36b).setDepth(2)
  scene.add.text(745, 290, 'DIMAS\nMEU EX-ALUNO', {
    fontFamily: 'monospace', fontSize: '12px', color: '#fff4ce', align: 'center', lineSpacing: 6,
  }).setOrigin(0.5).setDepth(3)
}
