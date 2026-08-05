// Probe 5: are settings always strings? Read-only.

const results = {}

results.probe = 'settings'
results.ranAt = new Date().toISOString()
results.settingsType = typeof _settings
results.settingsKeys = Object.keys(_settings)
results.entries = []

for (const key of Object.keys(_settings)) {
  const value = _settings[key]

  results.entries.push({
    key: key,
    type: typeof value,
    value: value,
    json: JSON.stringify(value),
    isEmptyString: value === '',
    isNull: value === null,
    isUndefined: value === undefined
  })
}

// What happens for a key that isn't declared in config.json?
const missing = _settings['NotDeclaredAnywhere']
results.missingKey = { type: typeof missing, isUndefined: missing === undefined, isNull: missing === null }

// Is _settings mutable from inside the action, and does it leak to the next run?
let mutationError = null

try {
  _settings['AString'] = 'mutated-by-probe'
  results.mutationTookEffect = _settings['AString'] === 'mutated-by-probe'
} catch (err) {
  mutationError = err.message
  results.mutationTookEffect = false
}

results.mutationError = mutationError

_files.write('settings.json', JSON.stringify(results, null, 2))

_helpers.Report('Wrote settings.json')

for (const entry of results.entries) {
  _helpers.Report(entry.key + ' -> ' + entry.type + ' ' + entry.json)
}
