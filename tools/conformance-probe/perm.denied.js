// R3: what happens when an action touches a capability it was NOT granted?
//
// Round 2 ran this for 3ms, logged nothing, and wrote no file — strongly
// suggesting a denied access halts execution silently rather than throwing.
// This version writes after every attempt, so the last recorded attempt
// identifies exactly which access stops the script.
//
// Granted: track.read=selected, files.write. Nothing else.
// Nothing destructive: no deletes, no track creation.

const results = { probe: 'perm.denied.r3', lastCompleted: 'none', attempts: [] }

function save() {
  _files.write('perm-denied.json', JSON.stringify(results, null, 2))
}

save()

// --- granted, as a baseline ---------------------------------------------

try {
  const value = _vars.tracksSelected
  results.attempts.push({
    label: '_vars.tracksSelected (GRANTED)',
    outcome: 'returned',
    detail: value === undefined ? 'undefined' : 'array length=' + value.length
  })
} catch (err) {
  results.attempts.push({ label: '_vars.tracksSelected (GRANTED)', outcome: 'threw', detail: err.message })
}

results.lastCompleted = '_vars.tracksSelected'
save()

// --- reads that were NOT granted ----------------------------------------

try {
  const value = _vars.playlistsAll
  results.attempts.push({
    label: '_vars.playlistsAll',
    outcome: 'returned',
    detail: value === undefined ? 'undefined' : 'array length=' + value.length
  })
} catch (err) {
  results.attempts.push({ label: '_vars.playlistsAll', outcome: 'threw', detail: err.message })
}

results.lastCompleted = '_vars.playlistsAll'
save()

try {
  const value = _vars.customTags
  results.attempts.push({
    label: '_vars.customTags',
    outcome: 'returned',
    detail: value === undefined ? 'undefined' : 'array length=' + value.length
  })
} catch (err) {
  results.attempts.push({ label: '_vars.customTags', outcome: 'threw', detail: err.message })
}

results.lastCompleted = '_vars.customTags'
save()

try {
  const value = _vars.tracksAllAmount
  results.attempts.push({
    label: '_vars.tracksAllAmount (read=selected only)',
    outcome: 'returned',
    detail: String(value)
  })
} catch (err) {
  results.attempts.push({ label: '_vars.tracksAllAmount', outcome: 'threw', detail: err.message })
}

results.lastCompleted = '_vars.tracksAllAmount'
save()

try {
  const batch = await _library.track.getNextAllBatch()
  results.attempts.push({
    label: '_library.track.getNextAllBatch (read=selected only)',
    outcome: 'returned',
    detail: batch === undefined ? 'undefined' : 'length=' + batch.length
  })
} catch (err) {
  results.attempts.push({ label: '_library.track.getNextAllBatch', outcome: 'threw', detail: err.message })
}

results.lastCompleted = '_library.track.getNextAllBatch'
save()

// --- capabilities that were NOT granted ---------------------------------

try {
  _storage.save('perm.denied.key', 'should-not-persist')
  results.attempts.push({ label: '_storage.save', outcome: 'returned', detail: 'no error' })
} catch (err) {
  results.attempts.push({ label: '_storage.save', outcome: 'threw', detail: err.message })
}

results.lastCompleted = '_storage.save'
save()

try {
  const value = _storage.load('perm.denied.key')
  results.attempts.push({ label: '_storage.load', outcome: 'returned', detail: JSON.stringify(value) })
} catch (err) {
  results.attempts.push({ label: '_storage.load', outcome: 'threw', detail: err.message })
}

results.lastCompleted = '_storage.load'
save()

try {
  const value = await _network.GET({ url: 'https://example.com', headers: {} })
  results.attempts.push({ label: '_network.GET', outcome: 'returned', detail: typeof value })
} catch (err) {
  results.attempts.push({ label: '_network.GET', outcome: 'threw', detail: err.message })
}

results.lastCompleted = '_network.GET'
save()

try {
  const value = _files.read('syn-static.json')
  results.attempts.push({
    label: '_files.read (only files.write granted)',
    outcome: 'returned',
    detail: value === null ? 'null' : 'length=' + String(value).length
  })
} catch (err) {
  results.attempts.push({ label: '_files.read', outcome: 'threw', detail: err.message })
}

results.lastCompleted = '_files.read'
save()

try {
  const value = _files.list()
  results.attempts.push({
    label: '_files.list (only files.write granted)',
    outcome: 'returned',
    detail: value === undefined ? 'undefined' : JSON.stringify(value)
  })
} catch (err) {
  results.attempts.push({ label: '_files.list', outcome: 'threw', detail: err.message })
}

results.lastCompleted = '_files.list'
save()

try {
  const value = _musicplayer.getNowPlaying()
  results.attempts.push({
    label: '_musicplayer.getNowPlaying (no permission declared)',
    outcome: 'returned',
    detail: value === null ? 'null' : typeof value
  })
} catch (err) {
  results.attempts.push({ label: '_musicplayer.getNowPlaying', outcome: 'threw', detail: err.message })
}

results.lastCompleted = '_musicplayer.getNowPlaying'
save()

try {
  _ui.control('Probe_NoSuchAction')
  results.attempts.push({ label: '_ui.control (control not granted)', outcome: 'returned', detail: 'no error' })
} catch (err) {
  results.attempts.push({ label: '_ui.control', outcome: 'threw', detail: err.message })
}

results.lastCompleted = '_ui.control'
save()

// Creates a playlist IF permissions are not enforced. Named to be obvious.
try {
  const value = await _library.playlist.create({
    name: 'ZZ PROBE DELETE ME - permissions not enforced',
    parentId: null,
    type: '2'
  })
  results.attempts.push({
    label: '_library.playlist.create (not granted)',
    outcome: 'returned',
    detail: value === undefined ? 'undefined' : 'created id=' + value.id
  })
} catch (err) {
  results.attempts.push({ label: '_library.playlist.create', outcome: 'threw', detail: err.message })
}

results.lastCompleted = '_library.playlist.create'
save()

// --- writing a track field with NO modify permission --------------------

if (_vars.tracksSelected && _vars.tracksSelected.length > 0) {
  const track = _vars.tracksSelected[0]

  results.writeTargetId = track.id
  results.writeValueBefore = track.extra1

  try {
    track.extra1 = 'perm-denied-write'
    results.attempts.push({
      label: 'track.extra1 = ... (no track.modify at all)',
      outcome: 'returned',
      detail: 'in-memory value is now ' + track.extra1
    })
  } catch (err) {
    results.attempts.push({ label: 'track.extra1 write', outcome: 'threw', detail: err.message })
  }

  results.writeValueAfterInMemory = track.extra1
} else {
  results.attempts.push({ label: 'track write test', outcome: 'skipped', detail: 'no tracks selected' })
}

results.lastCompleted = 'track.extra1 write'
results.finished = true
save()

_helpers.Report('Completed all ' + results.attempts.length + ' attempts')
