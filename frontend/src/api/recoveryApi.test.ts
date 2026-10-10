import { afterEach, describe, expect, it, vi } from 'vitest'
import { RecoveryCommand } from './gameApi'

afterEach(() => vi.unstubAllGlobals())

describe('durable recovery commands', () => {
  it('retries the same treatment after losing a response and rejects changing its player or station', async () => {
    const receipt = { session: { id: 'session' } }
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('lost response')).mockResolvedValue({ ok: true, json: async () => receipt })
    vi.stubGlobal('fetch', fetch)
    const command = new RecoveryCommand()
    await expect(command.start('athlete', 'bed')).rejects.toThrow()
    await expect(command.start('athlete', 'ice')).rejects.toThrow('pendente')
    await expect(command.start('other', 'bed')).rejects.toThrow('pendente')
    expect(await command.start('athlete', 'bed')).toEqual(receipt)
    const [first, retry] = fetch.mock.calls
    expect(first![1].headers['Idempotency-Key']).toBe(retry![1].headers['Idempotency-Key'])
    expect(JSON.parse(first![1].body)).toEqual({ ownedPlayerId: 'athlete', stationId: 'bed' })
    await command.cancel('session')
    expect(fetch.mock.calls[2]![0]).toBe('/api/v1/recovery/sessions/session/cancel')
    expect(fetch.mock.calls[2]![1].headers['Idempotency-Key']).not.toBe(first![1].headers['Idempotency-Key'])
  })

  it('allows another selection after a definite station rejection, but preserves uncertain cancellation', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ code: 'RECOVERY_STATION_OCCUPIED' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }).mockRejectedValueOnce(new TypeError('lost cancellation'))
      .mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetch)
    const command = new RecoveryCommand()
    await expect(command.start('athlete', 'bed')).rejects.toThrow('RECOVERY_STATION_OCCUPIED')
    await command.start('athlete', 'ice')
    await expect(command.cancel('session')).rejects.toThrow()
    await command.cancel('session')
    expect(fetch.mock.calls[2]![1].headers['Idempotency-Key']).toBe(fetch.mock.calls[3]![1].headers['Idempotency-Key'])
  })
})
