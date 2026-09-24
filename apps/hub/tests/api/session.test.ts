import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { FakeUnauthorized, resume, resumeWithKey } = vi.hoisted(() => ({
  FakeUnauthorized: class extends Error {},
  resume: vi.fn(),
  resumeWithKey: vi.fn(),
}))

vi.mock('@avalon-initiative/protocol-sdk', () => ({
  UnauthorizedError: FakeUnauthorized,
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
