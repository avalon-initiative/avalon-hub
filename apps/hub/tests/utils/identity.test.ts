import { describe, expect, it, vi } from 'vitest'
import { resolveIdentityTarget, shortId } from '../../src/utils/identity'
import { testIdentityId } from '../testing/identityIds'

describe('resolveIdentityTarget', () => {
  const resolveHandle = vi.fn()
  const session = { resolveHandle }

  it('passes a canonical id straight through without resolving', async () => {
    resolveHandle.mockClear()
    const id = testIdentityId('a')
    expect(await resolveIdentityTarget(session, id)).toBe(id)
    expect(resolveHandle).not.toHaveBeenCalled()
  })

  it('resolves anything else as a handle', async () => {
    resolveHandle.mockResolvedValue('resolved')
    expect(await resolveIdentityTarget(session, 'Nova')).toBe('resolved')
    expect(resolveHandle).toHaveBeenCalledWith('Nova')
    await resolveIdentityTarget(session, '33333333-4444-5555-6666-777777777777')
    expect(resolveHandle).toHaveBeenLastCalledWith('33333333-4444-5555-6666-777777777777')
  })

  it('never sends a 64-hex string to the handle lookup', async () => {
    resolveHandle.mockClear()
    await expect(resolveIdentityTarget(session, testIdentityId('a').toUpperCase())).rejects.toThrow('lowercase')
    expect(resolveHandle).not.toHaveBeenCalled()
  })
})

describe('shortId', () => {
  it('keeps the first 8 and last 4 characters', () => {
    const id = testIdentityId('a')
    expect(shortId(id)).toBe(`${id.slice(0, 8)}…${id.slice(-4)}`)
    expect(shortId(id)).toHaveLength(13)
  })

  it('leaves short strings alone', () => {
    expect(shortId('Nova')).toBe('Nova')
    expect(shortId('0123456789abcdef')).toBe('0123456789abcdef')
  })
})
