// Tests for the harness itself. These are the guarantees plugin authors rely
// on, so they matter as much as any plugin's own tests.

import { describe, it, expect } from 'vitest'
import { runAction, PermissionError, makeTrack } from '../index.js'

// Build an in-memory plugin so these tests don't depend on any plugin folder.
function plugin(permissions, settings) {
  return {
    id: 'test.harness',
    author: { name: 'Test' },
    actions: [
      {
        id: 'test',
        name: 'Test',
        description: 'Harness test action.',
        config: { permissions: permissions, settings: settings }
      }
    ]
  }
}

function run(source, permissions = {}, extra = {}) {
  return runAction({
    config: plugin(permissions, extra.declaredSettings),
    action: 'test',
    source: source,
    ...extra
  })
}

describe('execution model', () => {
  it('runs a bare script body with top-level await', async () => {
    const result = await run(
      'await _helpers.Wait(5)\n_helpers.Report("done")',
      {}
    )

    expect(result.report).toEqual(['done'])
    expect(result.waits).toEqual([5])
  })

  it('persists in-place mutations to track objects', async () => {
    const result = await run(
      '_vars.tracksSelected[0].title = "changed"',
      { track: { read: ['selected'], modify: ['selected'], modifyFields: ['title'] } },
      { tracks: [{ id: 1, title: 'original' }], selected: [1] }
    )

    expect(result.trackById(1).title).toBe('changed')
    expect(result.changes.tracks).toEqual([
      { id: 1, field: 'title', from: 'original', to: 'changed' }
    ])
  })

  it('surfaces a thrown error to the caller', async () => {
    await expect(run('throw new Error("boom")')).rejects.toThrow('boom')
  })

  it('can capture the error instead of throwing', async () => {
    const result = await run('throw new Error("boom")', {}, { throwOnError: false })

    expect(result.error.message).toBe('boom')
  })

  it('rejects an action id that is not in the manifest', async () => {
    await expect(
      runAction({ config: plugin({}), action: 'nope', source: '' })
    ).rejects.toThrow(/not declared/)
  })
})

describe('permission enforcement', () => {
  it('blocks reading selected tracks without track.read', async () => {
    await expect(run('const t = _vars.tracksSelected')).rejects.toBeInstanceOf(PermissionError)
  })

  it('blocks reading playlists without playlist.read', async () => {
    await expect(run('const p = _vars.playlistsAll')).rejects.toThrow(/playlist\.read/)
  })

  it('blocks a write to a field outside modifyFields', async () => {
    await expect(
      run(
        '_vars.tracksSelected[0].bpm = 100',
        { track: { read: ['selected'], modify: ['selected'], modifyFields: ['title'] } },
        { tracks: [{ id: 1 }], selected: [1] }
      )
    ).rejects.toThrow(/modifyFields/)
  })

  it('blocks modifying an unselected track when only selected is granted', async () => {
    await expect(
      run(
        'const batch = await _library.track.getNextAllBatch()\nbatch[0].title = "x"',
        {
          track: {
            read: ['all', 'selected'],
            modify: ['selected'],
            modifyFields: ['title']
          }
        },
        { tracks: [{ id: 1 }, { id: 2 }], selected: [2] }
      )
    ).rejects.toThrow(/track\.modify/)
  })

  it('blocks network calls to a host outside the whitelist', async () => {
    await expect(
      run('await _network.GET({ url: "https://evil.com/x" })', {
        network: { GET: ['api.example.com'] }
      })
    ).rejects.toThrow(/network\.GET/)
  })

  it('allows a subdomain of a whitelisted host', async () => {
    const result = await run(
      'const r = await _network.GET({ url: "https://v2.api.example.com/x" })\n_helpers.Report(r)',
      { network: { GET: ['api.example.com'] } },
      { network: { 'v2.api.example.com': 'ok' } }
    )

    expect(result.report).toEqual(['ok'])
    expect(result.network).toHaveLength(1)
  })

  it('blocks storage without the storage permission', async () => {
    await expect(run('_storage.save("k", 1)')).rejects.toThrow(/storage/)
  })

  it('blocks _ui.control without the control permission', async () => {
    await expect(run('_ui.control("MusicPlayer_Play")')).rejects.toThrow(/control/)
  })

  it('records denials without throwing in non-strict mode', async () => {
    const result = await run('const p = _vars.playlistsAll', {}, { strictPermissions: false })

    expect(result.permissionDenials.map((d) => d.capability)).toContain('playlist.read (all)')
  })
})

describe('library behaviour', () => {
  it('pages through tracks with getNextAllBatch and ends on an empty array', async () => {
    const result = await run(
      `let sizes = []
let batch = await _library.track.getNextAllBatch()

while (batch.length > 0) {
  sizes.push(batch.length)
  batch = await _library.track.getNextAllBatch()
}

_helpers.Report(sizes.join(','))`,
      { track: { read: ['all'] } },
      { tracks: Array.from({ length: 5 }, (_, i) => ({ id: i + 1 })), batchSize: 2 }
    )

    expect(result.report).toEqual(['2,2,1'])
  })

  it('excludes archived tracks from tracksAllAmount', async () => {
    const result = await run(
      '_helpers.Report(String(_vars.tracksAllAmount))',
      { track: { read: ['all'] } },
      { tracks: [{ id: 1 }, { id: 2, archived: 1 }] }
    )

    expect(result.report).toEqual(['1'])
  })

  it('returns playlist track ids only via getTrackIds()', async () => {
    const result = await run(
      `const p = _vars.playlistsAll[0]
_helpers.Report(String(p.trackIds))
_helpers.Report((await p.getTrackIds()).join(','))`,
      { playlist: { read: ['all'] } },
      { playlists: [{ id: 1, name: 'P', trackIds: [7, 8] }] }
    )

    expect(result.report).toEqual(['undefined', '7,8'])
  })

  it('warns instead of guessing when a smartlist is queried', async () => {
    const result = await run(
      `const p = await _library.playlist.create({ name: 'S', type: '3', smartlist: { matchAll: true, rules: [] } })
_helpers.Report(String((await p.getTrackIds()).length))`,
      { playlist: { read: ['all'], create: true } }
    )

    expect(result.report).toEqual(['0'])
    expect(result.warnings[0]).toMatch(/does not evaluate smartlist rules/)
  })

  it('records created and deleted objects', async () => {
    const result = await run(
      `await _library.playlist.create({ name: 'New', type: '2' })
_library.track.delete(_vars.tracksSelected[0])`,
      {
        playlist: { create: true },
        track: { read: ['selected'], delete: true }
      },
      { tracks: [{ id: 1 }], selected: [1] }
    )

    expect(result.created.playlists[0].name).toBe('New')
    expect(result.deleted.tracks).toEqual([1])
    expect(result.tracks).toHaveLength(0)
  })
})

describe('settings, storage, dialogs and files', () => {
  it('delivers settings as strings, matching Lexicon', async () => {
    const result = await run(
      '_helpers.Report(typeof _settings["Count"] + ":" + _settings["Count"])',
      {},
      { declaredSettings: { Count: 5 } }
    )

    expect(result.report).toEqual(['string:5'])
  })

  it('lets a test override a declared setting', async () => {
    const result = await run(
      '_helpers.Report(_settings["Count"])',
      {},
      { declaredSettings: { Count: '5' }, settings: { Count: '9' } }
    )

    expect(result.report).toEqual(['9'])
  })

  it('returns null from storage for a key that was never saved', async () => {
    const result = await run(
      '_helpers.Report(String(_storage.load("missing")))',
      { storage: true }
    )

    expect(result.report).toEqual(['null'])
  })

  it('round trips storage values and exposes the final state', async () => {
    const result = await run(
      `_storage.save('obj', { a: 1 })
_helpers.Report(String(_storage.load('obj').a))`,
      { storage: true }
    )

    expect(result.report).toEqual(['1'])
    expect(result.storage.obj).toEqual({ a: 1 })
  })

  it('feeds queued answers to showInputDialog', async () => {
    const result = await run(
      `const a = await _ui.showInputDialog({ message: 'First?' })
const b = await _ui.showInputDialog({ message: 'Second?' })
_helpers.Report(a + '/' + String(b))`,
      {},
      { dialogAnswers: ['yes', null] }
    )

    expect(result.report).toEqual(['yes/null'])
    expect(result.dialogs.map((d) => d.message)).toEqual(['First?', 'Second?'])
  })

  it('fails loudly when a dialog has no queued answer', async () => {
    await expect(run('await _ui.showInputDialog({ message: "Hi" })')).rejects.toThrow(
      /no answer was queued/
    )
  })

  it('rejects unsafe filenames the way Lexicon does', async () => {
    await expect(
      run('_files.write("../escape.txt", "x")', { files: { write: true } })
    ).rejects.toThrow(/Unsafe filename/)
  })

  it('fails loudly when a network call has no mock response', async () => {
    await expect(
      run('await _network.GET({ url: "https://api.example.com/x" })', {
        network: { GET: ['api.example.com'] }
      })
    ).rejects.toThrow(/No mock response/)
  })

  it('rejects an unknown _vars key instead of returning undefined', async () => {
    await expect(run('const x = _vars.tracksAll')).rejects.toThrow(/does not exist in Lexicon/)
  })
})

describe('fixtures', () => {
  it('fills unspecified track fields with schema defaults', () => {
    const track = makeTrack({ id: 1, title: 'T', artist: 'A' })

    expect(track.bpm).toBe(0)
    expect(track.cuepoints).toEqual([])
    expect(track.locationUnique).toBe('/music/a/t.mp3')
  })
})
