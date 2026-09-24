// Session state, backed by a real @avalon-initiative/protocol-sdk AccountSession.
// The store holds the live session object, not just a bearer token: every other
// api/*.ts file calls methods on `session.value` directly rather than passing a
// raw token to a free function.
//
// Storage is plain localStorage. `initialize()` does a real GET /me round trip
// (constructing an AccountSession requires one). Only an actual
// UnauthorizedError clears the stored session; any other failure is retried a
// bounded number of times, then leaves storage untouched and sets `resumeFailed`
// so the router shows a retry screen instead of the login page.
import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { AvalonClient, UnauthorizedError, type AccountSession } from '@avalon-initiative/protocol-sdk'
import { getServerUrl } from './serverUrl'
import { loadSigningKeySeed, clearSigningKeySeed } from './signingKeyStorage'

const TOKEN_STORAGE_KEY = 'avalon:session:token'
const IDENTITY_ID_STORAGE_KEY = 'avalon:session:identityId'

// Attempts made by one initialize(); the delay doubles between attempts.
export const RESUME_ATTEMPTS = 3
export const RESUME_BASE_DELAY_MS = 1000

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export function avalonClient(): AvalonClient {
  return new AvalonClient({ serverUrl: getServerUrl() })
}

export const useSessionStore = defineStore('accountSession', () => {
  const session = shallowRef<AccountSession | null>(null)
  // False until `initialize()` resolves; main.ts awaits it once before
  // mounting, so route guards and every other call site see final state.
  const ready = ref(false)
  // True when a stored token exists but resuming failed for a reason other than rejection.
  const resumeFailed = ref(false)

  function persist(newSession: AccountSession) {
    localStorage.setItem(TOKEN_STORAGE_KEY, newSession.token())
    localStorage.setItem(IDENTITY_ID_STORAGE_KEY, newSession.identity().id)
  }

  function clearStorage() {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    localStorage.removeItem(IDENTITY_ID_STORAGE_KEY)
  }

  async function initialize() {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY)
    if (token) {
      const identityId = localStorage.getItem(IDENTITY_ID_STORAGE_KEY)
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
          clearStorage()
          return false
        }
        if (attempt < RESUME_ATTEMPTS) await sleep(RESUME_BASE_DELAY_MS * 2 ** (attempt - 1))
      }
    }
    return true
  }

  /** Adopts `newSession` as the active session, persisting its token/
   * identity id. Every login/register/recovery/device-pairing flow calls
   * this once it has a working `AccountSession`. */
  function setSession(newSession: AccountSession) {
    session.value = newSession
    persist(newSession)
  }

  async function logout() {
    const identityId = session.value?.identity().id
    session.value = null
    clearStorage()
    if (identityId) clearSigningKeySeed(identityId)
  }

  const isAuthenticated = () => session.value !== null
  /** The active session's own bearer token — most call sites should use
   * `session.value` directly instead; kept for the few places (the
   * websocket URL, direct fetch fallbacks) that need the raw string. */
  const token = () => session.value?.token() ?? null
  const identityId = () => session.value?.identity().id ?? null
  const signingKeyId = () => session.value?.signingKeyId() ?? null

  return { session, ready, resumeFailed, initialize, setSession, logout, isAuthenticated, token, identityId, signingKeyId }
})
