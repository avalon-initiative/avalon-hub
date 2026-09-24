// Session state backed by a real `@avalon-initiative/protocol-sdk` AccountSession.
// The store holds the live session object; views call methods on `session.value`
// directly rather than passing a raw token to free functions.
//
// Credentials (token, identity id) persist through the configurable
// KeyValueStore in ./sessionStorage, which is the OS keychain in the Tauri build.
// The signing-key seed is per-identity and stays in localStorage
// (./signingKeyStorage).
//
// `initialize()` does a real GET /me round trip, since constructing an
// AccountSession requires one. Only an UnauthorizedError clears stored
// credentials; any other failure is retried a bounded number of times, then
// leaves them untouched and sets `resumeFailed` so the router shows a retry
// screen instead of the login page.
import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { AvalonClient, RateLimitedError, UnauthorizedError, type AccountSession } from '@avalon-initiative/protocol-sdk'
import { getServerUrl } from './serverUrl'
import { getSessionStorage } from './sessionStorage'
import { clearSigningKeySeed, loadSigningKeySeed } from './signingKeyStorage'

const TOKEN_STORAGE_KEY = 'avalon:session:token'
const IDENTITY_ID_STORAGE_KEY = 'avalon:session:identityId'

// Attempts made by one initialize(); the delay doubles between attempts.
export const RESUME_ATTEMPTS = 3
export const RESUME_BASE_DELAY_MS = 1000
// Upper bound on a server-requested Retry-After between resume attempts.
export const RESUME_MAX_RETRY_AFTER_MS = 10_000

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** The server's Retry-After when it sent one (capped), else the doubling backoff. */
function retryDelayMs(error: unknown, attempt: number): number {
  if (error instanceof RateLimitedError && error.retryAfterSeconds !== undefined) {
    return Math.min(error.retryAfterSeconds * 1000, RESUME_MAX_RETRY_AFTER_MS)
  }
  return RESUME_BASE_DELAY_MS * 2 ** (attempt - 1)
}

export function avalonClient(): AvalonClient {
  return new AvalonClient({ serverUrl: getServerUrl() })
}

export const useSessionStore = defineStore('accountSession', () => {
  const session = shallowRef<AccountSession | null>(null)
  // False until `initialize()` resolves; main.ts awaits it once before mounting,
  // so route guards and every call site see final state.
  const ready = ref(false)
  // True when a stored token exists but resuming failed for a reason other than rejection.
  const resumeFailed = ref(false)

  async function persist(newSession: AccountSession) {
    const store = getSessionStorage()
    await Promise.all([
      store.setItem(TOKEN_STORAGE_KEY, newSession.token()),
      store.setItem(IDENTITY_ID_STORAGE_KEY, newSession.identity().id),
    ])
  }

  async function clearStorage() {
    const store = getSessionStorage()
    await Promise.all([store.removeItem(TOKEN_STORAGE_KEY), store.removeItem(IDENTITY_ID_STORAGE_KEY)])
  }

  async function initialize() {
    const store = getSessionStorage()
    const token = await store.getItem(TOKEN_STORAGE_KEY)
    if (token) {
      const identityId = await store.getItem(IDENTITY_ID_STORAGE_KEY)
      const seed = identityId ? loadSigningKeySeed(identityId) : null
      resumeFailed.value = await resume(token, seed)
    } else {
      resumeFailed.value = false
    }
    ready.value = true
  }

  /** Resumes `token`, retrying non-rejection failures with backoff. Returns true when every
   * attempt failed; a rejected token clears storage and returns false. */
  async function resume(token: string, seed: Uint8Array | null): Promise<boolean> {
    for (let attempt = 1; attempt <= RESUME_ATTEMPTS; attempt++) {
      try {
        session.value = seed
          ? await avalonClient().resumeAccountSessionWithSigningKey(token, seed)
          : await avalonClient().resumeAccountSession(token)
        return false
      } catch (e) {
        if (e instanceof UnauthorizedError) {
          await clearStorage()
          return false
        }
        if (attempt < RESUME_ATTEMPTS) await sleep(retryDelayMs(e, attempt))
      }
    }
    return true
  }

  /** Adopts `newSession` as the active session and persists its credentials. */
  async function setSession(newSession: AccountSession) {
    session.value = newSession
    await persist(newSession)
  }

  async function logout() {
    const identityId = session.value?.identity().id
    session.value = null
    await clearStorage()
    if (identityId) clearSigningKeySeed(identityId)
  }

  const isAuthenticated = () => session.value !== null
  const identityId = () => session.value?.identity().id ?? null
  const signingKeyId = () => session.value?.signingKeyId() ?? null

  return { session, ready, resumeFailed, initialize, setSession, logout, isAuthenticated, identityId, signingKeyId }
})
