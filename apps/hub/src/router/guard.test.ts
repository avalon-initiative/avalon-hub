import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import router from './index'
import { useSessionStore } from '../api/session'

beforeEach(async () => {
  setActivePinia(createPinia())
  await router.replace('/login')
})

describe('auth guard', () => {
  it('redirects a signed-out visitor to login', async () => {
    await router.push('/home')
    expect(router.currentRoute.value.name).toBe('login')
  })

  it('sends a retryable resume failure to the retry screen, not login', async () => {
    useSessionStore().resumeFailed = true
    await router.push('/home')
    expect(router.currentRoute.value.name).toBe('session-unavailable')
    expect(router.currentRoute.value.query.redirect).toBe('/home')
  })
})
