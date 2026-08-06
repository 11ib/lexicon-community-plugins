// R3: do template literals parse? The official example plugins use them, so
// this should pass — confirming it isolates what actually broke R2-2.

const count = 3
const name = 'Techno'
const message = `Added ${count} track(s) to "${name}"`

const results = {
  probe: 'syn.template',
  message: message,
  ok: message === 'Added 3 track(s) to "Techno"'
}

_files.write('syn-template.json', JSON.stringify(results, null, 2))

_helpers.Report('Template literals parse: ' + results.ok)
