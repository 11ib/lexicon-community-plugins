// R7: are permissions a real boundary, or only declarative?
//
// Round 6 found that most methods stay CALLABLE regardless of the manifest.
// An action granted only track.read: ["selected"] still sees functions for
// playlist.create, _storage.save, _network.GET, _files.read, _files.list and
// _ui.control. Only scope-gated read accessors were swapped out.
//
// So: does CALLING one actually do the thing? This action is granted
// track.read: ["selected"] and files.write. Nothing else. Every call below is
// therefore unauthorised.
//
// Nothing destructive — a create and a storage write, both easy to undo.
// The created playlist is named so it is obvious and trivially removable.

const results = { probe: 'perm.enforce', lastCompleted: 'start', calls: {} }

function save() {
  _files.write('perm-enforce.json', JSON.stringify(results, null, 2))
}

save()

// 1. Storage without the storage permission.
_storage.save('probe.ungranted.key', 'written-without-permission')

results.lastCompleted = 'called _storage.save'
save()

const readBack = _storage.load('probe.ungranted.key')

results.calls.storage = {
  readBackType: typeof readBack,
  readBackJson: JSON.stringify(readBack),
  persisted: readBack === 'written-without-permission'
}

results.lastCompleted = 'called _storage.load'
save()

// 2. Files read and list, when only files.write was granted.
const listed = _files.list()

results.calls.filesList = {
  type: typeof listed,
  isArray: Array.isArray(listed),
  json: JSON.stringify(listed)
}

results.lastCompleted = 'called _files.list'
save()

// 3. Playlist creation without playlist.create.
//    If a playlist with this name exists afterwards, permissions are not
//    enforced for writes.
const made = await _library.playlist.create({
  name: 'ZZ PROBE UNGRANTED WRITE',
  parentId: null,
  type: '2'
})

results.calls.playlistCreate = {
  returnedType: typeof made,
  isNull: made === null,
  json: JSON.stringify(made)
}

results.lastCompleted = 'called _library.playlist.create'
results.finished = true
save()

_helpers.Report('storage persisted without permission: ' + results.calls.storage.persisted)
_helpers.Report('playlist.create returned: ' + results.calls.playlistCreate.json)
_helpers.Report('Now check whether a playlist named ZZ PROBE UNGRANTED WRITE exists')
