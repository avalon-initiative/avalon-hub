import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

const { verifyNetwork, fetchTrustAnchors } = vi.hoisted(() => ({
  verifyNetwork: vi.fn(),
  fetchTrustAnchors: vi.fn(),
}))

vi.mock('@avalon-initiative/protocol-sdk', () => ({
  AvalonClient: class {
    verifyNetwork = verifyNetwork
  },
  fetchTrustAnchors,
}))

import { useNetworkTrust } from '../../src/composables/useNetworkTrust'

const entry = { label: 'Dev', network_id: 'avalon-dev', verify_key: 'ab', signing_key_id: 'k', environment: 'dev' }

function mountComposable() {
  let api!: ReturnType<typeof useNetworkTrust>
  mount(defineComponent({ setup() { api = useNetworkTrust(); return () => h('div') } }))
  return api
}

describe('useNetworkTrust', () => {
  it('exposes the verification status and the fetched trust anchors', async () => {
    verifyNetwork.mockResolvedValue({ kind: 'verified', entry })
    fetchTrustAnchors.mockResolvedValue([entry])
    const api = mountComposable()
    expect(api.state.value).toEqual({ kind: 'loading' })
    await flushPromises()
    expect(api.state.value).toEqual({ kind: 'verified', entry })
    expect(api.knownNetworks.value).toEqual([entry])
  })

  it('keeps the verification status and shows no known networks when the list cannot be fetched', async () => {
    verifyNetwork.mockResolvedValue({ kind: 'unreachable', detail: 'trust-anchor fetch failed: 404' })
    fetchTrustAnchors.mockRejectedValue(new Error('trust-anchor fetch failed: 404'))
    const api = mountComposable()
    await flushPromises()
    expect(api.state.value.kind).toBe('unreachable')
    expect(api.knownNetworks.value).toEqual([])
  })
})
