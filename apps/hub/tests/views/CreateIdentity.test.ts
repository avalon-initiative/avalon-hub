// Registration drives the real SDK ceremony against a fake server: the Hub must send the public key
// at register/start and show and store the id derived from it, never an id of its own making.
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { base64ToBytes, deriveIdentityId, isIdentityId } from '@avalon-initiative/protocol-sdk'

vi.mock('@avalon-initiative/protocol-sdk/src/crypto/webauthn', () => ({
  runRegistrationCeremony: () => Promise.resolve({}),
  runAuthenticationCeremony: () => Promise.resolve({}),
}))

import CreateIdentity from '../../src/views/CreateIdentity.vue'
import { loadSigningKeySeed } from '../../src/api/signingKeyStorage'
import { useSessionStore } from '../../src/api/session'

const meBody = (id: string) => ({
  identity_id: id,
  identity_created_at: '2026-01-01T00:00:00Z',
  display_name: 'Nova',
  avatar_url: null,
  bio: null,
  favorite_genres: [],
  pronouns: null,
  banner_url: null,
  status: null,
  links: [],
  timezone: null,
  theme_color: null,
  location: null,
  main_guild: null,
})

let registerStartBody: { identity_id: string; event_signing_public_key: string; display_name: string }

function stubServer() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const path = new URL(url, 'http://test').pathname
      const body = init?.body ? JSON.parse(init.body as string) : {}
      let response: unknown = {}
      if (path === '/identities/register/start') {
        registerStartBody = body
        response = { ticket_id: '11111111-1111-4111-8111-111111111111', network_id: 'n', shard_id: 's', challenge: { publicKey: {} } }
      } else if (path === '/identities/register/finish') {
        response = { identity_id: registerStartBody.identity_id }
      } else if (path === '/sessions/start') {
        response = { ticket_id: '22222222-2222-4222-8222-222222222222', challenge: { publicKey: {} } }
      } else if (path === '/sessions/finish') {
        response = { token: 'tok' }
      } else if (path === '/me') {
        response = meBody(registerStartBody.identity_id)
      } else if (path === '/me/devices') {
        response = [{ id: 'k1', public_key: registerStartBody.event_signing_public_key }]
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(response),
        text: () => Promise.resolve(JSON.stringify(response)),
      })
    }),
  )
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  stubServer()
})

afterEach(() => vi.unstubAllGlobals())

describe('CreateIdentity registration', () => {
  it('sends the public key first and shows the id derived from it', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'home', component: CreateIdentity },
        { path: '/login', name: 'login', component: CreateIdentity },
      ],
    })
    const wrapper = mount(CreateIdentity, { global: { plugins: [router] } })
    await wrapper.find('input').setValue('Nova')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(isIdentityId(registerStartBody.identity_id)).toBe(true)
    expect(registerStartBody.identity_id).toBe(deriveIdentityId(base64ToBytes(registerStartBody.event_signing_public_key)))
    expect(wrapper.find('code').text()).toBe(registerStartBody.identity_id)

    const continueButton = wrapper.findAll('button').find((b) => b.text() === 'Continue')!
    await continueButton.trigger('click')
    await flushPromises()
    expect(useSessionStore().identityId()).toBe(registerStartBody.identity_id)
    expect(loadSigningKeySeed(registerStartBody.identity_id)).not.toBeNull()
  })
})
