// R4: which denied capability halts the action, and how?
//
// No try/catch anywhere. A silent halt is not catchable, and repeated
// `catch (err)` blocks are themselves a suspect. Sequential statements with a
// stage marker after each one answer the question on their own:
//
//   lastCompleted tells you the last access that SURVIVED.
//   The next line in this file is the one that killed it.
//
// Granted: track.read=selected, files.write. Nothing else.
// Nothing destructive.

const results = { probe: 'perm.denied.r4', lastCompleted: 'start', reads: {} }

function save() {
  _files.write('perm-denied.json', JSON.stringify(results, null, 2))
}

save()

// --- granted, as a baseline ---------------------------------------------

const selected = _vars.tracksSelected

results.reads.tracksSelected = {
  type: typeof selected,
  isArray: Array.isArray(selected),
  length: Array.isArray(selected) ? selected.length : null
}

results.lastCompleted = 'GRANTED _vars.tracksSelected'
save()

// --- reads that were NOT granted ----------------------------------------
// If Lexicon returns undefined and keeps going, these record it.
// If Lexicon halts, the file stops here and lastCompleted names the survivor.

const deniedPlaylists = _vars.playlistsAll

results.reads.playlistsAll = {
  type: typeof deniedPlaylists,
  isUndefined: deniedPlaylists === undefined,
  isArray: Array.isArray(deniedPlaylists),
  length: Array.isArray(deniedPlaylists) ? deniedPlaylists.length : null
}

results.lastCompleted = 'DENIED _vars.playlistsAll'
save()

const deniedTags = _vars.customTags

results.reads.customTags = {
  type: typeof deniedTags,
  isUndefined: deniedTags === undefined,
  length: Array.isArray(deniedTags) ? deniedTags.length : null
}

results.lastCompleted = 'DENIED _vars.customTags'
save()

const deniedAmount = _vars.tracksAllAmount

results.reads.tracksAllAmount = { type: typeof deniedAmount, value: deniedAmount }
results.lastCompleted = 'DENIED _vars.tracksAllAmount (read=selected only)'
save()

const deniedBatch = await _library.track.getNextAllBatch()

results.reads.getNextAllBatch = {
  type: typeof deniedBatch,
  isUndefined: deniedBatch === undefined,
  length: Array.isArray(deniedBatch) ? deniedBatch.length : null
}

results.lastCompleted = 'DENIED _library.track.getNextAllBatch'
save()

// --- capabilities that were NOT granted ---------------------------------

_storage.save('perm.denied.key', 'should-not-persist')

results.lastCompleted = 'DENIED _storage.save'
save()

const deniedLoad = _storage.load('perm.denied.key')

results.reads.storageLoad = { type: typeof deniedLoad, value: deniedLoad }
results.lastCompleted = 'DENIED _storage.load'
save()

const deniedFetch = await _network.GET({ url: 'https://example.com', headers: {} })

results.reads.networkGet = { type: typeof deniedFetch }
results.lastCompleted = 'DENIED _network.GET'
save()

const deniedRead = _files.read('perm-denied.json')

results.reads.filesRead = {
  type: typeof deniedRead,
  isNull: deniedRead === null,
  length: deniedRead === null || deniedRead === undefined ? null : String(deniedRead).length
}

results.lastCompleted = 'DENIED _files.read (only files.write granted)'
save()

const deniedList = _files.list()

results.reads.filesList = {
  type: typeof deniedList,
  isUndefined: deniedList === undefined,
  value: deniedList
}

results.lastCompleted = 'DENIED _files.list (only files.write granted)'
save()

const nowPlaying = _musicplayer.getNowPlaying()

results.reads.nowPlaying = { type: typeof nowPlaying, isNull: nowPlaying === null }
results.lastCompleted = 'UNDECLARED _musicplayer.getNowPlaying'
save()

_ui.control('Probe_NoSuchAction')

results.lastCompleted = 'DENIED _ui.control'
save()

// Creates a playlist IF permissions are not enforced. Named to be obvious.
const madePlaylist = await _library.playlist.create({
  name: 'ZZ PROBE DELETE ME - permissions not enforced',
  parentId: null,
  type: '2'
})

results.reads.playlistCreate = {
  type: typeof madePlaylist,
  isUndefined: madePlaylist === undefined,
  id: madePlaylist === undefined || madePlaylist === null ? null : madePlaylist.id
}

results.lastCompleted = 'DENIED _library.playlist.create'
save()

// --- writing a track field with NO modify permission --------------------

if (Array.isArray(selected) && selected.length > 0) {
  const target = selected[0]

  results.writeTargetId = target.id
  results.writeValueBefore = target.extra1

  target.extra1 = 'perm-denied-write'

  results.writeValueAfterInMemory = target.extra1
}

results.lastCompleted = 'DENIED track.extra1 write'
results.finished = true
save()

_helpers.Report('Completed every attempt without halting')
