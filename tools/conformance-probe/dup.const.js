// R4: the same const name declared in two sibling blocks. Legal JavaScript,
// but not if the sandbox flattens block scope into one.

const results = { probe: 'dup.const', stage: 'start' }

_files.write('dup-const.json', JSON.stringify(results, null, 2))

if (true) {
  const value = 'first'
  results.first = value
}

results.stage = 'after-first-block'
_files.write('dup-const.json', JSON.stringify(results, null, 2))

if (true) {
  const value = 'second'
  results.second = value
}

results.stage = 'after-second-block'
results.finished = true
_files.write('dup-const.json', JSON.stringify(results, null, 2))

_helpers.Report('Same const name in two sibling blocks worked')
