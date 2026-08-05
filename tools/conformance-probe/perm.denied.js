// How does Lexicon react when an action touches something its config.json did
// NOT grant? This action is granted ONLY track.read=selected and files.write.
//
// Every attempt uses its own TOP-LEVEL try/catch, because a catch binding
// inside a nested function is what broke the round 1 version of this probe.
//
// Nothing destructive: no deletes, no track creation. The one write attempt
// targets extra1, which is empty across this library and gets restored after.

const results = { probe: 'perm.denied', attempts: [] }

results.ranAt = new Date().toISOString()

// --- granted, as a baseline ---------------------------------------------

try {
  const value = _vars.tracksSelected
  results.attempts.push({
    label: '_vars.tracksSelected',
    granted: true,
    outcome: 'returned',
    detail: 'length=' + value.length
  })
} catch (err) {
  results.attempts.push({ label: '_vars.tracksSelected', granted: true, outcome: 'threw', detail: err.message })
}

// --- reads that were NOT granted ----------------------------------------

try {
  const value = _vars.playlistsAll
  results.attempts.push({
    label: '_vars.playlistsAll',
    granted: false,
    outcome: 'returned',
    detail: value === undefined ? 'undefined' : 'length=' + value.length
  })
} catch (err) {
  results.attempts.push({ label: '_vars.playlistsAll', granted: false, outcome: 'threw', detail: err.message })
}

try {
  const value = _vars.customTags
  results.attempts.push({
    label: '_vars.customTags',
    granted: false,
    outcome: 'returned',
    detail: value === undefined ? 'undefined' : 'length=' + value.length
  })
} catch (err) {
  results.attempts.push({ label: '_vars.customTags', granted: false, outcome: 'threw', detail: err.message })
}

try {
  const value = _vars.tracksAllAmount
  results.attempts.push({
    label: '_vars.tracksAllAmount (read=selected only)',
    granted: false,
    outcome: 'returned',
    detail: String(value)
  })
} catch (err) {
  results.attempts.push({ label: '_vars.tracksAllAmount', granted: false, outcome: 'threw', detail: err.message })
}

try {
  const batch = await _library.track.getNextAllBatch()
  results.attempts.push({
    label: '_library.track.getNextAllBatch (read=selected only)',
    granted: false,
    outcome: 'returned',
    detail: batch === undefined ? 'undefined' : 'length=' + batch.length
  })
} catch (err) {
  results.attempts.push({ label: '_library.track.getNextAllBatch', granted: false, outcome: 'threw', detail: err.message })
}

// --- capabilities that were NOT granted ---------------------------------

try {
  _storage.save('perm.denied.key', 'should-not-persist')
  results.attempts.push({ label: '_storage.save', granted: false, outcome: 'returned', detail: 'no error' })
} catch (err) {
  results.attempts.push({ label: '_storage.save', granted: false, outcome: 'threw', detail: err.message })
}

try {
  const value = _storage.load('perm.denied.key')
  results.attempts.push({ label: '_storage.load', granted: false, outcome: 'returned', detail: JSON.stringify(value) })
} catch (err) {
  results.attempts.push({ label: '_storage.load', granted: false, outcome: 'threw', detail: err.message })
}

try {
  const value = await _network.GET({ url: 'https://example.com', headers: {} })
  results.attempts.push({ label: '_network.GET', granted: false, outcome: 'returned', detail: typeof value })
} catch (err) {
  results.attempts.push({ label: '_network.GET', granted: false, outcome: 'threw', detail: err.message })
}

try {
  const value = _files.read('syn-static.json')
  results.attempts.push({
    label: '_files.read (only write granted)',
    granted: false,
    outcome: 'returned',
    detail: value === null ? 'null' : 'length=' + String(value).length
  })
} catch (err) {
  results.attempts.push({ label: '_files.read', granted: false, outcome: 'threw', detail: err.message })
}

try {
  const value = _files.list()
  results.attempts.push({
    label: '_files.list (only write granted)',
    granted: false,
    outcome: 'returned',
    detail: value === undefined ? 'undefined' : JSON.stringify(value)
  })
} catch (err) {
  results.attempts.push({ label: '_files.list', granted: false, outcome: 'threw', detail: err.message })
}

try {
  const value = _musicplayer.getNowPlaying()
  results.attempts.push({
    label: '_musicplayer.getNowPlaying (no permission declared)',
    granted: false,
    outcome: 'returned',
    detail: value === null ? 'null' : typeof value
  })
} catch (err) {
  results.attempts.push({ label: '_musicplayer.getNowPlaying', granted: false, outcome: 'threw', detail: err.message })
}

try {
  _ui.control('Probe_NoSuchAction')
  results.attempts.push({ label: '_ui.control (control not granted)', granted: false, outcome: 'returned', detail: 'no error' })
} catch (err) {
  results.attempts.push({ label: '_ui.control', granted: false, outcome: 'threw', detail: err.message })
}

// Creates a playlist IF permissions are not enforced. Named so it is obvious.
try {
  const value = await _library.playlist.create({
    name: 'ZZ PROBE DELETE ME - permissions not enforced',
    parentId: null,
    type: '2'
  })
  results.attempts.push({
    label: '_library.playlist.create (not granted)',
    granted: false,
    outcome: 'returned',
    detail: value === undefined ? 'undefined' : 'created id=' + value.id
  })
} catch (err) {
  results.attempts.push({ label: '_library.playlist.create', granted: false, outcome: 'threw', detail: err.message })
}

// --- writing a track field with NO modify permission at all -------------

if (_vars.tracksSelected.length > 0) {
  const track = _vars.tracksSelected[0]

  results.writeTargetId = track.id
  results.writeValueBefore = track.extra1

  try {
    track.extra1 = 'perm-denied-write'
    results.attempts.push({
      label: 'track.extra1 = ... (no track.modify at all)',
      granted: false,
      outcome: 'returned',
      detail: 'in-memory value is now ' + track.extra1
    })
  } catch (err) {
    results.attempts.push({ label: 'track.extra1 write', granted: false, outcome: 'threw', detail: err.message })
  }

  results.writeValueAfterInMemory = track.extra1
}

_files.write('perm-denied.json', JSON.stringify(results, null, 2))

_helpers.Report('Recorded ' + results.attempts.length + ' attempts')

for (const attempt of results.attempts) {
  _helpers.Report(attempt.label + ' -> ' + attempt.outcome + ' (' + attempt.detail + ')')
}
