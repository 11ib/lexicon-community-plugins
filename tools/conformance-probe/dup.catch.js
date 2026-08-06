// R4: two sibling try/catch blocks reusing the same catch parameter name.
// Suspected cause of the silent halts: flattened scope means the second
// `catch (err)` collides with the first.

const results = { probe: 'dup.catch', stage: 'start' }

_files.write('dup-catch.json', JSON.stringify(results, null, 2))

try {
  throw new Error('first')
} catch (err) {
  results.first = err.message
}

results.stage = 'after-first-catch'
_files.write('dup-catch.json', JSON.stringify(results, null, 2))

try {
  throw new Error('second')
} catch (err) {
  results.second = err.message
}

results.stage = 'after-second-catch'
results.finished = true
_files.write('dup-catch.json', JSON.stringify(results, null, 2))

_helpers.Report('Two catch blocks sharing the name err both ran')
