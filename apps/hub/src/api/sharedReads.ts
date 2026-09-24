// Short-lived cache for reads that several shell-level and page-level composables issue
// for the same data. Concurrent callers share one in-flight request; a forced read
// replaces the entry so mutation flows always see fresh data.
const entries = new Map<string, { at: number; value: Promise<unknown> }>()

/** Cache lifetime, aligned with the shell's own notification poll interval. */
export const SHARED_READ_TTL_MS = 30_000

export function cachedRead<T>(key: string, load: () => Promise<T>, options: { force?: boolean } = {}): Promise<T> {
  const hit = entries.get(key)
  if (hit && !options.force && Date.now() - hit.at < SHARED_READ_TTL_MS) return hit.value as Promise<T>
  const value = load()
  const entry = { at: Date.now(), value }
  entries.set(key, entry)
  // A failed read must not be served to the next caller.
  value.catch(() => {
    if (entries.get(key) === entry) entries.delete(key)
  })
  return value
}

/** Drops every entry whose key starts with `prefix` (all entries when omitted). */
export function invalidateSharedReads(prefix = '') {
  for (const key of [...entries.keys()]) {
    if (key.startsWith(prefix)) entries.delete(key)
  }
}

/** Guild pages mutate memberships, invites and metadata, so leaving one drops the guild reads. */
export function invalidateGuildReadsOnLeave(routeName: unknown) {
  if (typeof routeName === 'string' && routeName.startsWith('guild')) invalidateSharedReads('guilds:')
}
