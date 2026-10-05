import { afterEach, expect, it, vi } from 'vitest'
import { createIdempotencyKey } from './idempotencyKey'

afterEach(() => vi.unstubAllGlobals())

it('generates valid, distinct UUID v4 keys over HTTP when randomUUID is unavailable', () => {
  vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) })
  const keys = Array.from({ length: 100 }, () => createIdempotencyKey())
  for (const key of keys) expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  expect(new Set(keys).size).toBe(keys.length)
})
