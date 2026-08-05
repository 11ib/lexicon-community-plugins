// Settings coercion. The round 1 version completed in 5ms without writing its
// file and without logging an error, so this one writes progressively: whatever
// made it into the file tells us how far execution actually got.

const results = { probe: 'set.dump', stage: 'start' }

_files.write('set-dump.json', JSON.stringify(results, null, 2))

results.settingsType = typeof _settings
results.settingsIsNull = _settings === null
results.stage = 'read-type'

_files.write('set-dump.json', JSON.stringify(results, null, 2))

results.settingsKeys = Object.keys(_settings)
results.stage = 'read-keys'

_files.write('set-dump.json', JSON.stringify(results, null, 2))

results.entries = []

for (const key of Object.keys(_settings)) {
  const value = _settings[key]

  results.entries.push({
    key: key,
    type: typeof value,
    value: value,
    json: JSON.stringify(value),
    isEmptyString: value === '',
    isNull: value === null
  })
}

results.stage = 'read-entries'

_files.write('set-dump.json', JSON.stringify(results, null, 2))

const missing = _settings['NotDeclaredAnywhere']

results.missingKeyType = typeof missing
results.missingKeyIsNull = missing === null
results.stage = 'read-missing'

_files.write('set-dump.json', JSON.stringify(results, null, 2))

results.stage = 'complete'

_files.write('set-dump.json', JSON.stringify(results, null, 2))

_helpers.Report('typeof _settings: ' + results.settingsType)
_helpers.Report('Keys: ' + results.settingsKeys.join(', '))

for (const entry of results.entries) {
  _helpers.Report(entry.key + ' -> ' + entry.type + ' ' + entry.json)
}

_helpers.Report('Missing key type: ' + results.missingKeyType)
