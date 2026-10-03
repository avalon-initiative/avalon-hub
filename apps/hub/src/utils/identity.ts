import { isIdentityId, type AccountSession } from '@avalon-initiative/protocol-sdk'

const HEX_64_ANY_CASE = /^[0-9a-f]{64}$/i

/** Resolves an "identity id or handle" input: a canonical id is used as-is, anything else is a handle
 * to resolve. A 64-hex string that is not canonical (uppercase) is rejected, never sent as a handle. */
export async function resolveIdentityTarget(
  session: Pick<AccountSession, 'resolveHandle'>,
  input: string,
): Promise<string> {
  if (isIdentityId(input)) return input
  if (HEX_64_ANY_CASE.test(input)) throw new Error('Identity ids are lowercase hex.')
  return session.resolveHandle(input)
}

/** First 8 and last 4 characters of an id with an ellipsis; short strings are returned unchanged. */
export function shortId(id: string): string {
  return id.length <= 16 ? id : `${id.slice(0, 8)}…${id.slice(-4)}`
}
