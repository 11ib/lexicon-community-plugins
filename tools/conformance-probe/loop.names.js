// R5: do two sequential for-of loops reusing the same variable name collide?
//
// Block scope is flattened — two sibling blocks declaring `const value` fail
// with "Identifier 'value' has already been declared". If loop heads behave
// the same way, then `for (const track of ...)` twice in one action is illegal,
// which would affect almost every real plugin. The lint rule deliberately does
// not flag loop variables until this is settled.

const results = { probe: 'loop.names', lastCompleted: 'start', counts: {} }

function save() {
  _files.write('loop-names.json', JSON.stringify(results, null, 2))
}

save()

const listA = [1, 2, 3]
const listB = [4, 5]

let totalA = 0

for (const item of listA) {
  totalA += item
}

results.counts.first = totalA
results.lastCompleted = 'first-loop'
save()

// Same variable name, second loop. This is the statement under test.
let totalB = 0

for (const item of listB) {
  totalB += item
}

results.counts.second = totalB
results.lastCompleted = 'second-loop-same-name'
results.finished = true
save()

_helpers.Report('Two for-of loops sharing the name item both ran')
