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

import { configureSessionStorage, type KeyValueStore } from '../../src/api/sessionStorage'
import { storeSigningKeySeed } from '../../src/api/signingKeyStorage'
import { useSessionStore } from '../../src/api/session'

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    async getItem(key) {
      return data[key] ?? null
    },
    async setItem(key, value) {
      data[key] = value
    },
    async removeItem(key) {
      delete data[key]
    },
  }
}

const fakeSession = { token: () => 'tok-1', identity: () => ({ id: 'id-1' }) }

beforeEach(() => {
  setActivePinia(createPinia())
  resume.mockReset()
  resumeWithKey.mockReset()
  localStorage.clear()
})

describe('session store', () => {
  it('stays signed out and becomes ready when nothing is stored', async () => {
    configureSessionStorage(memoryStore())
    const store = useSessionStore()
    await store.initialize()
    expect(store.ready).toBe(true)
    expect(store.isAuthenticated()).toBe(false)
    expect(resume).not.toHaveBeenCalled()
  })

  it('resumes a stored token through the configured store', async () => {
    configureSessionStorage(memoryStore({ 'avalon:session:token': 'tok-1', 'avalon:session:identityId': 'id-1' }))
    resume.mockResolvedValue(fakeSession)
    const store = useSessionStore()
    await store.initialize()
    expect(resume).toHaveBeenCalledWith('tok-1')
    expect(store.isAuthenticated()).toBe(true)
  })

  it('resumes with the signing key when this device holds one', async () => {
    configureSessionStorage(memoryStore({ 'avalon:session:token': 'tok-1', 'avalon:session:identityId': 'id-1' }))
    storeSigningKeySeed('id-1', new Uint8Array([1, 2, 3]))
    resumeWithKey.mockResolvedValue(fakeSession)
    const store = useSessionStore()
    await store.initialize()
    expect(resumeWithKey).toHaveBeenCalledWith('tok-1', new Uint8Array([1, 2, 3]))
    expect(resume).not.toHaveBeenCalled()
  })

  it('clears stored credentials only when the server rejects the token', async () => {
    const store1 = memoryStore({ 'avalon:session:token': 'tok-1' })
    configureSessionStorage(store1)
    resume.mockRejectedValue(new FakeUnauthorized())
    await useSessionStore().initialize()
    expect(store1.data['avalon:session:token']).toBeUndefined()

    setActivePinia(createPinia())
    const store2 = memoryStore({ 'avalon:session:token': 'tok-2' })
    configureSessionStorage(store2)
    resume.mockRejectedValue(new Error('network down'))
    vi.useFakeTimers()
    const s = useSessionStore()
    const done = s.initialize()
    await vi.runAllTimersAsync()
    await done
    vi.useRealTimers()
    expect(store2.data['avalon:session:token']).toBe('tok-2')
    expect(s.isAuthenticated()).toBe(false)
    expect(s.resumeFailed).toBe(true)
  })

  it('retries a transient failure with backoff and recovers without flagging a failure', async () => {
    configureSessionStorage(memoryStore({ 'avalon:session:token': 'tok-1' }))
    resume.mockRejectedValueOnce(new Error('429')).mockRejectedValueOnce(new Error('503')).mockResolvedValue(fakeSession)
    vi.useFakeTimers()
    const s = useSessionStore()
    const done = s.initialize()
    await vi.runAllTimersAsync()
    await done
    vi.useRealTimers()
    expect(resume).toHaveBeenCalledTimes(3)
    expect(s.isAuthenticated()).toBe(true)
    expect(s.resumeFailed).toBe(false)
  })

  it('makes a bounded number of attempts and does not retry a rejected token', async () => {
    configureSessionStorage(memoryStore({ 'avalon:session:token': 'tok-1' }))
    resume.mockRejectedValue(new Error('503'))
    vi.useFakeTimers()
    const s = useSessionStore()
    const done = s.initialize()
    await vi.runAllTimersAsync()
    await done
    vi.useRealTimers()
    expect(resume).toHaveBeenCalledTimes(3)

    setActivePinia(createPinia())
    resume.mockReset()
    resume.mockRejectedValue(new FakeUnauthorized())
    const s2 = useSessionStore()
    await s2.initialize()
    expect(resume).toHaveBeenCalledTimes(1)
    expect(s2.resumeFailed).toBe(false)
  })

  it('persists credentials on setSession and clears them (and the key) on logout', async () => {
    const store = memoryStore()
    configureSessionStorage(store)
    storeSigningKeySeed('id-1', new Uint8Array([9]))
    const s = useSessionStore()
    await s.setSession(fakeSession as never)
    expect(store.data).toMatchObject({ 'avalon:session:token': 'tok-1', 'avalon:session:identityId': 'id-1' })

    await s.logout()
    expect(store.data).toEqual({})
    expect(localStorage.getItem('avalon:signingKey:id-1')).toBeNull()
    expect(s.isAuthenticated()).toBe(false)
  })
})

describe('session store resume backoff', () => {
  const startResume = () => {
    configureSessionStorage(memoryStore({ 'avalon:session:token': 'tok-1', 'avalon:session:identityId': 'id-1' }))
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
