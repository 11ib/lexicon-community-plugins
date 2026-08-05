// Shapes of the objects Lexicon hands to plugins.
// Written in confirmed-safe syntax only: no ?., no Object.prototype,
// no catch bindings inside nested functions.

const results = { probe: 'env.shapes' }

results.ranAt = new Date().toISOString()
results.varsKeys = Object.keys(_vars)

results.globals = [
  { name: 'require', type: typeof require },
  { name: 'window', type: typeof window },
  { name: 'document', type: typeof document },
  { name: 'globalThis', type: typeof globalThis },
  { name: 'process', type: typeof process },
  { name: 'console', type: typeof console },
  { name: 'fetch', type: typeof fetch },
  { name: 'setTimeout', type: typeof setTimeout },
  { name: 'eval', type: typeof eval },
  { name: 'Symbol', type: typeof Symbol },
  { name: 'Map', type: typeof Map },
  { name: 'Set', type: typeof Set },
  { name: 'Proxy', type: typeof Proxy },
  { name: 'Intl', type: typeof Intl },
  { name: 'structuredClone', type: typeof structuredClone },
  { name: 'atob', type: typeof atob },
  { name: 'URL', type: typeof URL },
  { name: 'BigInt', type: typeof BigInt },
  { name: 'undefined', type: typeof undefined },
  { name: 'NaN', type: typeof NaN },
  { name: 'Infinity', type: typeof Infinity }
]

// --- tracks --------------------------------------------------------------

const selected = _vars.tracksSelected

results.selectedCount = selected.length

if (selected.length > 0) {
  const track = selected[0]

  results.trackKeys = Object.keys(track)
  results.trackTypes = []

  for (const key of Object.keys(track)) {
    results.trackTypes.push({ key: key, type: typeof track[key] })
  }

  results.trackJson = JSON.parse(JSON.stringify(track))
  results.trackHasGetters = typeof track.getTags
  results.trackCuepointSample = null

  if (Array.isArray(track.cuepoints) && track.cuepoints.length > 0) {
    results.trackCuepointSample = track.cuepoints[0]
  }

  if (Array.isArray(track.tempomarkers) && track.tempomarkers.length > 0) {
    results.trackTempomarkerSample = track.tempomarkers[0]
  }
}

// --- playlists -----------------------------------------------------------

const playlists = _vars.playlistsAll

results.playlistCount = playlists.length
results.playlistsWithNestedChildren = 0

for (const item of playlists) {
  if (Array.isArray(item.playlists)) {
    results.playlistsWithNestedChildren += 1
  }
}

let target = playlists.find(x => x.name === 'ZZ Plugin Harness Sandbox')

if (!target) {
  target = playlists[0]
}

if (target) {
  results.playlistProbeName = target.name
  results.playlistKeys = Object.keys(target)
  results.playlistTypes = []

  for (const key of Object.keys(target)) {
    results.playlistTypes.push({ key: key, type: typeof target[key] })
  }

  results.getTrackIdsType = typeof target.getTrackIds
  results.getTracksType = typeof target.getTracks
  results.trackIdsPropertyBeforeCall = typeof target.trackIds

  const idsCall = target.getTrackIds()

  results.getTrackIdsReturnsThenable =
    idsCall !== null && typeof idsCall === 'object' && typeof idsCall.then === 'function'

  const ids = await idsCall

  results.idsIsArray = Array.isArray(ids)
  results.idsLength = ids.length
  results.idsSample = ids.slice(0, 5)
  results.idsFirstType = ids.length > 0 ? typeof ids[0] : null
  results.trackIdsPropertyAfterCall = typeof target.trackIds

  const tracksCall = target.getTracks()

  results.getTracksReturnsThenable =
    tracksCall !== null && typeof tracksCall === 'object' && typeof tracksCall.then === 'function'

  const tracks = await tracksCall

  results.tracksLength = tracks.length
  results.tracksFirstKeys = tracks.length > 0 ? Object.keys(tracks[0]) : null
}

// --- custom tags ---------------------------------------------------------

const tags = _vars.customTags

results.customTagCount = tags.length

if (tags.length > 0) {
  results.customTagKeys = Object.keys(tags[0])
  results.customTagSample = JSON.parse(JSON.stringify(tags[0]))
}

const categories = _vars.customTagsCategories

results.customTagCategoryCount = categories.length

if (categories.length > 0) {
  results.customTagCategoryKeys = Object.keys(categories[0])
  results.customTagCategorySample = JSON.parse(JSON.stringify(categories[0]))
}

_files.write('env-shapes.json', JSON.stringify(results, null, 2))

_helpers.Report('_vars keys: ' + results.varsKeys.join(', '))
_helpers.Report('Selected tracks: ' + results.selectedCount)
_helpers.Report('Playlists: ' + results.playlistCount)
_helpers.Report('Custom tags: ' + results.customTagCount)
