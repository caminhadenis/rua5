import { describe, expect, it } from 'vitest'
import { starterUniformUrl, uniformSvg } from './teamColors'

describe('team uniforms', () => {
  const colors = { primaryColor: '#2266aa', secondaryColor: '#dd3344' }
  it('shows three distinct starter appearances in the selected team uniform', () => {
    const ids = ['starter_leo', 'starter_rafa', 'starter_breno']
    const portraits = ids.map(id => decodeURIComponent(starterUniformUrl(id, colors)))
    expect(new Set(portraits).size).toBe(3)
    for (const portrait of portraits) {
      expect(portrait).toContain(colors.primaryColor)
      expect(portrait).toContain(colors.secondaryColor)
    }
  })
  it('gives Cabeleira a brown mustache, Aderlou black hair, and Loraco blond hair', () => {
    const cabeleira = decodeURIComponent(starterUniformUrl('starter_leo', colors))
    const aderlo = decodeURIComponent(starterUniformUrl('starter_breno', colors))
    const loraco = decodeURIComponent(starterUniformUrl('starter_rafa', colors))
    expect(cabeleira).toContain('fill="#654335"')
    expect(cabeleira).toContain('fill="#3b291f"')
    expect(aderlo).toContain('fill="#111820"')
    expect(loraco).toContain('fill="#d8a83e"')
  })
  it('dresses starters and recruits without changing skin or hair', () => {
    const starter = uniformSvg('player', colors)
    expect(starter).toContain('fill="#2266aa"')
    expect(starter).toContain('fill="#dd3344"')
    expect(starter).toContain('fill="#c58b61"')
    expect(starter).toContain('fill="#293139"')
    const recruit = uniformSvg('challenger', colors)
    expect(recruit).toContain('fill="#2266aa"')
    expect(recruit).toContain('fill="#dd3344" d="M9 27')
    expect(recruit).toContain('fill="#986445"')
    expect(recruit).toContain('fill="#312d35"')
    expect(recruit).not.toContain('#de725a')
  })
  it('preserves colors in both sets of celebration and defeat poses', () => {
    const emotions = uniformSvg('duel-emotions', colors)
    expect(emotions.match(/--shirt:#2266aa/g)).toHaveLength(2)
    expect(emotions.match(/--shorts:#dd3344/g)).toHaveLength(2)
    expect(emotions).toContain('--skin:#986445')
  })
  it('does not replace a selected color again when it matches the old palette', () => {
    expect(uniformSvg('player', { primaryColor: '#24354a', secondaryColor: '#f7d154' }))
      .toContain('fill="#24354a" d="M8 18')
  })
  it('rejects invalid colors before embedding them into an SVG', () => {
    expect(() => uniformSvg('player', { ...colors, primaryColor: 'red" onload="' })).toThrow()
  })
})
