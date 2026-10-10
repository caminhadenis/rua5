import { expect, it } from 'vitest'
import { starterAdvice } from './starterAdvice'

it('congratulates the confirmed starter and explains their own strengths', () => {
  for (const [id, name, strength] of [
    ['starter_leo', 'Cabeleira', 'drible'], ['starter_breno', 'Aderlou', 'marcação'], ['starter_rafa', 'Loraco', 'finalização'],
  ]) {
    const advice = starterAdvice({ id, name, archetype: 'unused' })
    expect(advice).toContain(`Parabéns pela escolha, ${name}`)
    expect(advice).toContain(strength)
  }
})
