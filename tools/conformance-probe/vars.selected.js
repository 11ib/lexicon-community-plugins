// R3: the most isolated possible read of _vars.tracksSelected.
//
// Round 2 got `undefined` here with 8 tracks genuinely selected, in an action
// that declared track.read: ["selected"]. That probe had already called
// Object.keys(_vars) and a batch of typeof checks first. This one touches
// NOTHING else beforehand.
//
// If this reports an array, the earlier access order is what broke it.
// If it reports undefined, then tracksSelected is simply not what the docs say.

const results = { probe: 'vars.selected', lastCompleted: 'start' }

function save() {
  _files.write('vars-selected.json', JSON.stringify(results, null, 2))
}

save()

// FIRST STATEMENT touching _vars. Nothing has been read from it yet.
const first = _vars.tracksSelected

results.firstRead = {
  type: typeof first,
  isUndefined: first === undefined,
  isNull: first === null,
  isArray: Array.isArray(first),
  length: Array.isArray(first) ? first.length : null
}

results.lastCompleted = 'first-read'
save()

// Now do what the round 2 probe did before its read.
results.varsKeys = Object.keys(_vars)
results.lastCompleted = 'object-keys-vars'
save()

// Read it a second time, after Object.keys(_vars).
const second = _vars.tracksSelected

results.secondRead = {
  type: typeof second,
  isUndefined: second === undefined,
  isArray: Array.isArray(second),
  length: Array.isArray(second) ? second.length : null
}

results.lastCompleted = 'second-read'
save()

// And a third time, to see whether repeated access degrades it.
const third = _vars.tracksSelected

results.thirdRead = {
  type: typeof third,
  isArray: Array.isArray(third),
  length: Array.isArray(third) ? third.length : null
}

results.sameReferenceAcrossReads = first === second

if (Array.isArray(first) && first.length > 0) {
  results.firstTrackId = first[0].id
  results.firstTrackTitle = first[0].title
}

results.lastCompleted = 'third-read'
results.finished = true
save()

_helpers.Report('First read: ' + results.firstRead.type + ' length=' + results.firstRead.length)
_helpers.Report('Second read: ' + results.secondRead.type + ' length=' + results.secondRead.length)
