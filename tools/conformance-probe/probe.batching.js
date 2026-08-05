// Probe 3: how getNextAllBatch behaves. Read-only.
// Stops after a few batches so it doesn't walk a 66k library.

const MAX_BATCHES = 4

const results = {}

results.probe = 'batching'
results.ranAt = new Date().toISOString()
results.tracksAllAmount = _vars.tracksAllAmount
results.batches = []

const firstReturn = _library.track.getNextAllBatch()
results.returnsThenable = firstReturn !== null && typeof firstReturn === 'object' && typeof firstReturn.then === 'function'

let batch = await firstReturn
let index = 0

while (batch.length > 0 && index < MAX_BATCHES) {
  const entry = {
    index: index,
    length: batch.length,
    firstId: batch[0] ? batch[0].id : null,
    lastId: batch[batch.length - 1] ? batch[batch.length - 1].id : null,
    firstKeys: batch[0] ? Object.keys(batch[0]) : null,
    idsAscending: true
  }

  for (let i = 1; i < batch.length; i++) {
    if (batch[i].id < batch[i - 1].id) {
      entry.idsAscending = false
      break
    }
  }

  results.batches.push(entry)

  index += 1

  if (index < MAX_BATCHES) {
    batch = await _library.track.getNextAllBatch()
  }
}

// Does the batch cursor include archived tracks? Compare against tracksAllAmount later.
// Does a track from a batch carry the same shape as a selected track?
if (results.batches.length > 0) {
  results.batchTrackSample = JSON.parse(JSON.stringify((await _library.track.getNextAllBatch())[0] || null))
}

results.note = 'Cursor was NOT drained. Check whether a second run of this action starts from id 1 again.'

_files.write('batching.json', JSON.stringify(results, null, 2))

_helpers.Report('Wrote batching.json')
_helpers.Report('Batch sizes: ' + results.batches.map(x => x.length).join(', '))
_helpers.Report('Library total reported by _vars.tracksAllAmount: ' + _vars.tracksAllAmount)
