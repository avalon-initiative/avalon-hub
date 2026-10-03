import { describe, expect, it } from 'vitest'
import { shortId } from '../../src/utils/identity'

describe('shortId', () => {
  it('keeps the first 8 and last 4 characters', () => {
    const id = '0123456789abcdef'.repeat(4)
    expect(shortId(id)).toBe('01234567…cdef')
  })

  it('leaves short strings alone', () => {
    expect(shortId('Nova')).toBe('Nova')
  })
})
