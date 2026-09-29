import { expect, it } from 'vitest'
import { emotionsForOutcome } from './duelEmotions'

it('uses the server outcome for both reactions, including away victory and draws', () => {
  expect(emotionsForOutcome('WIN')).toEqual({ home: 'happy', away: 'sad' })
  expect(emotionsForOutcome('LOSS')).toEqual({ home: 'sad', away: 'happy' })
  expect(emotionsForOutcome('DRAW')).toEqual({ home: 'neutral', away: 'neutral' })
})
