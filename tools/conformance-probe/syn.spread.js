// R3: does spread parse, for arrays and objects?

const numbers = [10, 20, 30]
const source = { alpha: 1, beta: 2 }

const spreadArray = [...numbers, 40]
const spreadObject = { ...source, gamma: 3 }

const results = {
  probe: 'syn.spread',
  arrayLength: spreadArray.length,
  objectKeyCount: Object.keys(spreadObject).length,
  ok: spreadArray.length === 4 && Object.keys(spreadObject).length === 3
}

_files.write('syn-spread.json', JSON.stringify(results, null, 2))

_helpers.Report('Spread parses: ' + results.ok)
