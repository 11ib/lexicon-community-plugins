// Probe 2: the shape of _vars and of the objects handed to plugins.
// Read-only. Select a few tracks (ideally from the sandbox playlist) before running.

const results = {}

results.probe = 'vars'
results.ranAt = new Date().toISOString()

function shortValue(value) {
  if (value === null) {
    return null
  }

  if (typeof value === 'string') {
    if (value.length > 80) {
      return value.slice(0, 80) + '...'
    }

    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  if (Array.isArray(value)) {
    return '[Array len=' + value.length + ']'
  }

  if (typeof value === 'object') {
    return '[Object keys=' + Object.keys(value).join('|') + ']'
  }

  return '[' + typeof value + ']'
}

// Describe an object's own + inherited members without walking into it deeply.
function describe(obj) {
  const out = []

  if (obj === null || typeof obj !== 'object') {
    return out
  }

  let seen = {}
  let current = obj

  while (current !== null && current !== Object.prototype) {
    for (const key of Object.getOwnPropertyNames(current)) {
      if (seen[key] === true) {
        continue
      }

      seen[key] = true

      let entry = { key: key, type: 'unreadable', sample: null }

      try {
        const value = obj[key]
        entry.type = typeof value
        entry.sample = shortValue(value)
      } catch (err) {
        entry.type = 'throws'
        entry.sample = err.message
      }

      out.push(entry)
    }

    current = Object.getPrototypeOf(current)
  }

  return out
}

// --- _vars itself ---
results.varsKeys = []

for (const key of Object.keys(_vars)) {
  let entry = { key: key, type: 'unreadable', isArray: false, length: null, sample: null }

  try {
    const value = _vars[key]
    entry.type = typeof value
    entry.isArray = Array.isArray(value)
    entry.length = Array.isArray(value) ? value.length : null
    entry.sample = shortValue(value)
  } catch (err) {
    entry.type = 'throws'
    entry.sample = err.message
  }

  results.varsKeys.push(entry)
}

results.varsAllMembers = describe(_vars)

// --- track object shape ---
results.selectedCount = _vars.tracksSelected ? _vars.tracksSelected.length : 0
results.tracksAllAmount = _vars.tracksAllAmount

if (_vars.tracksSelected && _vars.tracksSelected.length > 0) {
  const track = _vars.tracksSelected[0]

  results.trackMembers = describe(track)
  results.trackIsPlainObject = Object.getPrototypeOf(track) === Object.prototype
  results.trackConstructorName = track.constructor ? track.constructor.name : null
  results.trackJson = JSON.parse(JSON.stringify(track))

  // Are nested collections present and what do they look like?
  results.trackNested = {
    hasCuepoints: Array.isArray(track.cuepoints),
    cuepointSample: Array.isArray(track.cuepoints) && track.cuepoints.length > 0 ? track.cuepoints[0] : null,
    hasTempomarkers: Array.isArray(track.tempomarkers),
    tempomarkerSample: Array.isArray(track.tempomarkers) && track.tempomarkers.length > 0 ? track.tempomarkers[0] : null,
    hasTags: Array.isArray(track.tags),
    tagSample: Array.isArray(track.tags) && track.tags.length > 0 ? track.tags[0] : null
  }
} else {
  results.trackMembers = 'NO TRACKS SELECTED - rerun with tracks selected'
}

// --- playlist object shape ---
if (_vars.playlistsAll && _vars.playlistsAll.length > 0) {
  const playlist = _vars.playlistsAll.find(x => x.name === 'ZZ Plugin Harness Sandbox') || _vars.playlistsAll[0]

  results.playlistCount = _vars.playlistsAll.length
  results.playlistMembers = describe(playlist)
  results.playlistConstructorName = playlist.constructor ? playlist.constructor.name : null
  results.playlistIsFlatList = true

  // Is playlistsAll a flat array or a nested tree like the REST API returns?
  for (const item of _vars.playlistsAll) {
    if (Array.isArray(item.playlists) && item.playlists.length > 0) {
      results.playlistIsFlatList = false
      break
    }
  }

  results.playlistProbeName = playlist.name

  // getTrackIds vs getTracks: are they async, and what do they return?
  const idsReturn = playlist.getTrackIds()
  results.getTrackIdsReturnsThenable = idsReturn !== null && typeof idsReturn === 'object' && typeof idsReturn.then === 'function'

  const ids = await idsReturn
  results.getTrackIdsResult = {
    type: typeof ids,
    isArray: Array.isArray(ids),
    length: Array.isArray(ids) ? ids.length : null,
    first: Array.isArray(ids) && ids.length > 0 ? ids[0] : null,
    firstType: Array.isArray(ids) && ids.length > 0 ? typeof ids[0] : null
  }

  const tracksReturn = playlist.getTracks()
  results.getTracksReturnsThenable = tracksReturn !== null && typeof tracksReturn === 'object' && typeof tracksReturn.then === 'function'

  const tracks = await tracksReturn
  results.getTracksResult = {
    type: typeof tracks,
    isArray: Array.isArray(tracks),
    length: Array.isArray(tracks) ? tracks.length : null,
    firstKeys: Array.isArray(tracks) && tracks.length > 0 ? Object.keys(tracks[0]) : null
  }

  // Does a playlist expose a trackIds property before getTrackIds() is called?
  const fresh = _vars.playlistsAll.find(x => x.name !== playlist.name)

  if (fresh) {
    results.playlistTrackIdsBeforeCall = {
      name: fresh.name,
      hasOwn: Object.prototype.hasOwnProperty.call(fresh, 'trackIds'),
      type: typeof fresh.trackIds
    }
  }
} else {
  results.playlistMembers = 'NO PLAYLISTS'
}

// --- custom tags ---
if (_vars.customTags && _vars.customTags.length > 0) {
  results.customTagCount = _vars.customTags.length
  results.customTagMembers = describe(_vars.customTags[0])
  results.customTagSample = JSON.parse(JSON.stringify(_vars.customTags[0]))
}

if (_vars.customTagsCategories && _vars.customTagsCategories.length > 0) {
  results.customTagCategoryCount = _vars.customTagsCategories.length
  results.customTagCategorySample = JSON.parse(JSON.stringify(_vars.customTagsCategories[0]))
}

_files.write('vars.json', JSON.stringify(results, null, 2))

_helpers.Report('Wrote vars.json')
_helpers.Report('_vars keys: ' + Object.keys(_vars).join(', '))
_helpers.Report('Selected tracks: ' + results.selectedCount)
