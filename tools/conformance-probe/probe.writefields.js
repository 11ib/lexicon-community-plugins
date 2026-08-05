// Probe 7: is modifyFields actually enforced, and do in-memory mutations persist?
//
// This action declares track.modify=selected with modifyFields=['extra1'].
// It writes BOTH extra1 (permitted) and extra2 (not permitted).
// extra1/extra2 are empty across this entire library, so nothing real is at risk.
//
// RUN THIS WITH ONLY THE "ZZ Plugin Harness Sandbox" PLAYLIST TRACKS SELECTED.

const STAMP = 'probe-' + Date.now()

const results = {}

results.probe = 'writefields'
results.ranAt = new Date().toISOString()
results.stamp = STAMP
results.tracks = []

if (!_vars.tracksSelected || _vars.tracksSelected.length === 0) {
  throw new Error('Select the sandbox playlist tracks first')
}

for (const track of _vars.tracksSelected) {
  let entry = {
    id: track.id,
    title: track.title,
    extra1Before: track.extra1,
    extra2Before: track.extra2,
    permittedWrite: { threw: false, error: null, valueAfter: null },
    forbiddenWrite: { threw: false, error: null, valueAfter: null },
    unknownFieldWrite: { threw: false, error: null, valueAfter: null }
  }

  // Permitted field.
  try {
    track.extra1 = STAMP + '-allowed'
    entry.permittedWrite.valueAfter = track.extra1
  } catch (err) {
    entry.permittedWrite.threw = true
    entry.permittedWrite.error = err.message
  }

  // Field the action did NOT declare in modifyFields.
  try {
    track.extra2 = STAMP + '-forbidden'
    entry.forbiddenWrite.valueAfter = track.extra2
  } catch (err) {
    entry.forbiddenWrite.threw = true
    entry.forbiddenWrite.error = err.message
  }

  // A property that isn't part of the track schema at all.
  try {
    track.notARealField = STAMP
    entry.unknownFieldWrite.valueAfter = track.notARealField
  } catch (err) {
    entry.unknownFieldWrite.threw = true
    entry.unknownFieldWrite.error = err.message
  }

  results.tracks.push(entry)
}

_files.write('writefields.json', JSON.stringify(results, null, 2))

_helpers.Report('Wrote writefields.json with stamp ' + STAMP)
_helpers.Report('Touched ' + results.tracks.length + ' track(s): ' + results.tracks.map(x => x.id).join(', '))
_helpers.Report('Permitted write threw: ' + results.tracks.filter(x => x.permittedWrite.threw).length)
_helpers.Report('Forbidden write threw: ' + results.tracks.filter(x => x.forbiddenWrite.threw).length)
