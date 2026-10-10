import { CUES, midiFrequency, musicStep, SCORES, type MusicTrack, type SoundCue, type Tone } from './score'

interface Voice { source: AudioScheduledSourceNode; gain: GainNode; bus: GainNode }

/** Original music and effects; browser audio availability never gates gameplay. */
export class GameAudio {
  private context?: AudioContext
  private master?: GainNode
  private musicBus?: GainNode
  private noise?: AudioBuffer
  private muted = false
  private track: MusicTrack | null = null
  private playing: MusicTrack | null = null
  private nextStep = 0
  private nextTime = 0
  private timer?: ReturnType<typeof setInterval>
  private voices = new Set<Voice>()
  private toggle?: HTMLButtonElement
  private cleanup?: () => void

  install(parent: HTMLElement): void {
    this.dispose()
    try { this.muted = localStorage.getItem('jogorua.muted') === 'true' } catch { /* Optional preference. */ }
    const toggle = document.createElement('button')
    toggle.className = 'audio-toggle'
    toggle.title = 'Música e efeitos. Ative o som com um clique ou tecla.'
    this.toggle = toggle
    toggle.onclick = () => {
      // The first click activates menu music instead of immediately muting it.
      if (!this.muted && this.context?.state !== 'running') { this.unlock(); return }
      this.setMuted(!this.muted)
      if (!this.muted) { this.unlock(); this.play('confirm') }
    }
    const unlock = (event: Event) => { if (event.target !== toggle) this.unlock() }
    const visibility = () => {
      if (document.hidden) {
        this.stopMusic(false)
        this.stopVoices()
        void this.context?.suspend().catch(() => {})
      } else this.unlock()
    }
    document.addEventListener('pointerdown', unlock, { capture: true })
    document.addEventListener('keydown', unlock, { capture: true })
    document.addEventListener('visibilitychange', visibility)
    parent.append(toggle)
    this.cleanup = () => {
      document.removeEventListener('pointerdown', unlock, { capture: true })
      document.removeEventListener('keydown', unlock, { capture: true })
      document.removeEventListener('visibilitychange', visibility)
      toggle.remove()
    }
    this.refresh()
  }

  setMusic(track: MusicTrack | null): void {
    this.track = track
    this.syncMusic()
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    try { localStorage.setItem('jogorua.muted', String(muted)) } catch { /* Optional preference. */ }
    if (this.master) this.master.gain.value = muted ? 0 : 0.8
    if (muted) { this.stopMusic(false); this.stopVoices() }
    else this.syncMusic()
    this.refresh()
  }

  play(cue: SoundCue): void {
    if (!this.canPlay() || !this.master) return
    for (const tone of CUES[cue]) this.tone(tone, this.context!.currentTime + tone.offset, this.master)
  }

  dispose(): void {
    this.cleanup?.()
    this.cleanup = undefined
    this.stopMusic(false)
    this.stopVoices()
    this.master?.disconnect()
    void this.context?.close().catch(() => {})
    this.context = undefined
    this.master = undefined
    this.noise = undefined
    this.toggle = undefined
    this.track = null
  }

  private canPlay(): boolean {
    return !this.muted && !document.hidden && this.context?.state === 'running'
  }

  private unlock(): void {
    if (this.muted || document.hidden) return
    try {
      if (!this.context) {
        this.context = new AudioContext()
        this.master = this.context.createGain()
        this.master.gain.value = 0.8
        this.master.connect(this.context.destination)
      }
      if (this.context.state === 'running') this.syncMusic()
      else {
        const context = this.context
        void context.resume().then(() => {
          if (this.context === context) this.syncMusic()
        }).catch(() => { this.refresh() })
      }
    } catch { /* Audio is optional, including on browsers without Web Audio. */ }
  }

  private syncMusic(): void {
    if (!this.canPlay() || !this.track || !this.master) {
      this.stopMusic(false)
      this.refresh()
      return
    }
    if (this.playing === this.track) return
    this.stopMusic(true)
    const context = this.context!
    this.musicBus = context.createGain()
    this.musicBus.connect(this.master)
    this.musicBus.gain.setValueAtTime(0, context.currentTime)
    this.musicBus.gain.linearRampToValueAtTime(0.7, context.currentTime + 0.3)
    this.playing = this.track
    this.nextStep = 0
    this.nextTime = context.currentTime + 0.025
    this.schedule()
    // Short lookahead avoids accumulating notes while a tab is inactive.
    this.timer = setInterval(() => this.schedule(), 100)
    this.refresh()
  }

  private schedule(): void {
    if (!this.canPlay() || !this.playing || !this.musicBus) return
    const context = this.context!
    if (this.nextTime < context.currentTime) this.nextTime = context.currentTime + 0.025
    const score = SCORES[this.playing]
    while (this.nextTime < context.currentTime + 0.25) {
      for (const tone of musicStep(this.playing, this.nextStep)) this.tone(tone, this.nextTime, this.musicBus)
      const position = this.nextStep % 8
      if (score.percussion === 'beat' && position % 4 === 0) {
        this.tone({ midi: 43, slideTo: 24, offset: 0, duration: 0.12, volume: 0.1, wave: 'sine' }, this.nextTime, this.musicBus)
      }
      if (position === 2 || position === 6) this.percussion(this.nextTime, this.musicBus, 0.09,
        score.percussion === 'beat' ? 0.045 : 0.012)
      if (score.percussion !== 'march' && position % 2 === 1) this.percussion(this.nextTime, this.musicBus, 0.035, 0.008)
      this.nextStep = (this.nextStep + 1) % (score.lead.length * 8)
      this.nextTime += 30 / score.bpm
    }
  }

  private stopMusic(fade: boolean): void {
    if (this.timer !== undefined) clearInterval(this.timer)
    this.timer = undefined
    const bus = this.musicBus
    if (bus && this.context) {
      const now = this.context.currentTime
      bus.gain.cancelScheduledValues(now)
      bus.gain.setValueAtTime(fade ? bus.gain.value : 0, now)
      if (fade) bus.gain.linearRampToValueAtTime(0, now + 0.18)
      for (const voice of this.voices) if (voice.bus === bus) voice.source.stop(now + (fade ? 0.19 : 0))
      if (![...this.voices].some(voice => voice.bus === bus)) bus.disconnect()
    }
    this.musicBus = undefined
    this.playing = null
  }

  private tone(tone: Tone, start: number, bus: GainNode): void {
    const context = this.context!
    const oscillator = context.createOscillator()
    oscillator.type = tone.wave ?? 'triangle'
    oscillator.frequency.setValueAtTime(midiFrequency(tone.midi), start)
    if (tone.slideTo !== undefined) oscillator.frequency.exponentialRampToValueAtTime(midiFrequency(tone.slideTo), start + tone.duration)
    const gain = this.envelope(start, tone.duration, tone.volume)
    this.connect(oscillator, gain, bus, start, tone.duration)
  }

  private percussion(start: number, bus: GainNode, duration: number, volume: number): void {
    const context = this.context!
    if (!this.noise) {
      this.noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.12), context.sampleRate)
      const samples = this.noise.getChannelData(0)
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1
    }
    const source = context.createBufferSource()
    source.buffer = this.noise
    this.connect(source, this.envelope(start, duration, volume), bus, start, duration)
  }

  private envelope(start: number, duration: number, volume: number): GainNode {
    const gain = this.context!.createGain()
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(volume, start + Math.min(0.018, duration / 4))
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
    gain.gain.linearRampToValueAtTime(0, start + duration + 0.02)
    return gain
  }

  private connect(source: AudioScheduledSourceNode, gain: GainNode, bus: GainNode, start: number, duration: number): void {
    const voice = { source, gain, bus }
    this.voices.add(voice)
    source.connect(gain).connect(bus)
    source.onended = () => {
      source.disconnect()
      gain.disconnect()
      this.voices.delete(voice)
      if (bus !== this.master && bus !== this.musicBus && ![...this.voices].some(other => other.bus === bus)) bus.disconnect()
    }
    source.start(start)
    source.stop(start + duration + 0.025)
  }

  private stopVoices(): void {
    for (const { source, gain } of this.voices) {
      source.stop()
      source.disconnect()
      gain.disconnect()
    }
    this.voices.clear()
  }

  private refresh(): void {
    if (!this.toggle) return
    this.toggle.textContent = this.muted ? 'Som: desligado' : this.context?.state === 'running' ? 'Som: ligado' : 'Som: ativar'
    this.toggle.setAttribute('aria-pressed', String(!this.muted && this.context?.state === 'running'))
    this.toggle.dataset.music = this.track ?? ''
    this.toggle.dataset.playing = this.playing ?? ''
  }
}

export const gameAudio = new GameAudio()
