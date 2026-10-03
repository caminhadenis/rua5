/** Separate stands keep every spectator and accessory outside the playing surface. */
export function surroundWithStands(arena: HTMLElement): void {
  const theater = document.createElement('div')
  theater.className = 'stadium-theater'
  arena.replaceWith(theater)
  theater.append(arena)
  const skins = ['#986445', '#e5b68c', '#c68259', '#6e493b']
  const hair = ['#312d35', '#754931', '#c9c2b3', '#272633']
  let index = 0
  for (const [side, count] of [['top', 6], ['left', 2], ['right', 2], ['bottom', 6]] as const) {
    const stand = document.createElement('div')
    stand.className = `stadium-crowd stadium-stand stand-${side}`
    stand.setAttribute('role', 'img')
    stand.setAttribute('aria-label', 'Torcedores do time de Dimas na arquibancada, fora da quadra, com bandeiras e uniformes vermelhos e creme')
    for (let slot = 0; slot < count; slot++, index++) {
      const fan = document.createElement('span')
      fan.className = `stadium-fan ${index % 3 === 0 ? 'waves-flag' : 'waves-arms'}`
      fan.style.setProperty('--cheer-delay', `${-(index % 5) * 0.18}s`)
      fan.style.setProperty('--fan-skin', skins[index % skins.length]!)
      fan.style.setProperty('--fan-hair', hair[index % hair.length]!)
      fan.innerHTML = `<svg class="fan-avatar" viewBox="0 0 32 40" aria-hidden="true" shape-rendering="crispEdges">
        <path fill="#24354a" d="M9 27h6v10H9zM18 27h6v10h-6z"/>
        <path fill="#f5ead2" d="M7 35h8v4H7zM18 35h8v4h-8z"/>
        <path fill="var(--fan-skin)" d="M10 5h13v13H10zM13 15h7v6h-7z"/>
        <path fill="var(--fan-hair)" d="M8 2h16v7H8zM8 7h4v6H8zM20 7h4v6h-4z"/>
        <path fill="#24354a" d="M12 11h2v2h-2zM19 11h2v2h-2z"/>
        <path fill="#f5ead2" d="M14 15h5v2h-5z"/>
        <path fill="#984f47" d="M8 19h17v12H8z"/>
        <path fill="#f5ead2" d="M12 19h9v3h-9zM15 24h3v5h-3z"/>
        <g class="fan-arm arm-left"><path fill="var(--fan-skin)" d="M3 19h5v12H3z"/><path fill="#984f47" d="M3 19h5v5H3z"/></g>
        <g class="fan-arm arm-right"><path fill="var(--fan-skin)" d="M25 19h5v12h-5z"/><path fill="#984f47" d="M25 19h5v5h-5z"/></g>
      </svg>`
      if (index % 3 === 0) fan.insertAdjacentHTML('beforeend', '<span class="fan-flag" aria-hidden="true"></span>')
      stand.append(fan)
    }
    if (side === 'bottom') {
      const banner = document.createElement('span')
      banner.className = 'stadium-support-banner'
      banner.textContent = 'VAMOS, DIMAS!'
      stand.append(banner)
    }
    theater.append(stand)
  }
}
