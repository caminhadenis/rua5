export type MusicTrack = 'menu' | 'graduation' | 'city' | 'duel'
export type SoundCue = 'goal' | 'win' | 'loss' | 'draw' | 'confirm' | 'attention' | 'whistle' | 'diploma' | 'trophy'

type Bar = readonly number[]
interface Score {
  bpm: number
  leadWave: OscillatorType
  lead: readonly Bar[]
  chords: readonly Bar[]
  percussion: 'light' | 'march' | 'beat'
}

// Original eight-bar themes. Lead entries are eighth notes; 0 is a rest.
// MIDI pitches make the compositions editable without recordings or downloads.
export const SCORES: Record<MusicTrack, Score> = {
  menu: {
    bpm: 112, leadWave: 'triangle', percussion: 'light',
    lead: [
      [72, 0, 76, 79, 81, 79, 76, 0], [74, 0, 77, 81, 79, 77, 74, 0],
      [76, 79, 84, 0, 83, 79, 76, 0], [74, 77, 79, 0, 71, 74, 79, 0],
      [72, 76, 79, 84, 81, 79, 76, 72], [74, 77, 81, 84, 83, 81, 77, 74],
      [76, 79, 84, 86, 84, 79, 81, 0], [79, 77, 76, 74, 72, 0, 67, 0],
    ],
    chords: [[48, 52, 55], [50, 53, 57], [45, 48, 52], [43, 47, 50],
      [48, 52, 55], [53, 57, 60], [45, 48, 52], [43, 47, 50]],
  },
  graduation: {
    bpm: 78, leadWave: 'triangle', percussion: 'march',
    lead: [
      [67, 0, 0, 0, 71, 0, 74, 0], [79, 0, 0, 0, 78, 0, 74, 0],
      [76, 0, 0, 0, 74, 0, 72, 0], [74, 0, 0, 0, 71, 0, 0, 0],
      [71, 0, 74, 0, 79, 0, 0, 0], [81, 0, 79, 0, 78, 0, 74, 0],
      [76, 0, 79, 0, 83, 0, 81, 0], [79, 0, 0, 0, 74, 0, 0, 0],
    ],
    chords: [[43, 47, 50], [47, 50, 54], [48, 52, 55], [50, 54, 57],
      [43, 47, 50], [50, 54, 57], [48, 52, 55], [43, 47, 50]],
  },
  city: {
    bpm: 108, leadWave: 'triangle', percussion: 'light',
    lead: [
      [76, 79, 0, 81, 83, 81, 79, 0], [77, 81, 0, 79, 84, 0, 81, 79],
      [76, 79, 0, 81, 79, 0, 76, 79], [74, 77, 0, 79, 0, 77, 74, 0],
      [72, 0, 76, 79, 83, 0, 79, 76], [77, 0, 81, 84, 0, 81, 79, 0],
      [76, 0, 79, 81, 0, 79, 76, 74], [74, 0, 71, 0, 72, 0, 0, 0],
    ],
    chords: [[48, 52, 55, 59], [53, 57, 60, 64], [45, 48, 52, 55], [43, 47, 50, 53],
      [48, 52, 55, 59], [53, 57, 60, 64], [50, 53, 57, 60], [43, 47, 50, 53]],
  },
  duel: {
    bpm: 144, leadWave: 'square', percussion: 'beat',
    lead: [
      [69, 72, 76, 72, 69, 0, 76, 79], [77, 76, 72, 69, 72, 0, 77, 76],
      [74, 77, 81, 77, 74, 0, 81, 84], [76, 80, 83, 80, 76, 0, 83, 80],
      [81, 79, 76, 72, 76, 79, 81, 84], [84, 81, 77, 76, 77, 81, 84, 81],
      [81, 77, 74, 77, 81, 84, 86, 84], [83, 80, 76, 80, 83, 80, 76, 0],
    ],
    chords: [[45, 48, 52], [41, 45, 48], [50, 53, 57], [40, 44, 47],
      [45, 48, 52], [41, 45, 48], [50, 53, 57], [40, 44, 47]],
  },
}

export interface Tone {
  midi: number
  offset: number
  duration: number
  volume: number
  wave?: OscillatorType
  slideTo?: number
}

export function musicStep(track: MusicTrack, step: number): Tone[] {
  const score = SCORES[track]
  const eighth = 30 / score.bpm
  const bar = Math.floor(step / 8) % score.lead.length
  const position = step % 8
  const chord = score.chords[bar]!
  const tones: Tone[] = []
  const midi = score.lead[bar]![position]!
  if (midi) tones.push({ midi, offset: 0, duration: eighth * (track === 'graduation' ? 1.85 : 0.85),
    volume: track === 'duel' ? 0.027 : 0.06, wave: score.leadWave })
  if (position % (track === 'duel' ? 2 : 4) === 0) {
    tones.push({ midi: chord[position === 4 ? 2 : 0]! - 12, offset: 0,
      duration: eighth * 1.65, volume: 0.055, wave: 'triangle' })
  }
  if (position === 0) for (const note of chord) {
    tones.push({ midi: note + 12, offset: 0, duration: eighth * 7.5, volume: 0.012, wave: 'sine' })
  }
  return tones
}

const phrase = (notes: number[], spacing = 0.12, duration = 0.19, wave: OscillatorType = 'triangle'): Tone[] =>
  notes.map((midi, index) => ({ midi, offset: index * spacing, duration, volume: 0.11, wave }))

export const CUES: Record<SoundCue, readonly Tone[]> = {
  confirm: phrase([76, 79]),
  attention: phrase([83, 0, 88], 0.11, 0.09, 'square').filter(tone => tone.midi !== 0)
    .map(tone => ({ ...tone, volume: 0.075 })),
  whistle: [{ midi: 95, slideTo: 99, offset: 0, duration: 0.16, volume: 0.055, wave: 'sine' },
    { midi: 99, slideTo: 95, offset: 0.22, duration: 0.23, volume: 0.055, wave: 'sine' }],
  goal: phrase([72, 76, 79, 84], 0.09, 0.22),
  win: phrase([72, 76, 79, 84, 79, 84, 88], 0.14, 0.3),
  loss: phrase([69, 65, 62, 57], 0.22, 0.38, 'sine'),
  draw: phrase([67, 72, 67], 0.19, 0.28, 'sine'),
  diploma: phrase([67, 71, 74, 79, 83, 86], 0.16, 0.35),
  trophy: phrase([72, 76, 79, 84, 88, 91, 96], 0.16, 0.4),
}

export const midiFrequency = (midi: number): number => 440 * 2 ** ((midi - 69) / 12)
