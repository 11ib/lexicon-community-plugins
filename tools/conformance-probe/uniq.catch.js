// R4: the same shape as dup.catch, but with distinct catch parameter names.
// If this completes and dup.catch does not, name collision is the cause.

const results = { probe: 'uniq.catch', stage: 'start' }

_files.write('uniq-catch.json', JSON.stringify(results, null, 2))

try {
  throw new Error('first')
} catch (errA) {
  results.first = errA.message
}

results.stage = 'after-first-catch'
_files.write('uniq-catch.json', JSON.stringify(results, null, 2))

try {
  throw new Error('second')
} catch (errB) {
  results.second = errB.message
}

results.stage = 'after-second-catch'
results.finished = true
_files.write('uniq-catch.json', JSON.stringify(results, null, 2))

_helpers.Report('Two catch blocks with distinct names both ran')
