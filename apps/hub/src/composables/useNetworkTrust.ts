// Verifies the connected server's Signed Tree Head against the published
// trust-anchor list, so `HubShell.vue` can show — always visibly, never
// buried in settings — whether this session is talking to a pinned, verified
// Avalon network.
import { onMounted, ref } from 'vue'
import {
  AvalonClient,
  fetchTrustAnchors,
  type NetworkTrustStatus,
  type TrustAnchorEntry,
} from '@avalon-initiative/protocol-sdk'
import { getServerUrl } from '../api/serverUrl'

export type NetworkTrustState = { kind: 'loading' } | NetworkTrustStatus

export function useNetworkTrust() {
  const state = ref<NetworkTrustState>({ kind: 'loading' })
  const knownNetworks = ref<TrustAnchorEntry[]>([])

  async function refresh() {
    state.value = { kind: 'loading' }
    const [status, anchors] = await Promise.all([
      new AvalonClient({ serverUrl: getServerUrl() }).verifyNetwork(),
      fetchTrustAnchors().catch((): TrustAnchorEntry[] => []),
    ])
    knownNetworks.value = anchors
    state.value = status
  }

  onMounted(refresh)

  return { state, knownNetworks, refresh }
}
