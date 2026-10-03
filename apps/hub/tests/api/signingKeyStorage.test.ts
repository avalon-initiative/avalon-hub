import { beforeEach, describe, expect, it } from 'vitest'
import { clearStaleSigningKeys, loadSigningKeySeed, storeSigningKeySeed } from '../../src/api/signingKeyStorage'
import { testIdentityId } from '../testing/identityIds'

beforeEach(() => localStorage.clear())

describe('clearStaleSigningKeys', () => {
  it('removes keys filed under a non-canonical id and keeps current ones', () => {
    const id = testIdentityId('a')
    storeSigningKeySeed(id, new Uint8Array([1, 2, 3]))
    localStorage.setItem('avalon:signingKey:33333333-4444-5555-6666-777777777777', 'AQID')
    localStorage.setItem('unrelated', 'x')
    clearStaleSigningKeys()
    expect(localStorage.getItem('avalon:signingKey:33333333-4444-5555-6666-777777777777')).toBeNull()
    expect(loadSigningKeySeed(id)).toEqual(new Uint8Array([1, 2, 3]))
    expect(localStorage.getItem('unrelated')).toBe('x')
  })
})
