import { isPhoneDevice } from './TouchInput'

export const isPhone = () => document.documentElement.classList.contains('is-phone')
export const isPhonePortrait = () => isPhone() && window.innerHeight > window.innerWidth

export function installMobileViewport(): () => void {
  const coarse = window.matchMedia('(any-pointer: coarse)')
  const rotate = document.createElement('section')
  rotate.className = 'phone-rotate'
  rotate.setAttribute('aria-label', 'Orientação do celular')
  const icon = document.createElement('span')
  icon.textContent = '↻'
  icon.setAttribute('aria-hidden', 'true')
  const title = document.createElement('h1')
  title.textContent = 'Vire o celular para jogar'
  const description = document.createElement('p')
  description.textContent = 'Na horizontal, você usa o direcional à esquerda e as ações à direita.'
  rotate.append(icon, title, description)
  document.body.append(rotate)

  const fullscreen = document.createElement('button')
  fullscreen.className = 'phone-fullscreen'
  fullscreen.textContent = 'Tela cheia'
  fullscreen.hidden = !document.fullscreenEnabled
  fullscreen.onclick = () => {
    const request = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()
    void request.catch(() => { /* Fullscreen is optional; landscape works without it. */ })
  }
  const refreshFullscreen = () => { fullscreen.textContent = document.fullscreenElement ? 'Sair da tela cheia' : 'Tela cheia' }
  document.body.append(fullscreen)
  const refresh = () => {
    document.documentElement.classList.toggle('is-phone', isPhoneDevice(coarse.matches, screen.width, screen.height))
    rotate.hidden = !isPhonePortrait()
    window.dispatchEvent(new Event('mobile-viewport-change'))
  }
  refresh()
  coarse.addEventListener('change', refresh)
  window.addEventListener('resize', refresh)
  document.addEventListener('fullscreenchange', refreshFullscreen)
  return () => {
    coarse.removeEventListener('change', refresh)
    window.removeEventListener('resize', refresh)
    document.removeEventListener('fullscreenchange', refreshFullscreen)
    rotate.remove()
    fullscreen.remove()
    document.documentElement.classList.remove('is-phone', 'phone-exploring')
  }
}
