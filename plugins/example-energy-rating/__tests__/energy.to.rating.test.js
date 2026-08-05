import { describe, it, expect } from 'vitest'
import { runAction, PermissionError } from '@lexicon-community/harness'

const PLUGIN = new URL('..', import.meta.url).pathname

function run(overrides = {}) {
  return runAction({
    plugin: PLUGIN,
    action: 'energy.to.rating',
    ...overrides
  })
}

describe('energy.to.rating', () => {
  it('converts energy to stars at the default 2 energy per star', async () => {
    const result = await run({
      tracks: [
        { id: 1, title: 'Low', energy: 2 },
        { id: 2, title: 'Mid', energy: 6 },
        { id: 3, title: 'High', energy: 10 }
      ],
      selected: [1, 2, 3]
    })

    expect(result.trackById(1).rating).toBe(1)
    expect(result.trackById(2).rating).toBe(3)
    expect(result.trackById(3).rating).toBe(5)
    expect(result.report).toEqual(['Updated 3 track(s)'])
  })

  it('honours the Energy Per Star setting', async () => {
    const result = await run({
      tracks: [{ id: 1, energy: 10 }],
      selected: [1],
      settings: { 'Energy Per Star': '5' }
    })

    expect(result.trackById(1).rating).toBe(2)
  })

  it('clamps to 5 stars when energy exceeds the scale', async () => {
    const result = await run({
      tracks: [{ id: 1, energy: 10 }],
      selected: [1],
      settings: { 'Energy Per Star': '1' }
    })

    expect(result.trackById(1).rating).toBe(5)
  })

  it('leaves tracks with no energy value alone and reports them', async () => {
    const result = await run({
      tracks: [
        { id: 1, energy: 0, rating: 3 },
        { id: 2, energy: 8 }
      ],
      selected: [1, 2]
    })

    expect(result.trackById(1).rating).toBe(3)
    expect(result.report).toContain('Skipped 1 track(s) with no energy value')
  })

  it('only touches selected tracks', async () => {
    const result = await run({
      tracks: [
        { id: 1, energy: 8 },
        { id: 2, energy: 8 }
      ],
      selected: [1]
    })

    expect(result.trackById(1).rating).toBe(4)
    expect(result.trackById(2).rating).toBe(0)
    expect(result.changes.tracks).toHaveLength(1)
  })

  it('does not rewrite a rating that is already correct', async () => {
    const result = await run({
      tracks: [{ id: 1, energy: 8, rating: 4 }],
      selected: [1]
    })

    expect(result.changes.tracks).toEqual([])
    expect(result.report).toEqual(['Updated 0 track(s)'])
  })

  it('rejects a non-numeric Energy Per Star setting', async () => {
    await expect(
      run({
        tracks: [{ id: 1, energy: 8 }],
        selected: [1],
        settings: { 'Energy Per Star': 'banana' }
      })
    ).rejects.toThrow('"Energy Per Star" must be a positive number')
  })

  it('rejects zero energy per star instead of dividing by zero', async () => {
    await expect(
      run({
        tracks: [{ id: 1, energy: 8 }],
        selected: [1],
        settings: { 'Energy Per Star': '0' }
      })
    ).rejects.toThrow('must be a positive number')
  })

  it('handles an empty selection without reporting anything odd', async () => {
    const result = await run({ tracks: [{ id: 1, energy: 8 }], selected: [] })

    expect(result.report).toEqual(['Updated 0 track(s)'])
    expect(result.changes.tracks).toEqual([])
  })

  it('is blocked from writing a field outside modifyFields', async () => {
    // config.json only grants modifyFields: ["rating"], so touching bpm must fail.
    await expect(
      runAction({
        plugin: PLUGIN,
        action: 'energy.to.rating',
        source: '_vars.tracksSelected[0].bpm = 128',
        tracks: [{ id: 1, energy: 8 }],
        selected: [1]
      })
    ).rejects.toBeInstanceOf(PermissionError)
  })

  it('is blocked from reading playlists it never asked for', async () => {
    await expect(
      runAction({
        plugin: PLUGIN,
        action: 'energy.to.rating',
        source: 'const all = _vars.playlistsAll',
        tracks: [],
        selected: []
      })
    ).rejects.toThrow(/playlist.read/)
  })
})
