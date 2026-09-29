import Phaser from 'phaser'

import { GAME_DIMENSIONS } from './config/gameConfig'
import { BootScene } from './game/scenes/BootScene'
import { WorldScene } from './game/scenes/WorldScene'
import { MainMenuScene } from './game/scenes/MainMenuScene'
import { MatchScene } from './game/scenes/MatchScene'
import { StadiumScene } from './game/scenes/StadiumScene'
import { TeamScene } from './game/scenes/TeamScene'
import { InteriorScene } from './game/scenes/InteriorScene'
import './style.css'
import { gameAudio } from './game/audio/GameAudio'

gameAudio.install(document.getElementById('game')!)

export const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_DIMENSIONS.width,
  height: GAME_DIMENSIONS.height,
  backgroundColor: '#121a24',
  pixelArt: true,
  scene: [BootScene, MainMenuScene, WorldScene, InteriorScene, MatchScene, TeamScene, StadiumScene],
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 } },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
})
