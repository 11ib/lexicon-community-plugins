// Probe 6: how does Lexicon react when an action touches something its
// config.json did NOT grant? This action is granted ONLY track.read=selected
// and files.write.
//
// Deliberately avoids anything destructive: no deletes, no track creation.
// The one write attempt targets extra1, which is empty across this library.

const results = {}

results.probe = 'denied'
results.ranAt = new Date().toISOString()
results.attempts = []

// Run a thunk and record how it failed (or didn't).
async function attempt(label, expectation, thunk) {
  let entry = {
    label: label,
    expectation: expectation,
    outcome: null,
    threw: false,
    errorName: null,
    errorMessage: null,
    resultType: null,
    resultSample: null
  }

  try {
    let value = thunk()

    if (value !== null && typeof value === 'object' && typeof value.then === 'function') {
      value = await value
    }

    entry.threw = false
    entry.resultType = typeof value
    entry.outcome = 'returned'

    if (Array.isArray(value)) {
      entry.resultSample = 'Array len=' + value.length
    } else if (value !== null && typeof value === 'object') {
      entry.resultSample = 'Object keys=' + Object.keys(value).slice(0, 12).join('|')
    } else {
      entry.resultSample = String(value)
    }
  } catch (err) {
    entry.threw = true
    entry.outcome = 'threw'
    entry.errorName = err.name
    entry.errorMessage = err.message
  }

  results.attempts.push(entry)
}

// --- granted: baseline sanity ---
await attempt('_vars.tracksSelected (GRANTED)', 'works', function () {
  return _vars.tracksSelected
})

// --- reads we were not granted ---
await attempt('_vars.playlistsAll (NOT granted)', 'denied', function () {
  return _vars.playlistsAll
})

await attempt('_vars.customTags (NOT granted)', 'denied', function () {
  return _vars.customTags
})

await attempt('_vars.customTagsCategories (NOT granted)', 'denied', function () {
  return _vars.customTagsCategories
})

await attempt('_vars.tracksAllAmount (read=selected only)', 'unknown', function () {
  return _vars.tracksAllAmount
})

await attempt('_library.track.getNextAllBatch (read=selected only)', 'denied', function () {
  return _library.track.getNextAllBatch()
})

// --- capabilities we were not granted (non-destructive only) ---
await attempt('_storage.save (NOT granted)', 'denied', function () {
  return _storage.save('probe.denied.key', 'should not persist')
})

await attempt('_storage.load (NOT granted)', 'denied', function () {
  return _storage.load('probe.denied.key')
})

await attempt('_network.GET (NOT granted)', 'denied', function () {
  return _network.GET({ url: 'https://example.com', headers: {} })
})

await attempt('_files.read (only write granted)', 'unknown', function () {
  return _files.read('env.json')
})

await attempt('_files.list (only write granted)', 'unknown', function () {
  return _files.list()
})

await attempt('_musicplayer.getNowPlaying (no perm declared)', 'works', function () {
  return _musicplayer.getNowPlaying()
})

await attempt('_ui.control with unknown action (control NOT granted)', 'denied', function () {
  return _ui.control('Probe_NoSuchAction')
})

// This creates a playlist IF permissions are not enforced. Named so it is
// obvious and easy to delete afterwards.
await attempt('_library.playlist.create (NOT granted)', 'denied', function () {
  return _library.playlist.create({
    name: 'ZZ PROBE DELETE ME - permissions not enforced',
    parentId: null,
    type: '2'
  })
})

// --- writing a track field with NO modify permission at all ---
if (_vars.tracksSelected && _vars.tracksSelected.length > 0) {
  const track = _vars.tracksSelected[0]

  results.writeTargetTrackId = track.id
  results.writeTargetBefore = track.extra1

  await attempt('track.extra1 = ... (no modify permission)', 'denied', function () {
    track.extra1 = 'probe-denied-write'
    return track.extra1
  })

  results.writeTargetAfterInMemory = track.extra1
} else {
  results.writeTargetTrackId = null
  results.note = 'No tracks selected, skipped the write attempt'
}

_files.write('denied.json', JSON.stringify(results, null, 2))

_helpers.Report('Wrote denied.json')

for (const entry of results.attempts) {
  _helpers.Report(entry.label + ' -> ' + entry.outcome + (entry.errorMessage ? ' (' + entry.errorMessage + ')' : ''))
}
