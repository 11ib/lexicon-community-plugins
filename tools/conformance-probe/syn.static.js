// R5: the static built-ins after Object.assign, which the round 4 probe died on.
// Object.prototype and Object.assign are known blocked and deliberately absent.
//
// No try/catch — it does not work. Each check is a plain statement with a
// unique name, followed by a stage marker. lastCompleted names the last
// helper that WORKED; the next one is blocked.

const results = { probe: 'syn.static.r5', lastCompleted: 'start', checks: [] }

function save() {
  _files.write('syn-static.json', JSON.stringify(results, null, 2))
}

save()

const check0 = Object.fromEntries([['a', 1]]).a
results.checks.push({ name: 'Object.fromEntries', value: check0 })
results.lastCompleted = 'Object.fromEntries'
save()

const check1 = Object.getOwnPropertyNames({ a: 1 }).length
results.checks.push({ name: 'Object.getOwnPropertyNames', value: check1 })
results.lastCompleted = 'Object.getOwnPropertyNames'
save()

const check2 = typeof Object.getPrototypeOf({ a: 1 })
results.checks.push({ name: 'Object.getPrototypeOf', value: check2 })
results.lastCompleted = 'Object.getPrototypeOf'
save()

const check3 = typeof Object.freeze({ a: 1 })
results.checks.push({ name: 'Object.freeze', value: check3 })
results.lastCompleted = 'Object.freeze'
save()

const check4 = Array.isArray([1, 2])
results.checks.push({ name: 'Array.isArray', value: check4 })
results.lastCompleted = 'Array.isArray'
save()

const check5 = Array.from([1, 2, 3]).length
results.checks.push({ name: 'Array.from', value: check5 })
results.lastCompleted = 'Array.from'
save()

const check6 = Number.isFinite(1)
results.checks.push({ name: 'Number.isFinite', value: check6 })
results.lastCompleted = 'Number.isFinite'
save()

const check7 = Number.parseFloat('1.5')
results.checks.push({ name: 'Number.parseFloat', value: check7 })
results.lastCompleted = 'Number.parseFloat'
save()

const check8 = Math.max(1, 2, 3)
results.checks.push({ name: 'Math.max', value: check8 })
results.lastCompleted = 'Math.max'
save()

const check9 = Math.round(1.5)
results.checks.push({ name: 'Math.round', value: check9 })
results.lastCompleted = 'Math.round'
save()

const check10 = JSON.parse('{"a":1}').a
results.checks.push({ name: 'JSON.parse', value: check10 })
results.lastCompleted = 'JSON.parse'
save()

const check11 = JSON.stringify({ a: 1 }).length
results.checks.push({ name: 'JSON.stringify', value: check11 })
results.lastCompleted = 'JSON.stringify'
save()

const check12 = typeof Date.now()
results.checks.push({ name: 'Date.now', value: check12 })
results.lastCompleted = 'Date.now'
save()

const check13 = String.fromCharCode(65)
results.checks.push({ name: 'String.fromCharCode', value: check13 })
results.lastCompleted = 'String.fromCharCode'
save()

const check14 = typeof Promise.resolve(1)
results.checks.push({ name: 'Promise.resolve', value: check14 })
results.lastCompleted = 'Promise.resolve'
save()

const check15 = typeof Promise.all([])
results.checks.push({ name: 'Promise.all', value: check15 })
results.lastCompleted = 'Promise.all'
save()

const check16 = new RegExp('^a$').test('a')
results.checks.push({ name: 'new RegExp', value: check16 })
results.lastCompleted = 'new RegExp'
save()

const check17 = typeof new Date().toISOString()
results.checks.push({ name: 'new Date', value: check17 })
results.lastCompleted = 'new Date'
save()

results.finished = true
save()

_helpers.Report('All ' + results.checks.length + ' static helpers worked')
