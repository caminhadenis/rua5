import Phaser from 'phaser'

import { GAME_DIMENSIONS } from './config/gameConfig'
import { BootScene } from './game/scenes/BootScene'
import { WorldScene } from './game/scenes/WorldScene'
import { GraduationScene } from './game/scenes/GraduationScene'
import { MainMenuScene } from './game/scenes/MainMenuScene'
import { MatchScene } from './game/scenes/MatchScene'
import { StadiumScene } from './game/scenes/StadiumScene'
import { TeamScene } from './game/scenes/TeamScene'
import { InteriorScene } from './game/scenes/InteriorScene'
import './style.css'
import './mobile-panels.css'
import './opening.css'
import { gameAudio } from './game/audio/GameAudio'
import { installMobileViewport } from './game/input/mobileViewport'

const disposeMobileViewport = installMobileViewport()
gameAudio.install(document.getElementById('game')!)

export const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_DIMENSIONS.width,
  height: GAME_DIMENSIONS.height,
  backgroundColor: '#121a24',
  pixelArt: true,
  scene: [BootScene, MainMenuScene, GraduationScene, WorldScene, InteriorScene, MatchScene, TeamScene, StadiumScene],
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 } },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
})

// The exploration controls reserve space beside the canvas on phones.
const resize = new ResizeObserver(() => {
  game.scale.getParentBounds()
  game.scale.refresh()
})
resize.observe(document.getElementById('game')!)
game.events.once(Phaser.Core.Events.DESTROY, () => {
  resize.disconnect()
  disposeMobileViewport()
  gameAudio.dispose()
})
