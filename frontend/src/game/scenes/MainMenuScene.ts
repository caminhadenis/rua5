import Phaser from 'phaser'
import { gameAudio } from '../audio/GameAudio'
import { ApiError, request, type Profile } from '../../api/gameApi'
import { applyTeamColors } from '../team/teamColors'
import { loadLocation } from '../save/location'
import { button, paragraph, scenePanel } from '../ui/ScenePanel'
import { loadAuth, signOut, type AuthStatus } from '../../api/auth'
import { accountPanel } from '../ui/AccountPanel'
import { coachedApi } from '../../api/coachedMatches'

export class MainMenuScene extends Phaser.Scene {
  constructor() { super('MainMenuScene') }
  create(): void {
    gameAudio.setMusic('menu')
    this.drawCourt()
    const panel = scenePanel(this, 'Menu Rua 5')
    panel.classList.add('title-menu')
    const title = document.createElement('h1')
    title.textContent = 'Rua 5'
    panel.append(title)
    paragraph(panel, 'CADA RUA, UMA NOVA HISTÓRIA.').className = 'title-tagline'
    const actions = document.createElement('nav')
    actions.setAttribute('aria-label', 'Menu principal')
    panel.append(actions)
    const start = button(actions, 'INICIAR', () => { this.registry.remove('profileId'); this.scene.start('GraduationScene') })
    start.disabled = true
    const resume = button(actions, 'CONTINUAR', () => { void continueGame() })
    resume.disabled = true
    const options = button(actions, 'OPÇÕES', () => {})
    options.disabled = true
    const status = paragraph(panel, 'Conectando ao jogo… O primeiro acesso pode levar um minuto.')
    status.setAttribute('role', 'status')
    let profile: Profile | undefined
    const load = async () => {
      panel.querySelector('[data-retry]')?.remove()
      try {
        profile = await request<Profile>('/profile')
        if (!this.scene.isActive()) return
        resume.disabled = false
        status.textContent = `Jornada de ${profile.displayName} disponível.`
      } catch (error) {
        if (!this.scene.isActive()) return
        status.textContent = error instanceof ApiError && error.code === 'PROFILE_NOT_FOUND'
          ? 'Sua jornada começa aqui.' : 'Não foi possível consultar sua jornada salva.'
        if (!(error instanceof ApiError && error.code === 'PROFILE_NOT_FOUND')) {
          button(panel, 'Tentar novamente', () => { void load() }).dataset.retry = 'true'
        }
      }
    }
    const continueGame = async () => {
      if (!profile || resume.disabled) return
      resume.disabled = true
      try {
        // Fetch fresh state: another tab may have advanced or started a new journey.
        const current = await request<Profile>('/profile')
        const coachedResume = current.starterSelected ? await coachedApi.active() : null
        await applyTeamColors(this, current)
        if (!this.scene.isActive()) return
        this.registry.set('profileId', current.id)
        this.scene.start('WorldScene', current.starterSelected
          ? { location: loadLocation(current.id), coachedResume: coachedResume ?? undefined }
          : { onboarding: true, profile: current, name: current.displayName })
      } catch {
        resume.disabled = false
        status.textContent = 'Não foi possível continuar. Tente novamente.'
      }
    }
    const ready = (account: AuthStatus) => {
      if (!this.scene.isActive()) return
      start.disabled = false
      if (account.enabled) {
        paragraph(panel, `Conta: ${account.email ?? ''}`).className = 'account-email'
        const logout = button(panel, 'Sair da conta', () => {
          logout.disabled = true
          void signOut().then(() => { this.scene.restart() }).catch(() => { logout.disabled = false; status.textContent = 'Não foi possível sair. Tente novamente.' })
        })
        logout.classList.add('account-logout')
      }
      void load()
    }
    const connect = async () => {
      panel.querySelector('[data-connect-retry]')?.remove()
      try {
        const account = await loadAuth()
        if (!this.scene.isActive()) return
        if (account.enabled && !account.authenticated) {
          actions.hidden = true
          status.textContent = 'Entre ou crie sua conta para jogar.'
          accountPanel(panel, current => { actions.hidden = false; ready(current) })
        } else ready(account)
      } catch {
        if (!this.scene.isActive()) return
        status.textContent = 'Não foi possível conectar ao jogo.'
        button(panel, 'Tentar conectar novamente', () => { void connect() }).dataset.connectRetry = 'true'
      }
    }
    void connect()
  }

  private drawCourt(): void {
    const art = this.add.graphics()
    // Integer coordinates and stepped markings keep the overhead court pixelated.
    art.fillStyle(0x293a3e).fillRect(0, 0, 960, 540)
    for (let x = 0; x < 960; x += 48) {
      for (let y = 0; y < 540; y += 48) {
        art.fillStyle(0x33464a).fillRect(x + 4, y + 4, 40, 40)
      }
    }
    art.fillStyle(0x17292d).fillRect(84, 32, 800, 480)
    art.fillStyle(0x45787c).fillRect(92, 40, 776, 460)
    art.fillStyle(0x397b59).fillRect(128, 64, 704, 412)
    for (let x = 128; x < 832; x += 88) {
      art.fillStyle((x - 128) % 176 === 0 ? 0x438964 : 0x397b59)
        .fillRect(x, 64, 88, 412)
    }
    art.lineStyle(4, 0xe9e5c6)
    art.strokeRect(144, 80, 672, 380)
    art.lineBetween(480, 80, 480, 460)
    const circle = [
      [456, 206], [504, 206], [504, 214], [524, 214], [524, 226],
      [536, 226], [536, 246], [544, 246], [544, 294], [536, 294],
      [536, 314], [524, 314], [524, 326], [504, 326], [504, 334],
      [456, 334], [456, 326], [436, 326], [436, 314], [424, 314],
      [424, 294], [416, 294], [416, 246], [424, 246], [424, 226],
      [436, 226], [436, 214], [456, 214],
    ].map(([x, y]) => new Phaser.Math.Vector2(x, y))
    art.strokePoints(circle, true)
    art.strokeRect(144, 174, 112, 192)
    art.strokeRect(704, 174, 112, 192)
    art.strokeRect(144, 218, 40, 104)
    art.strokeRect(776, 218, 40, 104)
    art.fillStyle(0xe9e5c6)
    for (const x of [224, 480, 736]) art.fillRect(x - 4, 266, 8, 8)
    for (const x of [104, 816]) {
      art.fillStyle(0x142a30).fillRect(x, 230, 40, 88)
      art.lineStyle(2, 0x91b2ad)
      for (let netX = x + 8; netX < x + 40; netX += 8) art.lineBetween(netX, 226, netX, 314)
      for (let y = 234; y < 314; y += 8) art.lineBetween(x, y, x + 40, y)
      art.lineStyle(4, 0xf9f0d4).strokeRect(x, 226, 40, 88)
    }
    // Sideline benches, cones and a ball give the court a neighborhood feel.
    for (const x of [192, 640]) {
      art.fillStyle(0x142a30).fillRect(x + 4, 496, 128, 16)
      art.fillStyle(0xb08855).fillRect(x, 492, 128, 12)
      art.fillStyle(0x71543e).fillRect(x + 12, 504, 8, 8).fillRect(x + 108, 504, 8, 8)
    }
    for (const x of [116, 832]) {
      art.fillStyle(0xdd8a46).fillRect(x, 104, 12, 12)
      art.fillStyle(0xf2b266).fillRect(x + 4, 100, 4, 8)
    }
    art.fillStyle(0x18352d).fillRect(764, 404, 20, 20)
    art.fillStyle(0xf4ebce).fillRect(760, 396, 20, 20)
    art.fillStyle(0x263b3d).fillRect(768, 400, 8, 8).fillRect(760, 408, 4, 4).fillRect(776, 412, 4, 4)
  }
}
