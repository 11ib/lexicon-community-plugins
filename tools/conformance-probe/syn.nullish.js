// Does the ?? operator parse? Optional chaining (?.) is already known to fail.

const missing = null
const fallback = missing ?? 'fallback-used'
const zero = 0 ?? 'should-not-be-used'

const results = {
  probe: 'syn.nullish',
  nullishResult: fallback,
  zeroIsKept: zero
}

_files.write('syn-nullish.json', JSON.stringify(results, null, 2))

_helpers.Report('?? works. null -> ' + fallback + ', 0 -> ' + zero)
