// Valid identity ids for fixtures: derived from fixed test keys, like the real thing.
import { deriveIdentityId } from '@avalon-initiative/protocol-sdk'

/** The id derived from a 32-byte key built from `label`; distinct labels give distinct ids. */
export function testIdentityId(label: string) {
  const bytes = new TextEncoder().encode(label)
  return deriveIdentityId(Uint8Array.from({ length: 32 }, (_, i) => bytes[i % bytes.length]))
}
