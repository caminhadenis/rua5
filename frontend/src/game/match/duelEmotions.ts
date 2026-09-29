import type { DuelResponse } from '../../api/gameApi'

export type DuelEmotion = 'neutral' | 'happy' | 'sad'

/** Presentation follows the server outcome; no score or winner calculation here. */
export function emotionsForOutcome(outcome: DuelResponse['match']['outcome']): Record<'home' | 'away', DuelEmotion> {
  switch (outcome) {
    case 'WIN': return { home: 'happy', away: 'sad' }
    case 'LOSS': return { home: 'sad', away: 'happy' }
    case 'DRAW': return { home: 'neutral', away: 'neutral' }
  }
}
