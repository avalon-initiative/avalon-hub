import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SHARED_READ_TTL_MS,
  cachedRead,
  invalidateGuildReadsOnLeave,
  invalidateSharedReads,
} from './sharedReads'

beforeEach(() => {
  vi.useFakeTimers()
  invalidateSharedReads()
})
afterEach(() => vi.useRealTimers())

describe('cachedRead', () => {
  it('serves a fresh entry and shares one in-flight request', async () => {
    const load = vi.fn().mockResolvedValue('a')
    const [x, y] = await Promise.all([cachedRead('k', load), cachedRead('k', load)])
    expect([x, y]).toEqual(['a', 'a'])
    await cachedRead('k', load)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('reloads once the entry expires or when forced', async () => {
    const load = vi.fn().mockResolvedValue('a')
    await cachedRead('k', load)
    await cachedRead('k', load, { force: true })
    expect(load).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(SHARED_READ_TTL_MS + 1)
    await cachedRead('k', load)
    expect(load).toHaveBeenCalledTimes(3)
  })

  it('does not cache a failed read', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue('ok')
    await expect(cachedRead('k', load)).rejects.toThrow('boom')
    await expect(cachedRead('k', load)).resolves.toBe('ok')
  })

  it('drops guild entries on leaving a guild page but not other pages', async () => {
    const load = vi.fn().mockResolvedValue('a')
    await cachedRead('guilds:x', load)
    invalidateGuildReadsOnLeave('friends')
    await cachedRead('guilds:x', load)
    expect(load).toHaveBeenCalledTimes(1)
    invalidateGuildReadsOnLeave('guild-channel')
    await cachedRead('guilds:x', load)
    expect(load).toHaveBeenCalledTimes(2)
  })
})
