// R4: which static built-in halts the action?
//
// No try/catch — a halt is not catchable, and repeated catch blocks are
// themselves a suspect. Each check is a plain statement followed by a stage
// marker, with a unique variable name so nothing can collide.
//
// lastCompleted names the last helper that WORKED. The next one killed it.

const results = { probe: 'syn.static.r4', lastCompleted: 'start', checks: [] }

function save() {
  _files.write('syn-static.json', JSON.stringify(results, null, 2))
}

save()

const check0 = Object.keys({ a: 1, b: 2 }).length
results.checks.push({ name: 'Object.keys', value: check0 })
results.lastCompleted = 'Object.keys'
save()

const check1 = Object.values({ a: 1, b: 2 }).length
results.checks.push({ name: 'Object.values', value: check1 })
results.lastCompleted = 'Object.values'
save()

const check2 = Object.entries({ a: 1 }).length
results.checks.push({ name: 'Object.entries', value: check2 })
results.lastCompleted = 'Object.entries'
save()

const check3 = Object.keys(Object.assign({}, { a: 1 }, { b: 2 })).length
results.checks.push({ name: 'Object.assign', value: check3 })
results.lastCompleted = 'Object.assign'
save()

const check4 = Object.fromEntries([['a', 1]]).a
results.checks.push({ name: 'Object.fromEntries', value: check4 })
results.lastCompleted = 'Object.fromEntries'
save()

const check5 = Object.getOwnPropertyNames({ a: 1 }).length
results.checks.push({ name: 'Object.getOwnPropertyNames', value: check5 })
results.lastCompleted = 'Object.getOwnPropertyNames'
save()

const check6 = typeof Object.getPrototypeOf({ a: 1 })
results.checks.push({ name: 'Object.getPrototypeOf', value: check6 })
results.lastCompleted = 'Object.getPrototypeOf'
save()

const check7 = typeof Object.freeze({ a: 1 })
results.checks.push({ name: 'Object.freeze', value: check7 })
results.lastCompleted = 'Object.freeze'
save()

const check8 = Array.isArray([1, 2])
results.checks.push({ name: 'Array.isArray', value: check8 })
results.lastCompleted = 'Array.isArray'
save()

const check9 = Array.from([1, 2, 3]).length
results.checks.push({ name: 'Array.from', value: check9 })
results.lastCompleted = 'Array.from'
save()

const check10 = Number.isFinite(1)
results.checks.push({ name: 'Number.isFinite', value: check10 })
results.lastCompleted = 'Number.isFinite'
save()

const check11 = Number.parseFloat('1.5')
results.checks.push({ name: 'Number.parseFloat', value: check11 })
results.lastCompleted = 'Number.parseFloat'
save()

const check12 = Math.max(1, 2, 3)
results.checks.push({ name: 'Math.max', value: check12 })
results.lastCompleted = 'Math.max'
save()

const check13 = JSON.parse('{"a":1}').a
results.checks.push({ name: 'JSON.parse', value: check13 })
results.lastCompleted = 'JSON.parse'
save()

const check14 = typeof Date.now()
results.checks.push({ name: 'Date.now', value: check14 })
results.lastCompleted = 'Date.now'
save()

const check15 = String.fromCharCode(65)
results.checks.push({ name: 'String.fromCharCode', value: check15 })
results.lastCompleted = 'String.fromCharCode'
save()

const check16 = typeof Promise.resolve(1)
results.checks.push({ name: 'Promise.resolve', value: check16 })
results.lastCompleted = 'Promise.resolve'
save()

const check17 = new RegExp('^a$').test('a')
results.checks.push({ name: 'new RegExp', value: check17 })
results.lastCompleted = 'new RegExp'
save()

results.finished = true
save()

_helpers.Report('All ' + results.checks.length + ' static helpers worked')
