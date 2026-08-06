// R5: what exactly does a denied capability return?
//
// Round 4 established that denied capabilities are OMITTED rather than
// throwing: denied _vars reads returned a non-array object, tracksAllAmount
// returned null, and _library.track.getNextAllBatch was not a function.
//
// This pins down the placeholder values and continues past the TypeError that
// stopped round 4, using typeof guards instead of calling anything blindly.
//
// Granted: track.read=selected, files.write. Nothing else.

const results = { probe: 'perm.denied.r5', lastCompleted: 'start', reads: {} }

function save() {
  _files.write('perm-denied.json', JSON.stringify(results, null, 2))
}

save()

const grantedSelected = _vars.tracksSelected

results.reads.tracksSelected = {
  type: typeof grantedSelected,
  isArray: Array.isArray(grantedSelected),
  length: Array.isArray(grantedSelected) ? grantedSelected.length : null
}

results.lastCompleted = 'GRANTED tracksSelected'
save()

const deniedPlaylists = _vars.playlistsAll

results.reads.playlistsAll = {
  type: typeof deniedPlaylists,
  isNull: deniedPlaylists === null,
  isArray: Array.isArray(deniedPlaylists),
  json: JSON.stringify(deniedPlaylists),
  keys: deniedPlaylists !== null && typeof deniedPlaylists === 'object' ? Object.keys(deniedPlaylists) : null
}

results.lastCompleted = 'DENIED playlistsAll'
save()

const deniedTags = _vars.customTags

results.reads.customTags = {
  type: typeof deniedTags,
  isNull: deniedTags === null,
  json: JSON.stringify(deniedTags),
  keys: deniedTags !== null && typeof deniedTags === 'object' ? Object.keys(deniedTags) : null
}

results.lastCompleted = 'DENIED customTags'
save()

// _library method presence, checked with typeof rather than called.
results.reads.libraryShape = {
  trackObject: typeof _library.track,
  getNextAllBatch: typeof _library.track.getNextAllBatch,
  trackCreate: typeof _library.track.create,
  trackDelete: typeof _library.track.delete,
  playlistObject: typeof _library.playlist,
  playlistCreate: typeof _library.playlist.create,
  customTagObject: typeof _library.customTag,
  storageSave: typeof _storage.save,
  storageLoad: typeof _storage.load,
  networkGet: typeof _network.GET,
  filesWrite: typeof _files.write,
  filesRead: typeof _files.read,
  filesList: typeof _files.list,
  uiControl: typeof _ui.control,
  musicplayerNowPlaying: typeof _musicplayer.getNowPlaying
}

results.lastCompleted = 'library-shape'
save()

results.reads.libraryTrackKeys = Object.keys(_library.track)
results.reads.libraryKeys = Object.keys(_library)
results.lastCompleted = 'library-keys'
results.finished = true
save()

_helpers.Report('Denied playlistsAll is: ' + results.reads.playlistsAll.json)
_helpers.Report('getNextAllBatch is: ' + results.reads.libraryShape.getNextAllBatch)
