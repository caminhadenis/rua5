import Phaser from 'phaser'
import { gameAudio } from '../audio/GameAudio'
import { PlayerWalkAnimation } from '../entities/PlayerWalkAnimation'
import { TouchControls } from '../input/TouchControls'
import { isPhonePortrait } from '../input/mobileViewport'
import { movementVelocity } from '../input/movement'
import { button, paragraph, scenePanel } from '../ui/ScenePanel'

export class GraduationScene extends Phaser.Scene {
  player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  private walk!: PlayerWalkAnimation
  private touch!: TouchControls
  private keys!: Record<'W' | 'A' | 'S' | 'D' | 'E' | 'ENTER', Phaser.Input.Keyboard.Key>
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private panel!: ReturnType<typeof scenePanel>
  private stage = 0
  private name = ''
  private free = false
  private diploma!: Phaser.GameObjects.Container

  constructor() { super('GraduationScene') }
  create(): void {
    gameAudio.setMusic('graduation')
    this.stage = 0
    this.name = ''
    this.free = false
    const art = this.add.graphics()
    art.fillStyle(0x344b52).fillRect(0, 0, 960, 540)
    art.fillStyle(0xbeb493).fillRect(60, 100, 840, 420)
    art.lineStyle(1, 0x8b8e76, 0.5)
    for (let x = 60; x < 900; x += 40) art.lineBetween(x, 100, x, 520)
    for (let y = 100; y < 520; y += 40) art.lineBetween(60, y, 900, y)
    art.fillStyle(0x697f72).fillRect(210, 126, 540, 122)
    art.fillStyle(0x384b43).fillRect(210, 242, 540, 12)
    art.fillStyle(0x816848).fillRect(460, 250, 40, 6).fillRect(450, 256, 60, 6)
    art.fillStyle(0x936d48).fillRect(422, 164, 40, 20)
    art.fillStyle(0x735038).fillRect(426, 184, 32, 24)
    art.fillStyle(0xf7d154).fillRect(437, 171, 10, 6)
    for (const x of [104, 816]) {
      art.fillStyle(0x799da1).fillRect(x, 125, 40, 70)
      art.fillStyle(0xe5d7b5).fillRect(x + 18, 125, 4, 70).fillRect(x, 156, 40, 4)
      art.fillStyle(0x856241).fillRect(x, 204, 44, 8)
    }
    this.add.text(480, 38, 'UNIVERSIDADE RUA 5', {
      fontFamily: 'monospace', fontSize: '28px', color: '#f7d154',
    }).setOrigin(0.5)
    this.add.text(480, 75, 'ESCOLA DE FORMAÇÃO DE TREINADORES', {
      fontFamily: 'monospace', fontSize: '16px', color: '#f5ead2',
    }).setOrigin(0.5)
    this.add.text(480, 139, 'TURMA DE NOVOS TREINADORES', {
      fontFamily: 'monospace', fontSize: '14px', color: '#fff4ce',
    }).setOrigin(0.5)
    this.add.image(442, 201, 'resident-elder').setDepth(201)
    // Two blocks of seated graduates leave an unobstructed aisle to the exit.
    const seats = this.physics.add.staticGroup()
    for (const [row, y] of [310, 375, 440].entries()) {
      for (const [column, x] of [190, 270, 350, 610, 690, 770].entries()) {
        const chair = this.add.rectangle(x, y + 6, 44, 18, 0x775643).setStrokeStyle(2, 0x473c32)
        this.physics.add.existing(chair, true)
        seats.add(chair)
        const texture = ['resident-student', 'resident', 'resident-sport'][(row + column) % 3]!
        this.add.image(x, y - 10, texture).setDepth(y).setCrop(0, 0, 32, 30)
        this.add.rectangle(x - 7, y + 5, 7, 8, 0x24354a).setDepth(y + 1)
        this.add.rectangle(x + 7, y + 5, 7, 8, 0x24354a).setDepth(y + 1)
      }
    }
    art.fillStyle(0x594639).fillRect(444, 495, 72, 25)
    this.add.text(480, 505, 'SAÍDA', { fontFamily: 'monospace', fontSize: '14px', color: '#f7d154' }).setOrigin(0.5)
    this.physics.world.setBounds(80, 155, 800, 365)
    this.player = this.physics.add.sprite(512, 213, 'coach', 'side-0').setFlipX(true)
      .setSize(18, 14).setOffset(7, 26).setCollideWorldBounds(true)
    this.walk = new PlayerWalkAnimation(this.player)
    this.walk.face('left')
    this.physics.add.collider(this.player, seats)
    const tube = this.add.rectangle(0, 0, 24, 7, 0xefe5c9).setStrokeStyle(1, 0x83613f)
    const ribbon = this.add.rectangle(0, 0, 4, 9, 0x984f47)
    this.diploma = this.add.container(468, 214, [tube, ribbon]).setDepth(300)
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,E,ENTER') as typeof this.keys
    const captured = this.input.keyboard!.manager.preventDefault
    this.input.keyboard!.disableGlobalCapture()
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.input.keyboard!.manager.preventDefault = captured })
    this.touch = new TouchControls(this, () => {
      if (this.player.body) this.player.setVelocity(0)
      this.walk.stop()
      this.input.keyboard?.resetKeys()
    })
    const animate = (_time: number, delta: number) => this.walk.update(!this.free, delta)
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, animate)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.POST_UPDATE, animate))
    this.panel = scenePanel(this, 'Formatura')
    this.panel.classList.add('story-dialogue')
    this.showSpeech()
  }
  private showSpeech(): void {
    this.panel.replaceChildren()
    paragraph(this.panel, 'REITOR AUGUSTO · UNIVERSIDADE RUA 5').className = 'story-speaker'
    if (this.stage === 1) {
      paragraph(this.panel, 'Parabéns pela sua formação como treinador, Sr./Sra. … Como deseja ser chamado?')
      const form = document.createElement('form')
      const input = document.createElement('input')
      input.setAttribute('aria-label', 'Seu nome')
      input.placeholder = 'Nome do treinador'
      input.maxLength = 40
      input.required = true
      const confirm = document.createElement('button')
      confirm.textContent = 'Confirmar nome'
      confirm.type = 'submit'
      form.append(input, confirm)
      form.onsubmit = event => {
        event.preventDefault()
        if (!input.value.trim()) return
        this.name = input.value.trim()
        this.stage++
        this.input.keyboard!.resetKeys()
        this.showSpeech()
      }
      this.panel.append(form)
      input.focus()
      return
    }
    const speeches = [
      'Seja bem-vindo à nossa cerimônia! Hoje você recebe o diploma e começa sua jornada como treinador. Seus colegas aguardam a vez de subir ao palco.',
      '',
      `Parabéns pela sua formação como treinador, ${this.name}! Receba seu canudo. Agora você está apto a orientar atletas e construir seu próprio time!`,
      'Nas ruas, você encontrará desafiantes. Converse com eles, escolha um atleta do seu elenco e dispute um duelo individual. Você acompanha a partida e seus jogadores ganham experiência.',
      'Venceu um desafiante? Poderá convidá-lo para o seu time. Explore o bairro, encontre novos jogadores e treine seus fundamentos no centro de treinamento.',
      'Saiba cadenciar o cansaço dos jogadores! Treinos e partidas desgastam cada atleta. Eles recuperam com o tempo; alterne quem joga e consulte a condição na tela Equipe.',
      'Para desafiar o treinador do estádio, você precisa ter pelo menos cinco jogadores no elenco. Ele vai recusar o desafio se seu time ainda estiver incompleto.',
      'No estádio, vença cinco duelos individuais consecutivos para conquistar a taça. Escolha um atleta por duelo; pode repetir ou trocar. Se perder, a sequência recomeça!',
      `Boa sorte, ${this.name}! Seu futuro começa nas ruas. Caminhe pelo corredor até a porta de saída. Há alguém lá fora esperando para ajudar você com o primeiro jogador.`,
    ]
    paragraph(this.panel, speeches[this.stage]!)
    button(this.panel, this.stage === speeches.length - 1 ? 'Encerrar cerimônia' : 'Próxima fala', () => this.advance())
    if (this.stage === 2) {
      gameAudio.play('diploma')
      this.tweens.add({ targets: this.diploma, x: 499, duration: 700, ease: 'Stepped', easeParams: [7] })
    }
  }
  private advance(): void {
    this.input.keyboard!.resetKeys()
    if (this.stage === 1) return
    if (this.stage === 8) {
      this.free = true
      this.panel.dispose()
      this.diploma.setVisible(false)
      this.add.text(480, 278, 'CAMINHE ATÉ A SAÍDA ↓', { fontFamily: 'monospace', fontSize: '16px', color: '#152b32' }).setOrigin(0.5)
      this.walk.face('down')
    } else { this.stage++; this.showSpeech() }
  }
  update(): void {
    if (!this.free || isPhonePortrait()) {
      this.touch.setContext({ visible: false })
      this.player.setVelocity(0)
      const focused = document.activeElement?.tagName
      if (Phaser.Input.Keyboard.JustDown(this.keys.ENTER) && focused !== 'INPUT' && focused !== 'BUTTON' && this.stage !== 1) this.advance()
      return
    }
    const nearExit = Math.abs(this.player.x - 480) < 42 && this.player.y > 463
    this.touch.setContext({ visible: true, movement: true, confirm: nearExit ? 'Sair' : undefined })
    if (nearExit && (this.touch.input.consume('confirm') || Phaser.Input.Keyboard.JustDown(this.keys.E) ||
      Phaser.Input.Keyboard.JustDown(this.keys.ENTER) || this.player.y > 490)) {
      this.input.keyboard!.resetKeys()
      this.scene.start('WorldScene', { onboarding: true, name: this.name })
      return
    }
    const touch = this.touch.input.directions
    const velocity = movementVelocity({
      left: this.cursors.left.isDown || this.keys.A.isDown || touch.left,
      right: this.cursors.right.isDown || this.keys.D.isDown || touch.right,
      up: this.cursors.up.isDown || this.keys.W.isDown || touch.up,
      down: this.cursors.down.isDown || this.keys.S.isDown || touch.down,
    })
    this.player.setVelocity(velocity.x, velocity.y).setDepth(this.player.y)
  }
}
