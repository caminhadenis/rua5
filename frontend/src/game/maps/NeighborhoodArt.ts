import type Phaser from 'phaser'

export function drawNeighborhoodArt(scene: Phaser.Scene, map: Phaser.Tilemaps.Tilemap): void {
  const tacticsHouse = map.getObjectLayer('houses')?.objects.find(object => object.name === 'benfica.house.01')
  if (tacticsHouse) {
    const x = (tacticsHouse.x ?? 0) + (tacticsHouse.width ?? 0) / 2
    const y = tacticsHouse.y ?? 0
    scene.add.text(x, y + 22, 'DONA AMÉLIA\nTÁTICAS', {
      fontFamily: 'monospace', fontSize: '14px', color: '#fff4ce', backgroundColor: '#204d43',
      align: 'center', padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 0).setDepth(3)
    const chalk = scene.add.graphics().setDepth(2)
    chalk.fillStyle(0x204d43).fillRect(x - 36, y + 97, 72, 42)
    chalk.lineStyle(2, 0xf5ead2).strokeRect(x - 30, y + 103, 60, 30)
    chalk.lineBetween(x, y + 103, x, y + 133).strokeCircle(x, y + 118, 8)
    chalk.lineStyle(2, 0xf7d154).lineBetween(x - 20, y + 118, x + 20, y + 118)
      .lineBetween(x + 20, y + 118, x + 13, y + 111)
  }
  scene.add.text(496, 1570, '↓ CENTRO DE RECUPERAÇÃO · TRILHA DO SUL', {
    fontFamily: 'monospace', fontSize: '14px', color: '#fff4ce', backgroundColor: '#152b32', padding: { x: 8, y: 4 },
  }).setOrigin(0.5).setDepth(2)
  const forest = scene.add.graphics().setDepth(1)
  for (let y = 1664; y < map.heightInPixels - 64; y += 112) {
    for (let x = 96; x < map.widthInPixels - 64; x += 128) {
      if (map.getTileAtWorldXY(x, y, false, undefined, 'collisions')?.index !== 5) continue
      forest.fillStyle(0x594639).fillRect(x - 5, y, 10, 24)
      forest.fillStyle(0x244b3b).fillCircle(x, y - 13, 27)
      forest.fillStyle(0x4a8052).fillCircle(x - 5, y - 19, 21)
      forest.fillStyle(0x67985c).fillRect(x - 13, y - 29, 12, 4)
    }
  }
  const eastCourt = map.getObjectLayer('landmarks')?.objects.find(object => object.name === 'eastCourt')
  if (eastCourt) {
    const { x = 0, y = 0, width = 0, height = 0 } = eastCourt
    const art = scene.add.graphics().setDepth(1)
    art.fillStyle(0x5b805e).fillRect(x, y, width, height)
    art.lineStyle(3, 0xf5ead2).strokeRect(x + 12, y + 12, width - 24, height - 24)
    art.lineBetween(x + 12, y + height / 2, x + width - 12, y + height / 2)
    art.strokeCircle(x + width / 2, y + height / 2, 42)
    scene.add.text(x + width / 2, y - 22, 'QUADRA DO LESTE', {
      fontFamily: 'monospace', fontSize: '15px', color: '#f5ead2', backgroundColor: '#152b32',
    }).setOrigin(0.5).setDepth(2)
  }
  const southSquare = map.getObjectLayer('landmarks')?.objects.find(object => object.name === 'southSquare')
  if (southSquare) {
    const { x = 0, y = 0, width = 0, height = 0 } = southSquare
    const art = scene.add.graphics().setDepth(1)
    art.fillStyle(0x426e59).fillRect(x, y, width, height)
    art.fillStyle(0xc2b391).fillRect(x + 16, y + height / 2 - 16, width - 32, 32)
    art.fillStyle(0xc2b391).fillRect(x + width / 2 - 16, y + 16, 32, height - 32)
    for (const [treeX, treeY] of [[54, 50], [width - 54, 50], [54, height - 50], [width - 54, height - 50]]) {
      art.fillStyle(0x274e42).fillCircle(x + treeX, y + treeY, 20)
      art.fillStyle(0x5b9b65).fillCircle(x + treeX - 4, y + treeY - 5, 15)
    }
    scene.add.text(x + width / 2, y - 22, 'PRAÇA DO SUL', {
      fontFamily: 'monospace', fontSize: '15px', color: '#f5ead2', backgroundColor: '#152b32',
    }).setOrigin(0.5).setDepth(2)
  }
  const stadium = map.getObjectLayer('landmarks')?.objects.find(object => object.name === 'stadium')
  if (stadium) {
    const { x = 0, y = 0, width = 0, height = 0 } = stadium
    const art = scene.add.graphics().setDepth(2).setName('benfica.stadium')
    art.fillStyle(0x1b3039).fillRect(x, y + 16, width, height - 16)
    art.fillStyle(0x64737a).fillRect(x - 12, y + 3, width + 24, 27)
    art.fillStyle(0x203e46).fillRect(x + 12, y - 12, width - 24, 21)
    art.fillStyle(0x789d68).fillRect(x + 38, y + 28, width - 76, 30)
    art.lineStyle(2, 0xf5ead2).strokeRect(x + 48, y + 31, width - 96, 24)
    art.fillStyle(0xf7d154).fillRect(x + 63, y + 5, 8, 15).fillRect(x + width - 71, y + 5, 8, 15)
    art.fillStyle(0xc2b391).fillRect(x + width / 2 - 22, y + 16, 44, 34)
    art.fillStyle(0x594639).fillRect(x + width / 2 - 17, y + 18, 34, 30)
    scene.add.text(x + width / 2, y + height - 22, 'ESTÁDIO DO BENFICA', { fontFamily: 'monospace', fontSize: '15px', color: '#f7d154', backgroundColor: '#152b32' })
      .setOrigin(0.5).setDepth(3)
  }
  const lake = map.getObjectLayer('landmarks')?.objects.find(object => object.name === 'lake')
  if (lake) {
    const { x = 0, y = 0, width = 0, height = 0 } = lake
    const art = scene.add.graphics().setDepth(1).setName('benfica.lake')
    art.fillStyle(0x345c4a).fillRoundedRect(x - 12, y - 12, width + 24, height + 24, 26)
    art.fillStyle(0x438ca2).fillRoundedRect(x, y, width, height, 22)
    art.fillStyle(0x79bdd0).fillRect(x + 40, y + 42, 96, 5).fillRect(x + 180, y + 92, 76, 5)
    art.fillStyle(0xe7d7a5).fillRect(x + width - 58, y + 27, 14, 5)
    scene.add.text(x + 8, y - 38, 'LAGO DO BENFICA', { fontFamily: 'monospace', fontSize: '15px', color: '#f5ead2', backgroundColor: '#152b32' }).setDepth(2)
  }
  for (const building of map.getObjectLayer('buildings')?.objects ?? []) {
    const { x = 0, y = 0, width = 0, height = 0 } = building
    const university = building.type === 'university'
    const school = building.type === 'school' || university
    const gym = building.type === 'gym'
    const recovery = building.type === 'recovery'
    const color = recovery ? 0xd6e7e1 : school ? 0xd1b17a : gym ? 0x739c94 : 0xb78374
    const roof = recovery ? 0x367e84 : school ? 0x8a5445 : gym ? 0x315761 : 0x574d65
    const art = scene.add.graphics().setDepth(1)
    art.fillStyle(color).fillRect(x, y + 25, width, height - 25)
    art.fillStyle(roof).fillRect(x - 6, y, width + 12, 32)
    for (let row = 0; row < (building.type === 'apartment' ? 2 : 1); row++) {
      for (let column = 0; column < 3; column++) {
        art.fillStyle(0x344b5b).fillRect(x + 24 + column * 66, y + 47 + row * 54, 35, 30)
        art.fillStyle(0x91c0c1).fillRect(x + 28 + column * 66, y + 51 + row * 54, 27, 22)
      }
    }
    art.fillStyle(0x594639).fillRect(x + width / 2 - 18, y + height - 45, 36, 45)
    art.fillStyle(0xf7d154).fillRect(x + width / 2 + 8, y + height - 23, 4, 4)
    if (recovery) {
      art.fillStyle(0xf5ead2).fillRect(x + width / 2 - 6, y + 38, 12, 34).fillRect(x + width / 2 - 17, y + 49, 34, 12)
    }
    if (university) {
      art.fillStyle(0x594639).fillRect(x + width / 2 - 18, y, 36, 34)
      art.fillStyle(0xc2b391).fillRect(x + width / 2 - 24, y - 12, 48, 12)
    }
    const title = university ? 'UNIVERSIDADE' : school ? 'ESCOLA' : gym ? 'CENTRO DE TREINO' : recovery ? 'CENTRO DE RECUPERAÇÃO' : 'PRÉDIO'
    scene.add.text(x + width / 2, y + (recovery ? 19 : 7), title, { fontFamily: 'monospace', fontSize: recovery ? '15px' : '17px', color: '#fff4ce' }).setOrigin(0.5).setDepth(2)
  }
}
