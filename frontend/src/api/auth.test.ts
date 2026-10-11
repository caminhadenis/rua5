import { afterEach, expect, it, vi } from 'vitest'
import { csrfHeaders, loadAuth, signIn, signOut } from './auth'
import { request } from './gameApi'

afterEach(() => vi.unstubAllGlobals())

it('refreshes CSRF after login and sends it on game commands and logout', async () => {
  const status = (token: string) => ({ enabled: true, authenticated: true, email: 'player@example.com', csrfToken: token, csrfHeader: 'X-CSRF-TOKEN' })
  const fetch = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => status('before') })
    .mockResolvedValueOnce({ ok: true })
    .mockResolvedValueOnce({ ok: true, json: async () => status('after') })
    .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    .mockResolvedValueOnce({ ok: true, json: async () => status('logout') })
    .mockResolvedValueOnce({ ok: true })
  vi.stubGlobal('fetch', fetch)
  await signIn('player@example.com', 'password')
  expect(fetch.mock.calls[1]![1].headers['X-CSRF-TOKEN']).toBe('before')
  expect(fetch.mock.calls[1]![1].body.toString()).toContain('email=player%40example.com')
  await request('/training/sessions', { ownedPlayerId: 'player' }, 'key')
  expect(fetch.mock.calls[3]![1].headers['X-CSRF-TOKEN']).toBe('after')
  expect(fetch.mock.calls[3]![1].headers['Idempotency-Key']).toBe('key')
  await request('/roster')
  expect(fetch.mock.calls[4]![1].headers).not.toHaveProperty('X-CSRF-TOKEN')
  await signOut()
  expect(fetch.mock.calls[6]![1].headers['X-CSRF-TOKEN']).toBe('logout')
  expect(csrfHeaders()).toEqual({})
})

it('keeps local mode without CSRF and reports rejected credentials', async () => {
  const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ enabled: false, csrfToken: null, csrfHeader: null }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ csrfToken: 'token', csrfHeader: 'X-CSRF-TOKEN' }) })
    .mockResolvedValueOnce({ ok: false, json: async () => ({ message: 'E-mail ou senha inválidos.' }) })
  vi.stubGlobal('fetch', fetch)
  await loadAuth()
  expect(csrfHeaders()).toEqual({})
  await expect(signIn('player@example.com', 'wrong')).rejects.toThrow('E-mail ou senha inválidos.')
})
