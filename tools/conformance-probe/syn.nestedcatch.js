// Probe 6 died with "err is not defined" from a catch block inside a nested
// function. This isolates that: does a catch binding work inside a function?

function risky() {
  try {
    throw new Error('inner-error')
  } catch (err) {
    return 'caught: ' + err.message
  }
}

const nestedResult = risky()

let topLevelResult = 'not-run'

try {
  throw new Error('outer-error')
} catch (err) {
  topLevelResult = 'caught: ' + err.message
}

const results = {
  probe: 'syn.nestedcatch',
  insideFunction: nestedResult,
  atTopLevel: topLevelResult
}

_files.write('syn-nestedcatch.json', JSON.stringify(results, null, 2))

_helpers.Report('nested: ' + nestedResult)
_helpers.Report('top level: ' + topLevelResult)
