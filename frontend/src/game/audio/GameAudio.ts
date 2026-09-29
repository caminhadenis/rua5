/** Original synthesized cues. Audio is optional and never gates gameplay. */
class GameAudio {
  private context?: AudioContext
  private muted = false

  install(parent: HTMLElement): void {
    try { this.muted = localStorage.getItem('jogorua.muted') === 'true' } catch { /* Preferences are optional. */ }
    const toggle = document.createElement('button')
    toggle.className = 'audio-toggle'
    const refresh = () => {
      toggle.textContent = this.muted ? 'Som: desligado' : 'Som: ligado'
      toggle.setAttribute('aria-pressed', String(!this.muted))
    }
    toggle.onclick = () => {
      this.muted = !this.muted
      try { localStorage.setItem('jogorua.muted', String(this.muted)) } catch { /* Preferences are optional. */ }
      refresh()
      this.play('confirm')
    }
    refresh()
    parent.append(toggle)
    const unlock = () => {
      try {
        this.context ??= new AudioContext()
        void this.context.resume().catch(() => {})
      } catch { /* Browsers without audio can still play. */ }
    }
    document.addEventListener('pointerdown', unlock, { once: true })
    document.addEventListener('keydown', unlock, { once: true })
  }

  play(cue: 'goal' | 'win' | 'confirm'): void {
    if (this.muted || !this.context || this.context.state !== 'running') return
    const notes = { goal: [523, 659, 784], win: [523, 659, 784, 1047], confirm: [659, 784] }[cue]
    notes.forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator()
      const gain = this.context!.createGain()
      const start = this.context!.currentTime + index * 0.12
      oscillator.type = 'triangle'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.06, start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18)
      oscillator.connect(gain).connect(this.context!.destination)
      oscillator.start(start)
      oscillator.stop(start + 0.2)
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
    })
  }
}
export const gameAudio = new GameAudio()
