// Probe 4: what survives a _storage round trip, and is the API sync or async?
// Only touches this action's own storage records.

const results = {}

results.probe = 'storage'
results.ranAt = new Date().toISOString()

// 1. Unset key
const unsetReturn = _storage.load('definitely.not.set.' + Date.now())
results.loadReturnsThenable = unsetReturn !== null && typeof unsetReturn === 'object' && typeof unsetReturn.then === 'function'

const unsetValue = await unsetReturn
results.unsetKey = { value: unsetValue, type: typeof unsetValue, isNull: unsetValue === null }

// 2. Round trip a range of types
const cases = [
  { key: 'probe.string', value: 'hello world' },
  { key: 'probe.emptyString', value: '' },
  { key: 'probe.number', value: 42 },
  { key: 'probe.float', value: 3.14159 },
  { key: 'probe.zero', value: 0 },
  { key: 'probe.boolTrue', value: true },
  { key: 'probe.boolFalse', value: false },
  { key: 'probe.null', value: null },
  { key: 'probe.array', value: [1, 'two', { three: 3 }] },
  { key: 'probe.object', value: { a: 1, b: 'two', c: [3], d: { e: null } } },
  { key: 'probe.date', value: new Date('2024-01-01T00:00:00.000Z') },
  { key: 'probe.nested', value: { deep: { deeper: { deepest: [1, 2, 3] } } } }
]

results.roundTrips = []

for (const testCase of cases) {
  let entry = {
    key: testCase.key,
    wroteType: typeof testCase.value,
    wroteJson: null,
    readType: null,
    readJson: null,
    identical: null,
    error: null
  }

  try {
    entry.wroteJson = JSON.stringify(testCase.value)

    const saveReturn = _storage.save(testCase.key, testCase.value)
    entry.saveReturnsThenable = saveReturn !== null && typeof saveReturn === 'object' && typeof saveReturn.then === 'function'
    await saveReturn

    const readBack = await _storage.load(testCase.key)

    entry.readType = typeof readBack
    entry.readJson = JSON.stringify(readBack)
    entry.identical = entry.wroteJson === entry.readJson
  } catch (err) {
    entry.error = err.message
  }

  results.roundTrips.push(entry)
}

// 3. Does a key persist across runs? Bump a counter.
let runCount = await _storage.load('probe.runCount')

if (runCount === null || runCount === undefined) {
  runCount = 0
}

// Note whether it came back as a number or a string — that matters for the mock.
results.runCountTypeOnLoad = typeof runCount
runCount = Number(runCount) + 1
_storage.save('probe.runCount', runCount)
results.runCount = runCount

_files.write('storage.json', JSON.stringify(results, null, 2))

_helpers.Report('Wrote storage.json')
_helpers.Report('load() of unset key returned: ' + JSON.stringify(results.unsetKey))
_helpers.Report('Types that did NOT survive: ' + (results.roundTrips.filter(x => x.identical === false).map(x => x.key).join(', ') || 'none'))
_helpers.Report('This action has run ' + runCount + ' time(s)')
