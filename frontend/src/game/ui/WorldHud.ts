import Phaser from 'phaser'
import type { RosterPlayer } from '../../api/gameApi'

export class WorldHud {
  private readonly rosterText: Phaser.GameObjects.Text
  private readonly prompt: Phaser.GameObjects.Text
  private readonly dialogue: Phaser.GameObjects.Container
  private readonly challengeButton: Phaser.GameObjects.Text
  private readonly dialogueText: Phaser.GameObjects.Text
  private readonly objective: Phaser.GameObjects.Text
  private completed = false
    isDialogueOpen = false
  canChallenge = false

  constructor(scene: Phaser.Scene, onChallenge: () => void) {
    scene.add.rectangle(16, 16, 410, 78, 0x152b32, 0.95)
      .setOrigin(0).setScrollFactor(0).setDepth(1000)
    scene.add.text(32, 27, 'BENFICA · QUADRA DA ESQUINA', {
      fontFamily: 'monospace', fontSize: '20px', color: '#f7d154',
    }).setScrollFactor(0).setDepth(1001)
    this.rosterText = scene.add.text(32, 59, 'Explore e encontre Nilo na quadra →', {
      fontFamily: 'monospace', fontSize: '16px', color: '#f5ead2',
    }).setScrollFactor(0).setDepth(1001)
    scene.add.text(24, scene.scale.height - 32, 'Setas / WASD: andar   E / Enter: conversar   Esc: fechar', {
      fontFamily: 'monospace', fontSize: '16px', color: '#ffffff',
      backgroundColor: '#152b32', padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(1001)

    this.objective = scene.add.text(24, 106, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#f7d154',
      backgroundColor: '#152b32', padding: { x: 8, y: 6 },
    }).setScrollFactor(0).setDepth(1001)
    this.updateObjective()

    this.prompt = scene.add.text(scene.scale.width / 2, scene.scale.height - 76, '', {
      fontFamily: 'monospace', fontSize: '20px', color: '#152b32',
      backgroundColor: '#f7d154', padding: { x: 12, y: 8 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1001).setVisible(false)

    const panel = scene.add.rectangle(0, 0, scene.scale.width - 48, 180, 0x152b32)
      .setOrigin(0).setStrokeStyle(3, 0xf7d154)
    this.dialogueText = scene.add.text(24, 18, '', {
      fontFamily: 'monospace', fontSize: '20px', color: '#f5ead2',
      lineSpacing: 6, wordWrap: { width: scene.scale.width - 100 },
    })
    const close = scene.add.text(scene.scale.width - 80, 147, 'E / Esc: voltar ao bairro', {
      fontFamily: 'monospace', fontSize: '16px', color: '#f7d154',
    }).setOrigin(1, 0)
    this.challengeButton = scene.add.text(24, 140, '[ DESAFIAR · Enter ]', {
      fontFamily: 'monospace', fontSize: '20px', color: '#f7d154',
    }).setInteractive({ useHandCursor: true }).on('pointerdown', onChallenge)
    this.dialogue = scene.add.container(24, scene.scale.height - 234, [panel, this.dialogueText, close, this.challengeButton])
      .setScrollFactor(0).setDepth(1002).setVisible(false)
  }

  setRoster(roster: RosterPlayer[]): void {
    this.updateObjective()
    const player = roster[0]
    if (player) this.rosterText.setText(`${player.name} · Nv. ${player.level} · ${player.xp}/${player.xpToNextLevel ?? 'máx'} XP`)
  }

  setCompleted(completed: boolean): void {
    this.completed = completed
    this.updateObjective()
  }

  private updateObjective(): void {
    this.objective.setText(this.completed
      ? '★ Taça do Benfica conquistada! Bairro concluído.'
      : 'Objetivo: prepare seu atleta · Vença 5 duelos seguidos no estádio ↘')
  }

  showPrompt(nearby: boolean, action = 'Conversar'): void {
    this.prompt.setText(`E / Enter · ${action}`)
      .setVisible(nearby && !this.isDialogueOpen)
  }

  openDialogue(name: string, text: string, rematch = false, kind: 'challenger' | 'resident' = 'challenger'): void {
    this.canChallenge = kind === 'challenger'
    this.challengeButton.setVisible(this.canChallenge)
    this.challengeButton.setText(rematch ? '[ REVANCHE · Enter ]' : '[ DESAFIAR · Enter ]')
    this.isDialogueOpen = true
    this.prompt.setVisible(false)
    this.dialogueText.setText(`${name} · ${this.canChallenge ? 'Desafiante' : 'Morador'}\n${text}`)
    this.dialogue.setVisible(true)
  }

  closeDialogue(): void {
    this.isDialogueOpen = false
    this.canChallenge = false
    this.dialogue.setVisible(false)
  }
}
