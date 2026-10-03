import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import router from '../../src/router/index'
import { useSessionStore } from '../../src/api/session'
import { testIdentityId } from '../testing/identityIds'

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

  it('only routes a canonical identity id to a user profile', async () => {
    const session = useSessionStore()
    session.session = { token: () => 't', identity: () => ({ id: testIdentityId('me') }) } as never
    await router.push('/users/not-an-id')
    expect(router.currentRoute.value.name).toBe('friends')
    await router.push(`/users/${testIdentityId('them').toUpperCase()}`)
    expect(router.currentRoute.value.name).toBe('friends')
    await router.push(`/users/${testIdentityId('them')}`)
    expect(router.currentRoute.value.name).toBe('user-profile')
  })
})
