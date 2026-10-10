import Phaser from 'phaser'
import { PlayerWalkAnimation } from '../entities/PlayerWalkAnimation'
import { request, type Profile } from '../../api/gameApi'
import { createIdempotencyKey } from '../../api/idempotencyKey'
import { applyTeamColors, type TeamColors } from '../team/teamColors'
import { button, paragraph, scenePanel } from './ScenePanel'
import { teamColorPicker } from './TeamColorPicker'
import { starterPicker } from './StarterPicker'
import { starterAdvice } from './starterAdvice'

export function welcomeCoach(scene: Phaser.Scene, player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody,
  name: string, existingProfile: Profile | undefined, complete: () => void,
  guide: (mentor: Phaser.GameObjects.Sprite, arrived: () => void) => boolean, enterTraining: () => void): void {
  const mentor = scene.add.sprite(player.x + 84, player.y, 'walking-resident-cap', 'front-0').setDepth(player.y).setName('miguel')
  const walk = new PlayerWalkAnimation(mentor)
  mentor.setData('walkAnimation', walk).setData('walking', true)
  const animate = (_time: number, delta: number) => {
    if (mentor.active) walk.update(!mentor.getData('walking'), delta, Boolean(mentor.getData('walking')))
  }
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, animate)
  const stopAnimating = () => scene.events.off(Phaser.Scenes.Events.POST_UPDATE, animate)
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, stopAnimating)
  const panel = scenePanel(scene, 'Boas-vindas ao bairro')
  panel.classList.add('story-dialogue')
  paragraph(panel, 'Um homem se aproxima da universidade…')
  const key = createIdempotencyKey()
  let profile = existingProfile
  const finish = () => {
    restore()
    scene.events.off('shutdown', restore)
    panel.dispose()
    stopAnimating()
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, stopAnimating)
    mentor.destroy()
    scene.input.keyboard?.resetKeys()
    complete()
  }
  const speech = (text: string) => {
    panel.classList.remove('starter-selection-panel')
    panel.classList.add('story-dialogue')
    panel.replaceChildren()
    paragraph(panel, 'MIGUEL · OLHEIRO DO BAIRRO').className = 'story-speaker'
    paragraph(panel, text)
  }
  const arrived = () => {
    panel.hidden = false
    speech('Chegamos ao Centro de Treinamento! Entre pela porta e conheça a treinadora Jo. Há cinco setores: velocidade, drible, finalização, marcação e físico. Cada sessão melhora um fundamento em +0,25, sem mudar o nível. O T no minimapa marca este prédio; E é o estádio e R é o centro de recuperação.')
    button(panel, 'Entrar no centro de treinamento', () => { finish(); enterTraining() })
    button(panel, 'Explorar o bairro', finish)
  }
  const offerTour = () => {
    speech('Para subir o nível dos jogadores, dispute desafios nas ruas: eles rendem XP, e as vitórias rendem mais. Explore novos adversários, pois revanches rendem menos XP. No Centro de Treinamento você melhora os fundamentos, sem ganhar XP. Quer que eu acompanhe você até lá?')
    button(panel, 'Conhecer o centro de treinamento', () => {
      panel.hidden = true
      if (!guide(mentor, arrived)) {
        panel.hidden = false
        speech('O caminho está ocupado agora. Você encontra o Centro de Treinamento pelo T no minimapa. Caminhe até a porta para entrar; a treinadora Jo vai receber você!')
        button(panel, 'Explorar o bairro', finish)
      }
    })
    button(panel, 'Explorar o bairro', finish)
  }
  const selectPlayer = () => {
    panel.classList.remove('story-dialogue')
    panel.classList.add('starter-selection-panel')
    void starterPicker(scene, panel, profile!, starter => {
      speech(starterAdvice(starter))
      button(panel, 'Próxima orientação', () => {
        speech('Você pode ver todos os seus jogadores no menu Equipe, na seção Elenco. Use o botão Equipe ou a tecla T. Lá você consulta o nível, o XP, os atributos e o cansaço de cada atleta. Quando vencer um desafiante, poderá convidá-lo para completar seu time de até cinco jogadores.')
        button(panel, 'Próxima orientação', offerTour)
      })
    })
  }
  const chooseColors = () => {
    panel.classList.remove('story-dialogue')
    teamColorPicker(panel, colors => { void create(colors) })
    const greeting = document.createElement('p')
    greeting.textContent = `Miguel: ${name}, como devem ser as cores do seu time?`
    greeting.className = 'story-speaker'
    panel.prepend(greeting)
  }
  const create = async (colors: TeamColors) => {
    panel.replaceChildren()
    paragraph(panel, 'Preparando seu time…')
    try {
      profile = await request<Profile>('/profile/new-game', { displayName: name, ...colors }, key)
      await applyTeamColors(scene, profile)
      if (!scene.scene.isActive()) return
      scene.registry.set('profileId', profile.id)
      selectPlayer()
    } catch {
      if (!scene.scene.isActive()) return
      panel.replaceChildren()
      paragraph(panel, 'Não foi possível preparar seu time. Tente novamente para recuperar a mesma jornada.')
      button(panel, 'Tentar novamente', () => { void create(colors) })
    }
  }
  const capture = scene.input.keyboard?.manager.preventDefault
  scene.input.keyboard?.disableGlobalCapture()
  const restore = () => {
    if (scene.input.keyboard && capture !== undefined) scene.input.keyboard.manager.preventDefault = capture
  }
  scene.events.once('shutdown', restore)
  scene.tweens.add({ targets: mentor, x: player.x + 40, duration: 800, ease: 'Linear', onComplete: () => {
    if (!scene.scene.isActive()) return
    mentor.setData('walking', false)
    walk.face('left')
    player.setFrame('side-0').setFlipX(false)
    panel.replaceChildren()
    paragraph(panel, 'MIGUEL · OLHEIRO DO BAIRRO').className = 'story-speaker'
    paragraph(panel, `Parabéns pela formatura, ${name}! Sou Miguel. Vou ajudar você a começar: escolha um dos três jogadores iniciantes para o seu time.`)
    button(panel, profile ? 'Escolher primeiro jogador' : 'Conversar sobre meu time', profile ? selectPlayer : chooseColors)
  } })
}
