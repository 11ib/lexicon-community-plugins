// A stateful fake of the Lexicon library that plugin actions run against.
//
// Track and playlist objects are Proxies so that field writes go through the
// permission checker and get recorded as a diff, which is what tests assert on.

import {
  TRACK_DEFAULTS,
  PLAYLIST_DEFAULTS,
  CUSTOM_TAG_DEFAULTS,
  CUSTOM_TAG_CATEGORY_DEFAULTS,
  RUNTIME_SPEC
} from './runtime-spec.js'

let autoId = 0

function nextId(existing) {
  const max = existing.reduce((acc, item) => Math.max(acc, item.id ?? 0), 0)
  autoId = Math.max(autoId, max)
  autoId += 1
  return autoId
}

export function makeTrack(overrides = {}) {
  const track = { ...TRACK_DEFAULTS, ...overrides }

  if (!track.location && track.title) {
    track.location = `/music/${track.artist || 'unknown'}/${track.title}.mp3`
  }

  if (!track.locationUnique) {
    track.locationUnique = String(track.location).toLowerCase()
  }

  return track
}

export function makePlaylist(overrides = {}) {
  return { ...PLAYLIST_DEFAULTS, ...overrides }
}

export function makeCustomTag(overrides = {}) {
  return { ...CUSTOM_TAG_DEFAULTS, ...overrides }
}

export function makeCustomTagCategory(overrides = {}) {
  return { ...CUSTOM_TAG_CATEGORY_DEFAULTS, ...overrides }
}

export function createLibrary(options) {
  const perms = options.permissions
  const record = options.record
  const batchSize = options.batchSize ?? RUNTIME_SPEC.trackBatchSize.value

  autoId = 0

  const rawTracks = (options.tracks ?? []).map((t, index) =>
    makeTrack({ id: t.id ?? index + 1, ...t })
  )
  const rawPlaylists = (options.playlists ?? []).map((p, index) =>
    makePlaylist({ id: p.id ?? index + 1, ...p })
  )
  const rawCustomTags = (options.customTags ?? []).map((t, index) =>
    makeCustomTag({ id: t.id ?? index + 1, ...t })
  )
  const rawCategories = (options.customTagCategories ?? []).map((c, index) =>
    makeCustomTagCategory({ id: c.id ?? index + 1, ...c })
  )

  // Which tracks / playlists count as "selected" for permission scope.
  const selectedTrackIds = new Set(options.selectedTrackIds ?? [])
  const selectedPlaylistIds = new Set(options.selectedPlaylistIds ?? [])

  // playlist id -> ordered track ids
  const playlistTracks = new Map()

  for (const playlist of rawPlaylists) {
    playlistTracks.set(playlist.id, [...(playlist.trackIds ?? [])])
    delete playlist.trackIds
  }

  const created = { tracks: [], playlists: [], customTags: [], customTagCategories: [] }
  const deleted = { tracks: [], playlists: [], customTags: [], customTagCategories: [] }

  // --- proxies -------------------------------------------------------------

  const trackProxies = new Map()

  function wrapTrack(raw) {
    if (trackProxies.has(raw.id)) {
      return trackProxies.get(raw.id)
    }

    const proxy = new Proxy(raw, {
      set(target, field, value) {
        if (typeof field !== 'string') {
          target[field] = value
          return true
        }

        const scope = selectedTrackIds.has(target.id) ? 'selected' : 'all'
        const allowed = perms.trackModify(scope, field)

        if (!allowed) {
          // Non-strict mode: mirror Lexicon's behaviour for a rejected write.
          if (RUNTIME_SPEC.modifyFieldDenialMode.value === 'ignored') {
            return true
          }
        }

        const from = target[field]

        if (from !== value) {
          record.trackChanges.push({ id: target.id, field: field, from: from, to: value })
        }

        target[field] = value
        return true
      }
    })

    trackProxies.set(raw.id, proxy)
    return proxy
  }

  const playlistProxies = new Map()

  function wrapPlaylist(raw) {
    if (playlistProxies.has(raw.id)) {
      return playlistProxies.get(raw.id)
    }

    const methods = {
      async getTrackIds() {
        const ids = playlistTracks.get(raw.id)

        if (ids === undefined) {
          if (raw.type === '3') {
            record.warnings.push(
              `getTrackIds() on smartlist "${raw.name}": the harness does not evaluate smartlist rules. ` +
                'Pass `smartlistResolver` to the harness if this action depends on the result.'
            )
          }
          return []
        }

        return [...ids]
      },

      async getTracks() {
        const ids = await methods.getTrackIds()
        return ids.map((id) => trackById(id)).filter(Boolean)
      }
    }

    const proxy = new Proxy(raw, {
      get(target, key) {
        if (key === 'getTrackIds' || key === 'getTracks') {
          return methods[key]
        }

        if (key === 'trackIds' && !Object.prototype.hasOwnProperty.call(target, 'trackIds')) {
          // Real Lexicon requires an explicit getTrackIds() call; surface that
          // rather than silently handing back data the app would not have.
          return undefined
        }

        return target[key]
      },

      set(target, field, value) {
        if (typeof field !== 'string') {
          target[field] = value
          return true
        }

        const scope = selectedPlaylistIds.has(target.id) ? 'selected' : 'all'
        const allowed = perms.playlistModify(scope, field)

        if (!allowed && RUNTIME_SPEC.modifyFieldDenialMode.value === 'ignored') {
          return true
        }

        if (field === 'trackIds') {
          playlistTracks.set(target.id, [...value])
          record.playlistChanges.push({ id: target.id, field: 'tracks', from: null, to: [...value] })
          target.trackIds = value
          return true
        }

        const from = target[field]

        if (from !== value) {
          record.playlistChanges.push({ id: target.id, field: field, from: from, to: value })
        }

        target[field] = value
        return true
      }
    })

    playlistProxies.set(raw.id, proxy)
    return proxy
  }

  function trackById(id) {
    const raw = rawTracks.find((t) => t.id === id)
    return raw ? wrapTrack(raw) : null
  }

  // --- _vars ---------------------------------------------------------------

  const varsSource = {
    get tracksSelected() {
      perms.trackRead('selected')
      return rawTracks.filter((t) => selectedTrackIds.has(t.id)).map(wrapTrack)
    },

    get tracksAllAmount() {
      perms.trackReadAny()
      return rawTracks.filter((t) => !t.archived).length
    },

    get playlistsAll() {
      perms.playlistRead('all')
      return rawPlaylists.map(wrapPlaylist)
    },

    get playlistsSelected() {
      perms.playlistRead('selected')
      return rawPlaylists.filter((p) => selectedPlaylistIds.has(p.id)).map(wrapPlaylist)
    },

    get customTags() {
      perms.customTagRead()
      return rawCustomTags
    },

    // The official docs call this _vars.customTagsCategories. That key does not
    // exist — reading it returns undefined and the next property access kills
    // the action. The real key, confirmed against a live library, is
    // customTagCategories (no "s" after customTag).
    get customTagCategories() {
      perms.customTagRead()
      return rawCategories
    }
  }

  const KNOWN_VARS = ['tracksSelected', 'tracksAllAmount', 'playlistsAll', 'playlistsSelected', 'customTags', 'customTagCategories']

  const vars = new Proxy(varsSource, {
    get(target, key) {
      if (typeof key === 'string' && !KNOWN_VARS.includes(key) && key !== 'then') {
        // The docs' spelling is wrong and it fails silently in the app, so call
        // it out by name rather than leaving someone to guess.
        if (key === 'customTagsCategories') {
          throw new Error(
            '_vars.customTagsCategories does not exist — the official docs are wrong. ' +
              'Use _vars.customTagCategories (no "s" after customTag). In Lexicon the ' +
              'documented spelling returns undefined and kills the action on the next ' +
              'property access.'
          )
        }

        throw new Error(
          `_vars.${key} does not exist in Lexicon. Available: ${KNOWN_VARS.join(', ')}`
        )
      }

      return target[key]
    },

    ownKeys() {
      return KNOWN_VARS
    },

    getOwnPropertyDescriptor() {
      return { enumerable: true, configurable: true }
    }
  })

  // --- _library ------------------------------------------------------------

  let batchCursor = 0

  const library = {
    track: {
      async getNextAllBatch() {
        perms.trackRead('all')

        const batch = rawTracks.slice(batchCursor, batchCursor + batchSize)
        batchCursor += batch.length

        return batch.map(wrapTrack)
      },

      async create(locations) {
        perms.trackCreate()

        const list = Array.isArray(locations) ? locations : [locations]
        const madeTracks = []

        for (const location of list) {
          const raw = makeTrack({ id: nextId(rawTracks), location: location })
          rawTracks.push(raw)
          created.tracks.push(raw)
          madeTracks.push(wrapTrack(raw))
        }

        return madeTracks
      },

      delete(track) {
        perms.trackDelete()

        const id = track?.id ?? track
        deleted.tracks.push(id)

        const index = rawTracks.findIndex((t) => t.id === id)

        if (index >= 0) {
          rawTracks.splice(index, 1)
        }
      }
    },

    playlist: {
      async create(params = {}) {
        perms.playlistCreate()

        const raw = makePlaylist({
          id: nextId(rawPlaylists),
          name: params.name ?? '',
          parentId: params.parentId ?? null,
          type: params.type ?? '2',
          smartlist: params.smartlist
        })

        rawPlaylists.push(raw)
        created.playlists.push(raw)

        if (raw.type !== '3') {
          playlistTracks.set(raw.id, [])
        } else if (options.smartlistResolver) {
          playlistTracks.set(raw.id, options.smartlistResolver(raw.smartlist, rawTracks.map(wrapTrack)))
        }

        return wrapPlaylist(raw)
      },

      delete(playlist) {
        perms.playlistDelete()

        const id = playlist?.id ?? playlist
        deleted.playlists.push(id)

        const index = rawPlaylists.findIndex((p) => p.id === id)

        if (index >= 0) {
          rawPlaylists.splice(index, 1)
        }
      }
    },

    customTag: {
      async create(params = {}) {
        perms.customTagCreate()

        const raw = makeCustomTag({
          id: nextId(rawCustomTags),
          name: params.name ?? '',
          categoryId: params.categoryId ?? null
        })

        rawCustomTags.push(raw)
        created.customTags.push(raw)
        return raw
      },

      delete(tag) {
        perms.customTagDelete()

        const id = tag?.id ?? tag
        deleted.customTags.push(id)

        const index = rawCustomTags.findIndex((t) => t.id === id)

        if (index >= 0) {
          rawCustomTags.splice(index, 1)
        }
      }
    },

    customTagCategory: {
      async create(params = {}) {
        perms.customTagCreate()

        const raw = makeCustomTagCategory({
          id: nextId(rawCategories),
          name: params.name ?? ''
        })

        rawCategories.push(raw)
        created.customTagCategories.push(raw)
        return raw
      },

      delete(category) {
        perms.customTagDelete()

        const id = category?.id ?? category
        deleted.customTagCategories.push(id)

        const index = rawCategories.findIndex((c) => c.id === id)

        if (index >= 0) {
          rawCategories.splice(index, 1)
        }
      }
    }
  }

  return {
    vars: vars,
    library: library,
    created: created,
    deleted: deleted,
    snapshot() {
      return {
        tracks: rawTracks.map((t) => ({ ...t })),
        playlists: rawPlaylists.map((p) => ({
          ...p,
          trackIds: [...(playlistTracks.get(p.id) ?? [])]
        })),
        customTags: rawCustomTags.map((t) => ({ ...t })),
        customTagCategories: rawCategories.map((c) => ({ ...c }))
      }
    }
  }
}
