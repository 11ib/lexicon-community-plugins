// R6: what IS the value of a denied capability?
//
// Round 5 got "Cannot convert undefined or null to object" from
// Object.keys(deniedValue) even though the guard immediately before it had
// confirmed `typeof deniedValue === 'object'` and `deniedValue !== null`.
// Those cannot both be true in real JavaScript — which is a strong hint that
// this sandbox is a custom interpreter with its own typeof/equality semantics
// for host objects.
//
// So: no Object.keys, no assumptions. Only String() and JSON.stringify, each
// followed by a stage marker.
//
// Granted: track.read=selected, files.write. Nothing else.

const results = { probe: 'perm.denied.r6', lastCompleted: 'start', probes: {} }

function save() {
  _files.write('perm-denied.json', JSON.stringify(results, null, 2))
}

save()

// Baseline: a capability we DO have.
const granted = _vars.tracksSelected

results.probes.granted = {
  typeofValue: typeof granted,
  isArray: Array.isArray(granted),
  stringified: String(granted).slice(0, 60)
}

results.lastCompleted = 'granted'
save()

// The denied read, examined without touching Object.
const denied = _vars.playlistsAll

results.probes.deniedTypeof = typeof denied
results.lastCompleted = 'denied-typeof'
save()

results.probes.deniedIsNull = denied === null
results.probes.deniedIsUndefined = denied === undefined
results.probes.deniedLooseNull = denied == null
results.lastCompleted = 'denied-equality'
save()

results.probes.deniedIsArray = Array.isArray(denied)
results.lastCompleted = 'denied-isarray'
save()

results.probes.deniedString = String(denied)
results.lastCompleted = 'denied-string'
save()

results.probes.deniedJson = JSON.stringify(denied)
results.lastCompleted = 'denied-json'
save()

results.probes.deniedLength = typeof denied.length
results.lastCompleted = 'denied-length'
save()

// Method presence on _library, by typeof only — never called.
results.probes.methods = {
  libraryTypeof: typeof _library,
  trackTypeof: typeof _library.track,
  getNextAllBatch: typeof _library.track.getNextAllBatch,
  trackCreate: typeof _library.track.create,
  trackDelete: typeof _library.track.delete,
  playlistTypeof: typeof _library.playlist,
  playlistCreate: typeof _library.playlist.create,
  storageSave: typeof _storage.save,
  networkGet: typeof _network.GET,
  filesWrite: typeof _files.write,
  filesRead: typeof _files.read,
  filesList: typeof _files.list,
  uiControl: typeof _ui.control,
  nowPlaying: typeof _musicplayer.getNowPlaying
}

results.lastCompleted = 'methods'
results.finished = true
save()

_helpers.Report('Denied value typeof: ' + results.probes.deniedTypeof + ' string: ' + results.probes.deniedString)
_helpers.Report('getNextAllBatch without track.read all: ' + results.probes.methods.getNextAllBatch)
