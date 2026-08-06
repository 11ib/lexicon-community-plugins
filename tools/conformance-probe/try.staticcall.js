// R4: a single try/catch around a static call on an object literal.
// The round 3 static probe halted inside exactly this shape, on its first
// block, so this isolates the statement from the repeated-block question.

const results = { probe: 'try.staticcall', stage: 'start' }

_files.write('try-staticcall.json', JSON.stringify(results, null, 2))

const direct = Object.keys({ a: 1, b: 2 }).length

results.directCall = direct
results.stage = 'after-direct-call'
_files.write('try-staticcall.json', JSON.stringify(results, null, 2))

try {
  const inTry = Object.keys({ a: 1, b: 2 }).length
  results.insideTry = inTry
} catch (err) {
  results.insideTry = 'threw: ' + err.message
}

results.stage = 'after-try'
results.finished = true
_files.write('try-staticcall.json', JSON.stringify(results, null, 2))

_helpers.Report('Object.keys on a literal works inside and outside try')
