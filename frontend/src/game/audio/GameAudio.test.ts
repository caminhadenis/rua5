import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GameAudio } from './GameAudio'
import { CUES, musicStep, SCORES, type MusicTrack } from './score'

class AudioParamFake {
  value = 0
  setValueAtTime = vi.fn((value: number) => { this.value = value })
  linearRampToValueAtTime = vi.fn()
  exponentialRampToValueAtTime = vi.fn()
  cancelScheduledValues = vi.fn()
}
class NodeFake {
  connect = vi.fn((node: NodeFake) => node)
  disconnect = vi.fn()
}
class GainFake extends NodeFake { gain = new AudioParamFake() }
class SourceFake extends NodeFake {
  type = 'sine'
  frequency = new AudioParamFake()
  onended?: () => void
  private timer?: ReturnType<typeof setTimeout>
  start = vi.fn()
  stop = vi.fn((time = Date.now() / 1000) => {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.onended?.(), Math.max(0, time * 1000 - Date.now()))
  })
}
class ContextFake {
  state: AudioContextState = 'suspended'
  destination = new NodeFake()
  sampleRate = 8000
  get currentTime() { return Date.now() / 1000 }
  sources: SourceFake[] = []
  gains: GainFake[] = []
  resume = vi.fn(async () => { this.state = 'running' })
  suspend = vi.fn(async () => { this.state = 'suspended' })
  close = vi.fn(async () => { this.state = 'closed' })
  createGain() { const gain = new GainFake(); this.gains.push(gain); return gain }
  createOscillator() { const source = new SourceFake(); this.sources.push(source); return source }
  createBufferSource() { return this.createOscillator() }
  createBuffer(_channels: number, length: number) { return { getChannelData: () => new Float32Array(length) } }
}
class ButtonFake extends EventTarget {
  dataset: Record<string, string> = {}
  textContent = ''
  onclick?: () => void
  setAttribute = vi.fn()
  remove = vi.fn()
  click() { this.onclick?.() }
}

let audio: GameAudio
let context: ContextFake
let contexts: ContextFake[]
let documentFake: EventTarget & { hidden: boolean; createElement: () => ButtonFake }
let button: ButtonFake
let preferences: Map<string, string>
const gesture = async () => { documentFake.dispatchEvent(new Event('pointerdown')); await Promise.resolve() }

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
  preferences = new Map()
  contexts = []
  context = new ContextFake()
  vi.stubGlobal('AudioContext', class { constructor() { contexts.push(context); return context } })
  button = new ButtonFake()
  documentFake = Object.assign(new EventTarget(), { hidden: false, createElement: () => button })
  vi.stubGlobal('document', documentFake)
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => preferences.get(key),
    setItem: (key: string, value: string) => preferences.set(key, value),
  })
  audio = new GameAudio()
  audio.install({ append: vi.fn() } as unknown as HTMLElement)
})
afterEach(() => { audio.dispose(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('music lifecycle', () => {
  it('starts the current scene theme only after a gesture, including an explicit menu sound button', async () => {
    audio.setMusic('menu')
    expect(contexts).toHaveLength(0)
    expect(button.textContent).toBe('Som: ativar')
    button.click()
    await Promise.resolve()
    expect(button.dataset.playing).toBe('menu')
    expect(button.textContent).toBe('Som: ligado')
    expect(context.sources.length).toBeGreaterThan(0)
    expect(preferences.get('jogorua.muted')).not.toBe('true')
  })
  it('uses the latest scene when resume resolves after a transition', async () => {
    let resumed!: () => void
    context.resume.mockImplementation(() => new Promise(resolve => { resumed = () => { context.state = 'running'; resolve() } }))
    audio.setMusic('menu')
    await gesture()
    audio.setMusic('graduation')
    resumed()
    await Promise.resolve()
    expect(button.dataset.playing).toBe('graduation')
  })
  it('loops with bounded active sources and does not restart the same theme', async () => {
    const intervals = vi.spyOn(globalThis, 'setInterval')
    audio.setMusic('city')
    await gesture()
    const sources = context.sources.length
    audio.setMusic('city')
    expect(context.sources).toHaveLength(sources)
    expect(intervals).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(70_000)
    expect(context.sources.length).toBeGreaterThan(100)
    expect(context.sources.filter(source => source.disconnect.mock.calls.length === 0).length).toBeLessThan(20)
    audio.setMusic('duel')
    expect(button.dataset.playing).toBe('duel')
    vi.advanceTimersByTime(250)
    expect(context.sources.slice(0, sources).every(source => source.disconnect.mock.calls.length > 0)).toBe(true)
  })
  it('immediately silences music and pending effects, saves mute and resumes the latest theme', async () => {
    audio.setMusic('menu')
    await gesture()
    audio.play('win')
    const sources = [...context.sources]
    audio.setMuted(true)
    expect(context.gains[0]!.gain.value).toBe(0)
    expect(sources.every(source => source.disconnect.mock.calls.length > 0)).toBe(true)
    expect(preferences.get('jogorua.muted')).toBe('true')
    audio.setMusic('duel')
    audio.play('attention')
    vi.advanceTimersByTime(2000)
    expect(context.sources).toHaveLength(sources.length)
    button.click()
    expect(button.dataset.playing).toBe('duel')
    expect(preferences.get('jogorua.muted')).toBe('false')
  })
  it('restores saved silence without creating audio on other gestures', async () => {
    preferences.set('jogorua.muted', 'true')
    audio.install({ append: vi.fn() } as unknown as HTMLElement)
    audio.setMusic('menu')
    await gesture()
    expect(contexts).toHaveLength(0)
    expect(button.textContent).toBe('Som: desligado')
    button.click()
    await Promise.resolve()
    expect(button.dataset.playing).toBe('menu')
  })
  it('stops on hidden tabs and resumes the current scene without replaying effects', async () => {
    audio.setMusic('duel')
    await gesture()
    audio.play('goal')
    documentFake.hidden = true
    documentFake.dispatchEvent(new Event('visibilitychange'))
    const sources = context.sources.length
    vi.advanceTimersByTime(5000)
    expect(context.sources).toHaveLength(sources)
    audio.setMusic('city')
    documentFake.hidden = false
    documentFake.dispatchEvent(new Event('visibilitychange'))
    await Promise.resolve()
    expect(button.dataset.playing).toBe('city')
    expect(context.suspend).toHaveBeenCalledTimes(1)
  })
  it('disposes scheduling and gesture listeners when the game is destroyed', async () => {
    audio.setMusic('menu')
    await gesture()
    audio.dispose()
    const sources = context.sources.length
    await gesture()
    vi.advanceTimersByTime(5000)
    expect(context.sources).toHaveLength(sources)
    expect(contexts).toHaveLength(1)
    expect(context.close).toHaveBeenCalled()
  })
  it('keeps gameplay available when Web Audio, storage or autoplay are unavailable', async () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw Error('denied') }, setItem: () => { throw Error('denied') } })
    audio.install({ append: vi.fn() } as unknown as HTMLElement)
    context.resume.mockRejectedValue(Error('blocked'))
    audio.setMusic('menu')
    await gesture()
    expect(context.sources).toHaveLength(0)
    audio.setMuted(true)
    audio.setMuted(false)
    audio.dispose()
    vi.stubGlobal('AudioContext', undefined)
    audio.install({ append: vi.fn() } as unknown as HTMLElement)
    expect(() => documentFake.dispatchEvent(new Event('keydown'))).not.toThrow()
  })
})

describe('original score and effects', () => {
  it('plays each event cue only when enabled', async () => {
    await gesture()
    for (const cue of Object.keys(CUES) as (keyof typeof CUES)[]) {
      const before = context.sources.length
      audio.play(cue)
      expect(context.sources.length - before).toBe(CUES[cue].length)
    }
    audio.setMuted(true)
    const before = context.sources.length
    audio.play('loss')
    expect(context.sources).toHaveLength(before)
  })
  it('has four distinct, valid looping compositions', () => {
    const melodies = new Set<string>()
    for (const track of Object.keys(SCORES) as MusicTrack[]) {
      const score = SCORES[track]
      expect(score.chords).toHaveLength(score.lead.length)
      melodies.add(JSON.stringify(score.lead))
      for (let step = 0; step < score.lead.length * 8; step++) {
        expect(score.lead[Math.floor(step / 8)]).toHaveLength(8)
        for (const tone of musicStep(track, step)) {
          expect(tone.midi).toBeGreaterThan(0)
          expect(tone.midi).toBeLessThan(128)
          expect(tone.duration).toBeGreaterThan(0)
          expect(tone.volume).toBeLessThanOrEqual(0.1)
        }
      }
      expect(musicStep(track, score.lead.length * 8)).toEqual(musicStep(track, 0))
    }
    expect(melodies.size).toBe(4)
  })
})
