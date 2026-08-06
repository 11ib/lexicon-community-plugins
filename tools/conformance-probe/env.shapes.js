// R3: shapes of the objects Lexicon hands to plugins.
//
// Round 2 died on "Cannot get property 'length' of undefined" reading
// _vars.tracksSelected, so this version guards every access and records stages.
// Run it once WITH sandbox tracks selected. If tracksSelected is undefined
// rather than an empty array when nothing is selected, that itself matters —
// plugins would need a guard the docs never mention.

const results = { probe: 'env.shapes.r3', lastCompleted: 'none' }

function save() {
  _files.write('env-shapes.json', JSON.stringify(results, null, 2))
}

results.ranAt = new Date().toISOString()
save()

// Read tracksSelected BEFORE anything else touches _vars. Round 2 read it
// after Object.keys(_vars) and a batch of typeof checks, and got undefined
// despite tracks genuinely being selected.
const earlyRead = _vars.tracksSelected

results.earlyRead = {
  type: typeof earlyRead,
  isArray: Array.isArray(earlyRead),
  length: Array.isArray(earlyRead) ? earlyRead.length : null
}

results.lastCompleted = 'early-tracksSelected'
save()

results.varsKeys = Object.keys(_vars)
results.lastCompleted = 'varsKeys'
save()

results.globals = [
  { name: 'require', type: typeof require },
  { name: 'window', type: typeof window },
  { name: 'document', type: typeof document },
  { name: 'globalThis', type: typeof globalThis },
  { name: 'process', type: typeof process },
  { name: 'console', type: typeof console },
  { name: 'fetch', type: typeof fetch },
  { name: 'setTimeout', type: typeof setTimeout },
  { name: 'Symbol', type: typeof Symbol },
  { name: 'Map', type: typeof Map },
  { name: 'Set', type: typeof Set },
  { name: 'Proxy', type: typeof Proxy },
  { name: 'structuredClone', type: typeof structuredClone },
  { name: 'URL', type: typeof URL }
]

results.lastCompleted = 'globals'
save()

// --- tracks --------------------------------------------------------------

const selected = _vars.tracksSelected

results.tracksSelectedType = typeof selected
results.tracksSelectedIsUndefined = selected === undefined
results.tracksSelectedIsArray = Array.isArray(selected)
results.selectedCount = Array.isArray(selected) ? selected.length : null
results.lastCompleted = 'tracksSelected-type'
save()

if (Array.isArray(selected) && selected.length > 0) {
  const track = selected[0]

  results.trackKeys = Object.keys(track)
  results.trackTypes = []

  for (const key of Object.keys(track)) {
    results.trackTypes.push({ key: key, type: typeof track[key] })
  }

  results.trackJson = JSON.parse(JSON.stringify(track))
  results.lastCompleted = 'track-shape'
  save()

  if (Array.isArray(track.cuepoints) && track.cuepoints.length > 0) {
    results.trackCuepointSample = track.cuepoints[0]
  }

  if (Array.isArray(track.tempomarkers) && track.tempomarkers.length > 0) {
    results.trackTempomarkerSample = track.tempomarkers[0]
  }

  results.lastCompleted = 'track-nested'
  save()
}

// --- playlists -----------------------------------------------------------

const playlists = _vars.playlistsAll

results.playlistsAllType = typeof playlists
results.playlistCount = Array.isArray(playlists) ? playlists.length : null
results.lastCompleted = 'playlistsAll-type'
save()

if (Array.isArray(playlists) && playlists.length > 0) {
  results.playlistsWithNestedChildren = 0

  for (const item of playlists) {
    if (Array.isArray(item.playlists)) {
      results.playlistsWithNestedChildren += 1
    }
  }

  results.lastCompleted = 'playlist-nesting'
  save()

  let target = playlists.find(x => x.name === 'ZZ Plugin Harness Sandbox')

  if (!target) {
    target = playlists[0]
  }

  results.playlistProbeName = target.name
  results.playlistKeys = Object.keys(target)
  results.playlistTypes = []

  for (const key of Object.keys(target)) {
    results.playlistTypes.push({ key: key, type: typeof target[key] })
  }

  results.getTrackIdsType = typeof target.getTrackIds
  results.getTracksType = typeof target.getTracks
  results.trackIdsPropertyBeforeCall = typeof target.trackIds
  results.lastCompleted = 'playlist-shape'
  save()

  const idsCall = target.getTrackIds()

  results.getTrackIdsReturnsThenable =
    idsCall !== null && typeof idsCall === 'object' && typeof idsCall.then === 'function'

  const ids = await idsCall

  results.idsIsArray = Array.isArray(ids)
  results.idsLength = Array.isArray(ids) ? ids.length : null
  results.idsSample = Array.isArray(ids) ? ids.slice(0, 5) : null
  results.idsFirstType = Array.isArray(ids) && ids.length > 0 ? typeof ids[0] : null
  results.trackIdsPropertyAfterCall = typeof target.trackIds
  results.lastCompleted = 'getTrackIds'
  save()

  const tracksCall = target.getTracks()

  results.getTracksReturnsThenable =
    tracksCall !== null && typeof tracksCall === 'object' && typeof tracksCall.then === 'function'

  const tracks = await tracksCall

  results.tracksLength = Array.isArray(tracks) ? tracks.length : null
  results.tracksFirstKeys = Array.isArray(tracks) && tracks.length > 0 ? Object.keys(tracks[0]) : null
  results.lastCompleted = 'getTracks'
  save()
}

// --- custom tags ---------------------------------------------------------

const tags = _vars.customTags

results.customTagsType = typeof tags
results.customTagCount = Array.isArray(tags) ? tags.length : null

if (Array.isArray(tags) && tags.length > 0) {
  results.customTagKeys = Object.keys(tags[0])
  results.customTagSample = JSON.parse(JSON.stringify(tags[0]))
}

results.lastCompleted = 'customTags'
save()

const categories = _vars.customTagsCategories

results.customTagCategoryCount = Array.isArray(categories) ? categories.length : null

if (Array.isArray(categories) && categories.length > 0) {
  results.customTagCategoryKeys = Object.keys(categories[0])
  results.customTagCategorySample = JSON.parse(JSON.stringify(categories[0]))
}

results.lastCompleted = 'customTagCategories'
results.finished = true
save()

_helpers.Report('Selected tracks: ' + results.selectedCount)
_helpers.Report('Playlists: ' + results.playlistCount)
_helpers.Report('Custom tags: ' + results.customTagCount)
