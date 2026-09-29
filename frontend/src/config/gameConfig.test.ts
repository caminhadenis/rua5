import { describe, expect, it } from 'vitest'

import { GAME_DIMENSIONS } from './gameConfig'

describe('game scaffold configuration', () => {
  it('uses a 16 by 9 viewport', () => {
    expect(GAME_DIMENSIONS.width / GAME_DIMENSIONS.height).toBe(16 / 9)
  })
})

