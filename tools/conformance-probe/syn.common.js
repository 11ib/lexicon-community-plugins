// Four features in one file: template literals, destructuring, spread,
// default parameters. If this file fails to parse, the next round splits it.

function withDefault(value = 'defaulted') {
  return value
}

const source = { alpha: 1, beta: 2 }
const numbers = [10, 20, 30]

const { alpha } = source
const [firstNumber] = numbers

const spreadArray = [...numbers, 40]
const spreadObject = { ...source, gamma: 3 }
const templated = `alpha is ${alpha}`

const results = {
  probe: 'syn.common',
  templateLiteral: templated,
  destructuredObject: alpha,
  destructuredArray: firstNumber,
  spreadArrayLength: spreadArray.length,
  spreadObjectKeyCount: Object.keys(spreadObject).length,
  defaultParamOmitted: withDefault(),
  defaultParamGiven: withDefault('given')
}

_files.write('syn-common.json', JSON.stringify(results, null, 2))

_helpers.Report('Template, destructuring, spread and default params all parsed')
