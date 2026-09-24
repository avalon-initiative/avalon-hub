// Request volume for a representative navigation sequence through the persistent shell.
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HubShell from '../../src/views/HubShell.vue'
import Home from '../../src/views/Home.vue'
import Friends from '../../src/views/Friends.vue'
import Guilds from '../../src/views/Guilds.vue'
import { useSessionStore } from '../../src/api/session'
import { FakeWebSocket, mockFetchByPath } from '../testing/fakes'

const guildBase = { name: 'G', tag: 'G', description: '', member_count: 1, created_at: 'now', icon: null }

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  vi.stubGlobal('WebSocket', FakeWebSocket)
  mockFetchByPath({
    '/me': { identity_id: 'id-1', identity_created_at: 'now', display_name: 'Avalon User', avatar_url: null },
    '/me/presence': { identity_id: 'id-1', status: 'Online', playing: null, updated_at: 'now' },
    '/me/guilds': [
      { guild_id: 'g1', role_index: 0, joined_at: 'now' },
      { guild_id: 'g2', role_index: 0, joined_at: 'now' },
    ],
    '/guilds/g1': { ...guildBase, id: 'g1' },
    '/guilds/g2': { ...guildBase, id: 'g2' },
    '/conversations': [
      { id: 'c1', participants: ['id-1', 'id-2'] },
      { id: 'c2', participants: ['id-1', 'id-3'] },
    ],
  })
})

describe('shell request volume', () => {
  it('does not repeat shared guild reads across navigations', async () => {
    localStorage.setItem('avalon:session:token', 'a-token')
    await useSessionStore().initialize()
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/',
          component: HubShell,
          children: [
            { path: 'home', name: 'home', component: Home },
            { path: 'friends', name: 'friends', component: Friends },
            { path: 'guilds', name: 'guilds', component: Guilds },
            { path: 'guilds/:id', name: 'guild', component: { template: '<div />' } },
            { path: 'messages', name: 'messages', component: { template: '<div />' } },
            { path: 'integrations/:slug', name: 'integration-profile', component: { template: '<div />' } },
            { path: 'connections', name: 'connections', component: { template: '<div />' } },
            { path: 'guilds/:id/channels/:cid', name: 'guild-channel', component: { template: '<div />' } },
          ],
        },
      ],
    })
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    router.push('/home')
    await router.isReady()
    mount({ template: '<RouterView />' }, { global: { plugins: [router] } })
    await flushPromises()
    const paths = (from: number) =>
      fetchMock.mock.calls.slice(from).map((c) => new URL(c[0], 'http://t').pathname)
    const navigate = async (to: string) => {
      const before = fetchMock.mock.calls.length
      await router.push(to)
      await flushPromises()
      return paths(before)
    }
    const sharedGuildReads = ['/me/guilds', '/me/guild-invites', '/guilds/g1', '/guilds/g2']

    // Shell startup and the first page fetch each shared guild read once.
    for (const path of sharedGuildReads) expect(paths(0).filter((p) => p === path)).toHaveLength(1)

    await navigate('/friends')
    // Guilds data was loaded moments ago by the shell and Home, so no guild read repeats.
    expect(await navigate('/guilds')).toEqual([])
    const home = await navigate('/home')
    for (const path of sharedGuildReads) expect(home).not.toContain(path)
    expect(home).toHaveLength(6)
  })
})
