import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { FakeUnauthorized, FakeRateLimited, resume, resumeWithKey } = vi.hoisted(() => ({
  FakeUnauthorized: class extends Error {},
  FakeRateLimited: class extends Error {
    constructor(public retryAfterSeconds?: number) {
      super('rate limited')
    }
  },
  resume: vi.fn(),
  resumeWithKey: vi.fn(),
}))

vi.mock('@avalon-initiative/protocol-sdk', () => ({
  UnauthorizedError: FakeUnauthorized,
  RateLimitedError: FakeRateLimited,
  AvalonClient: class {
    resumeAccountSession = resume
    resumeAccountSessionWithSigningKey = resumeWithKey
  },
}))

import { useSessionStore } from '../../src/api/session'

const fakeSession = { token: () => 'tok-1', identity: () => ({ id: 'id-1' }) }

beforeEach(() => {
  setActivePinia(createPinia())
  resume.mockReset()
  resumeWithKey.mockReset()
  localStorage.clear()
})


async function init(store: ReturnType<typeof useSessionStore>) {
  vi.useFakeTimers()
  const done = store.initialize()
  await vi.runAllTimersAsync()
  await done
  vi.useRealTimers()
}

describe('session store resume', () => {
  it('stays signed out and ready when nothing is stored', async () => {
    const s = useSessionStore()
    await s.initialize()
    expect(s.ready).toBe(true)
    expect(s.resumeFailed).toBe(false)
    expect(resume).not.toHaveBeenCalled()
  })

  it('clears storage once on a rejected token without retrying', async () => {
    localStorage.setItem('avalon:session:token', 'tok-1')
    resume.mockRejectedValue(new FakeUnauthorized())
    const s = useSessionStore()
    await s.initialize()
    expect(resume).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('avalon:session:token')).toBeNull()
    expect(s.resumeFailed).toBe(false)
  })

  it.each([['429'], ['503'], ['network down']])('keeps the token and flags a retryable failure on %s', async (msg) => {
    localStorage.setItem('avalon:session:token', 'tok-1')
    resume.mockRejectedValue(new Error(msg))
    const s = useSessionStore()
    await init(s)
    expect(resume).toHaveBeenCalledTimes(3)
    expect(localStorage.getItem('avalon:session:token')).toBe('tok-1')
    expect(s.isAuthenticated()).toBe(false)
    expect(s.resumeFailed).toBe(true)
  })

  it('recovers when a retry succeeds', async () => {
    localStorage.setItem('avalon:session:token', 'tok-1')
    resume.mockRejectedValueOnce(new Error('429')).mockResolvedValue(fakeSession)
    const s = useSessionStore()
    await init(s)
    expect(s.isAuthenticated()).toBe(true)
    expect(s.resumeFailed).toBe(false)
  })
})

describe('session store resume backoff', () => {
  const startResume = () => {
    localStorage.setItem('avalon:session:token', 'tok-1')
    const s = useSessionStore()
    return { s, done: s.initialize() }
  }

  it('waits the server Retry-After before the next attempt', async () => {
    vi.useFakeTimers()
    resume.mockRejectedValueOnce(new FakeRateLimited(4)).mockResolvedValue(fakeSession)
    const { done } = startResume()
    await vi.advanceTimersByTimeAsync(3999)
    expect(resume).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await done
    expect(resume).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('caps an oversized Retry-After', async () => {
    vi.useFakeTimers()
    resume.mockRejectedValueOnce(new FakeRateLimited(60)).mockResolvedValue(fakeSession)
    const { done } = startResume()
    await vi.advanceTimersByTimeAsync(9999)
    expect(resume).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await done
    expect(resume).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('falls back to the doubling backoff when no Retry-After was sent', async () => {
    vi.useFakeTimers()
    resume.mockRejectedValueOnce(new FakeRateLimited()).mockResolvedValue(fakeSession)
    const { done } = startResume()
    await vi.advanceTimersByTimeAsync(999)
    expect(resume).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await done
    expect(resume).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
})
