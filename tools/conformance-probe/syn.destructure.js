// R3: does destructuring parse, WITHOUT default values?
// R2-2 failed on `function withDefault(value = 'defaulted')`, so defaults are
// out. This tests plain destructuring on its own.

const source = { alpha: 1, beta: 2 }
const numbers = [10, 20, 30]

const { alpha } = source
const [firstNumber] = numbers

const results = {
  probe: 'syn.destructure',
  objectDestructure: alpha,
  arrayDestructure: firstNumber,
  ok: alpha === 1 && firstNumber === 10
}

_files.write('syn-destructure.json', JSON.stringify(results, null, 2))

_helpers.Report('Destructuring parses: ' + results.ok)
