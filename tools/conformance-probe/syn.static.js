// Which static built-in helpers does the sandbox allow?
// Round 1 died on `Object.prototype` with "Static method or property access
// not permitted", so that one is deliberately NOT tested here — if it is a
// parse-time rejection it would kill this whole file.
//
// Every check is wrapped in a TOP-LEVEL try/catch, which is confirmed working.

const results = { probe: 'syn.static', checks: [] }

try {
  const value = Object.keys({ a: 1, b: 2 }).length
  results.checks.push({ name: 'Object.keys', ok: true, detail: value })
} catch (err) {
  results.checks.push({ name: 'Object.keys', ok: false, detail: err.message })
}

try {
  const value = Object.values({ a: 1, b: 2 }).length
  results.checks.push({ name: 'Object.values', ok: true, detail: value })
} catch (err) {
  results.checks.push({ name: 'Object.values', ok: false, detail: err.message })
}

try {
  const value = Object.entries({ a: 1 }).length
  results.checks.push({ name: 'Object.entries', ok: true, detail: value })
} catch (err) {
  results.checks.push({ name: 'Object.entries', ok: false, detail: err.message })
}

try {
  const value = Object.assign({}, { a: 1 }, { b: 2 })
  results.checks.push({ name: 'Object.assign', ok: true, detail: Object.keys(value).length })
} catch (err) {
  results.checks.push({ name: 'Object.assign', ok: false, detail: err.message })
}

try {
  const value = Object.fromEntries([['a', 1]])
  results.checks.push({ name: 'Object.fromEntries', ok: true, detail: value.a })
} catch (err) {
  results.checks.push({ name: 'Object.fromEntries', ok: false, detail: err.message })
}

try {
  const value = Object.getOwnPropertyNames({ a: 1 }).length
  results.checks.push({ name: 'Object.getOwnPropertyNames', ok: true, detail: value })
} catch (err) {
  results.checks.push({ name: 'Object.getOwnPropertyNames', ok: false, detail: err.message })
}

try {
  const value = Object.getPrototypeOf({ a: 1 })
  results.checks.push({ name: 'Object.getPrototypeOf', ok: true, detail: typeof value })
} catch (err) {
  results.checks.push({ name: 'Object.getPrototypeOf', ok: false, detail: err.message })
}

try {
  const value = Object.freeze({ a: 1 })
  results.checks.push({ name: 'Object.freeze', ok: true, detail: typeof value })
} catch (err) {
  results.checks.push({ name: 'Object.freeze', ok: false, detail: err.message })
}

try {
  const value = Array.isArray([1, 2])
  results.checks.push({ name: 'Array.isArray', ok: true, detail: value })
} catch (err) {
  results.checks.push({ name: 'Array.isArray', ok: false, detail: err.message })
}

try {
  const value = Array.from([1, 2, 3]).length
  results.checks.push({ name: 'Array.from', ok: true, detail: value })
} catch (err) {
  results.checks.push({ name: 'Array.from', ok: false, detail: err.message })
}

try {
  const value = Number.isFinite(1)
  results.checks.push({ name: 'Number.isFinite', ok: true, detail: value })
} catch (err) {
  results.checks.push({ name: 'Number.isFinite', ok: false, detail: err.message })
}

try {
  const value = Number.parseFloat('1.5')
  results.checks.push({ name: 'Number.parseFloat', ok: true, detail: value })
} catch (err) {
  results.checks.push({ name: 'Number.parseFloat', ok: false, detail: err.message })
}

try {
  const value = Math.max(1, 2, 3)
  results.checks.push({ name: 'Math.max', ok: true, detail: value })
} catch (err) {
  results.checks.push({ name: 'Math.max', ok: false, detail: err.message })
}

try {
  const value = JSON.parse('{"a":1}').a
  results.checks.push({ name: 'JSON.parse', ok: true, detail: value })
} catch (err) {
  results.checks.push({ name: 'JSON.parse', ok: false, detail: err.message })
}

try {
  const value = Date.now()
  results.checks.push({ name: 'Date.now', ok: true, detail: typeof value })
} catch (err) {
  results.checks.push({ name: 'Date.now', ok: false, detail: err.message })
}

try {
  const value = String.fromCharCode(65)
  results.checks.push({ name: 'String.fromCharCode', ok: true, detail: value })
} catch (err) {
  results.checks.push({ name: 'String.fromCharCode', ok: false, detail: err.message })
}

try {
  const value = Promise.resolve(1)
  results.checks.push({ name: 'Promise.resolve', ok: true, detail: typeof value })
} catch (err) {
  results.checks.push({ name: 'Promise.resolve', ok: false, detail: err.message })
}

try {
  const value = new RegExp('^a$').test('a')
  results.checks.push({ name: 'new RegExp', ok: true, detail: value })
} catch (err) {
  results.checks.push({ name: 'new RegExp', ok: false, detail: err.message })
}

_files.write('syn-static.json', JSON.stringify(results, null, 2))

const failed = results.checks.filter(x => x.ok === false)

_helpers.Report('Checked ' + results.checks.length + ' static helpers')
_helpers.Report('Blocked: ' + (failed.map(x => x.name).join(', ') || 'none'))
