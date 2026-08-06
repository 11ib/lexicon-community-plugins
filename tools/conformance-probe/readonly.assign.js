// R3: does assigning to an injected global halt execution silently?
//
// The round 1 settings probe completed in 5ms, logged nothing and wrote no
// file. The only thing it did that the working version does not is assign to
// _settings. This isolates that, with a stage marker either side.

const results = { probe: 'readonly.assign', lastCompleted: 'start' }

function save() {
  _files.write('readonly-assign.json', JSON.stringify(results, null, 2))
}

save()

results.settingsBefore = _settings['AString']
results.lastCompleted = 'read-setting'
save()

try {
  _settings['AString'] = 'mutated-by-probe'
  results.assignOutcome = 'no error'
  results.settingsAfter = _settings['AString']
} catch (err) {
  results.assignOutcome = 'threw: ' + err.message
}

results.lastCompleted = 'assign-settings'
results.finished = true
save()

_helpers.Report('Assign outcome: ' + results.assignOutcome)
_helpers.Report('If this file says lastCompleted=read-setting, the assignment halted the script silently')
