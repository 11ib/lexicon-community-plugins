// R3: which static built-in helpers does the sandbox allow?
//
// Round 2 ran this for 46ms, logged no error, and wrote no file. Something in
// here halts execution silently — try/catch does not catch it and nothing is
// logged. So this version writes the results file after EVERY check.
//
// Read the last entry in the file: the check AFTER it is the one that halts.

const results = { probe: 'syn.static.r3', lastCompleted: 'none', checks: [] }

function save() {
  _files.write('syn-static.json', JSON.stringify(results, null, 2))
}

save()

// Each check is deliberately its own top-level block. No loops, no helper
// functions holding the risky call, so a halt lands on a known line.

try {
  const value = Object.keys({ a: 1, b: 2 }).length
  results.checks.push({ name: 'Object.keys', ok: true, detail: value })
} catch (err) {
  results.checks.push({ name: 'Object.keys', ok: false, detail: err.message })
}

results.lastCompleted = 'Object.keys'
save()

try {
  const value = Object.values({ a: 1, b: 2 }).length
  results.checks.push({ name: 'Object.values', ok: true, detail: value })
} catch (err) {
  results.checks.push({ name: 'Object.values', ok: false, detail: err.message })
}

results.lastCompleted = 'Object.values'
save()

try {
  const value = Object.entries({ a: 1 }).length
  results.checks.push({ name: 'Object.entries', ok: true, detail: value })
} catch (err) {
  results.checks.push({ name: 'Object.entries', ok: false, detail: err.message })
}

results.lastCompleted = 'Object.entries'
save()

try {
  const value = Object.assign({}, { a: 1 }, { b: 2 })
  results.checks.push({ name: 'Object.assign', ok: true, detail: Object.keys(value).length })
} catch (err) {
  results.checks.push({ name: 'Object.assign', ok: false, detail: err.message })
}

results.lastCompleted = 'Object.assign'
save()

try {
  const value = Object.fromEntries([['a', 1]])
  results.checks.push({ name: 'Object.fromEntries', ok: true, detail: value.a })
} catch (err) {
  results.checks.push({ name: 'Object.fromEntries', ok: false, detail: err.message })
}

results.lastCompleted = 'Object.fromEntries'
save()

try {
  const value = Object.getOwnPropertyNames({ a: 1 }).length
  results.checks.push({ name: 'Object.getOwnPropertyNames', ok: true, detail: value })
} catch (err) {
  results.checks.push({ name: 'Object.getOwnPropertyNames', ok: false, detail: err.message })
}

results.lastCompleted = 'Object.getOwnPropertyNames'
save()

try {
  const value = Object.getPrototypeOf({ a: 1 })
  results.checks.push({ name: 'Object.getPrototypeOf', ok: true, detail: typeof value })
} catch (err) {
  results.checks.push({ name: 'Object.getPrototypeOf', ok: false, detail: err.message })
}

results.lastCompleted = 'Object.getPrototypeOf'
save()

try {
  const value = Object.freeze({ a: 1 })
  results.checks.push({ name: 'Object.freeze', ok: true, detail: typeof value })
} catch (err) {
  results.checks.push({ name: 'Object.freeze', ok: false, detail: err.message })
}

results.lastCompleted = 'Object.freeze'
save()

try {
  const value = Array.isArray([1, 2])
  results.checks.push({ name: 'Array.isArray', ok: true, detail: value })
} catch (err) {
  results.checks.push({ name: 'Array.isArray', ok: false, detail: err.message })
}

results.lastCompleted = 'Array.isArray'
save()

try {
  const value = Array.from([1, 2, 3]).length
  results.checks.push({ name: 'Array.from', ok: true, detail: value })
} catch (err) {
  results.checks.push({ name: 'Array.from', ok: false, detail: err.message })
}

results.lastCompleted = 'Array.from'
save()

try {
  const value = Number.isFinite(1)
  results.checks.push({ name: 'Number.isFinite', ok: true, detail: value })
} catch (err) {
  results.checks.push({ name: 'Number.isFinite', ok: false, detail: err.message })
}

results.lastCompleted = 'Number.isFinite'
save()

try {
  const value = Number.parseFloat('1.5')
  results.checks.push({ name: 'Number.parseFloat', ok: true, detail: value })
} catch (err) {
  results.checks.push({ name: 'Number.parseFloat', ok: false, detail: err.message })
}

results.lastCompleted = 'Number.parseFloat'
save()

try {
  const value = Math.max(1, 2, 3)
  results.checks.push({ name: 'Math.max', ok: true, detail: value })
} catch (err) {
  results.checks.push({ name: 'Math.max', ok: false, detail: err.message })
}

results.lastCompleted = 'Math.max'
save()

try {
  const value = JSON.parse('{"a":1}').a
  results.checks.push({ name: 'JSON.parse', ok: true, detail: value })
} catch (err) {
  results.checks.push({ name: 'JSON.parse', ok: false, detail: err.message })
}

results.lastCompleted = 'JSON.parse'
save()

try {
  const value = Date.now()
  results.checks.push({ name: 'Date.now', ok: true, detail: typeof value })
} catch (err) {
  results.checks.push({ name: 'Date.now', ok: false, detail: err.message })
}

results.lastCompleted = 'Date.now'
save()

try {
  const value = String.fromCharCode(65)
  results.checks.push({ name: 'String.fromCharCode', ok: true, detail: value })
} catch (err) {
  results.checks.push({ name: 'String.fromCharCode', ok: false, detail: err.message })
}

results.lastCompleted = 'String.fromCharCode'
save()

try {
  const value = Promise.resolve(1)
  results.checks.push({ name: 'Promise.resolve', ok: true, detail: typeof value })
} catch (err) {
  results.checks.push({ name: 'Promise.resolve', ok: false, detail: err.message })
}

results.lastCompleted = 'Promise.resolve'
save()

try {
  const value = new RegExp('^a$').test('a')
  results.checks.push({ name: 'new RegExp', ok: true, detail: value })
} catch (err) {
  results.checks.push({ name: 'new RegExp', ok: false, detail: err.message })
}

results.lastCompleted = 'new RegExp'
results.finished = true
save()

_helpers.Report('Completed all ' + results.checks.length + ' checks')
