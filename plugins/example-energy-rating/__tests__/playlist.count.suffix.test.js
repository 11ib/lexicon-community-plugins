import { describe, it, expect } from 'vitest'
import { runAction } from '@lexicon-community/harness'

const PLUGIN = new URL('..', import.meta.url).pathname

function run(overrides = {}) {
  return runAction({
    plugin: PLUGIN,
    action: 'playlist.count.suffix',
    ...overrides
  })
}

describe('playlist.count.suffix', () => {
  it('appends the track count to a playlist name', async () => {
    const result = await run({
      tracks: [{ id: 1 }, { id: 2 }, { id: 3 }],
      playlists: [{ id: 10, name: 'Techno', type: '2', trackIds: [1, 2, 3] }]
    })

    expect(result.playlistByName('Techno (3)')).not.toBeNull()
    expect(result.report).toEqual(['Renamed 1 playlist(s)'])
  })

  it('replaces an existing count instead of stacking suffixes', async () => {
    const result = await run({
      tracks: [{ id: 1 }],
      playlists: [{ id: 10, name: 'House (99)', type: '2', trackIds: [1] }]
    })

    expect(result.playlists[0].name).toBe('House (1)')
  })

  it('writes (0) for an empty playlist', async () => {
    const result = await run({
      playlists: [{ id: 10, name: 'Empty', type: '2', trackIds: [] }]
    })

    expect(result.playlists[0].name).toBe('Empty (0)')
  })

  it('skips folders and smartlists', async () => {
    const result = await run({
      tracks: [{ id: 1 }],
      playlists: [
        { id: 10, name: 'A Folder', type: '1' },
        { id: 11, name: 'A Smartlist', type: '3' },
        { id: 12, name: 'Real', type: '2', trackIds: [1] }
      ]
    })

    expect(result.playlists[0].name).toBe('A Folder')
    expect(result.playlists[1].name).toBe('A Smartlist')
    expect(result.playlists[2].name).toBe('Real (1)')
    expect(result.report).toEqual(['Renamed 1 playlist(s)'])
  })

  it('does not rename when the suffix is already right', async () => {
    const result = await run({
      tracks: [{ id: 1 }],
      playlists: [{ id: 10, name: 'Stable (1)', type: '2', trackIds: [1] }]
    })

    expect(result.changes.playlists).toEqual([])
    expect(result.report).toEqual(['Renamed 0 playlist(s)'])
  })

  it('handles a name that legitimately contains parentheses', async () => {
    const result = await run({
      tracks: [{ id: 1 }],
      playlists: [{ id: 10, name: 'Set (Live)', type: '2', trackIds: [1] }]
    })

    expect(result.playlists[0].name).toBe('Set (Live) (1)')
  })
})
