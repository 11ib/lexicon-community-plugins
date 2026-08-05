// Probe 1: what does the sandbox actually expose?
// Uses `typeof` everywhere so undeclared identifiers can't throw ReferenceError.

const results = {}

results.probe = 'env'
results.ranAt = new Date().toISOString()

results.globals = [
  { name: 'require', type: typeof require },
  { name: 'module', type: typeof module },
  { name: 'exports', type: typeof exports },
  { name: 'window', type: typeof window },
  { name: 'document', type: typeof document },
  { name: 'globalThis', type: typeof globalThis },
  { name: 'process', type: typeof process },
  { name: 'console', type: typeof console },
  { name: 'fetch', type: typeof fetch },
  { name: 'XMLHttpRequest', type: typeof XMLHttpRequest },
  { name: 'setTimeout', type: typeof setTimeout },
  { name: 'setInterval', type: typeof setInterval },
  { name: 'queueMicrotask', type: typeof queueMicrotask },
  { name: 'Buffer', type: typeof Buffer },
  { name: 'eval', type: typeof eval },
  { name: 'Function', type: typeof Function },
  { name: 'JSON', type: typeof JSON },
  { name: 'Math', type: typeof Math },
  { name: 'Date', type: typeof Date },
  { name: 'RegExp', type: typeof RegExp },
  { name: 'Promise', type: typeof Promise },
  { name: 'Symbol', type: typeof Symbol },
  { name: 'Map', type: typeof Map },
  { name: 'Set', type: typeof Set },
  { name: 'WeakMap', type: typeof WeakMap },
  { name: 'Proxy', type: typeof Proxy },
  { name: 'Reflect', type: typeof Reflect },
  { name: 'Intl', type: typeof Intl },
  { name: 'TextEncoder', type: typeof TextEncoder },
  { name: 'structuredClone', type: typeof structuredClone },
  { name: 'BigInt', type: typeof BigInt },
  { name: 'Error', type: typeof Error },
  { name: 'TypeError', type: typeof TypeError },
  { name: 'AggregateError', type: typeof AggregateError },
  { name: 'atob', type: typeof atob },
  { name: 'btoa', type: typeof btoa },
  { name: 'crypto', type: typeof crypto },
  { name: 'URL', type: typeof URL },
  { name: 'URLSearchParams', type: typeof URLSearchParams }
]

results.namespaces = [
  { name: '_vars', type: typeof _vars },
  { name: '_library', type: typeof _library },
  { name: '_settings', type: typeof _settings },
  { name: '_storage', type: typeof _storage },
  { name: '_network', type: typeof _network },
  { name: '_ui', type: typeof _ui },
  { name: '_helpers', type: typeof _helpers },
  { name: '_files', type: typeof _files },
  { name: '_musicplayer', type: typeof _musicplayer },
  { name: '_config', type: typeof _config },
  { name: '_plugin', type: typeof _plugin },
  { name: '_action', type: typeof _action },
  { name: '_lexicon', type: typeof _lexicon }
]

// List the members of a namespace object, including anything on its prototype.
function describeMembers(obj) {
  const members = []

  if (obj === null || typeof obj !== 'object') {
    return members
  }

  let seen = {}
  let current = obj

  while (current !== null && current !== Object.prototype) {
    const names = Object.getOwnPropertyNames(current)

    for (const key of names) {
      if (seen[key] === true) {
        continue
      }

      seen[key] = true

      let memberType = 'unreadable'

      try {
        memberType = typeof current[key]
      } catch (err) {
        memberType = 'throws: ' + err.message
      }

      members.push({ key: key, type: memberType })
    }

    current = Object.getPrototypeOf(current)
  }

  return members
}

results.members = {}

if (typeof _library !== 'undefined') {
  results.members._library = describeMembers(_library)

  if (_library.track) {
    results.members['_library.track'] = describeMembers(_library.track)
  }

  if (_library.playlist) {
    results.members['_library.playlist'] = describeMembers(_library.playlist)
  }

  if (_library.customTag) {
    results.members['_library.customTag'] = describeMembers(_library.customTag)
  }

  if (_library.customTagCategory) {
    results.members['_library.customTagCategory'] = describeMembers(_library.customTagCategory)
  }
}

if (typeof _helpers !== 'undefined') {
  results.members._helpers = describeMembers(_helpers)
}

if (typeof _ui !== 'undefined') {
  results.members._ui = describeMembers(_ui)
}

if (typeof _storage !== 'undefined') {
  results.members._storage = describeMembers(_storage)
}

if (typeof _network !== 'undefined') {
  results.members._network = describeMembers(_network)
}

if (typeof _files !== 'undefined') {
  results.members._files = describeMembers(_files)
}

if (typeof _musicplayer !== 'undefined') {
  results.members._musicplayer = describeMembers(_musicplayer)
}

if (typeof _vars !== 'undefined') {
  results.members._vars = describeMembers(_vars)
}

if (typeof _settings !== 'undefined') {
  results.members._settings = describeMembers(_settings)
}

// Language feature checks that the docs warn about.
results.language = []

// Optional chaining / nullish coalescing / spread — if the parser rejects these
// the whole action fails to load, which is itself the answer.
const featureProbe = { a: { b: 1 } }
results.language.push({ feature: 'optionalChaining', ok: featureProbe?.a?.b === 1 })
results.language.push({ feature: 'nullishCoalescing', ok: (null ?? 'fallback') === 'fallback' })
results.language.push({ feature: 'spread', ok: [...[1, 2]].length === 2 })
results.language.push({ feature: 'objectSpread', ok: Object.keys({ ...featureProbe }).length === 1 })
results.language.push({ feature: 'arrowFn', ok: ((x) => x + 1)(1) === 2 })
results.language.push({ feature: 'templateLiteral', ok: `a${1}` === 'a1' })
results.language.push({ feature: 'classes', ok: typeof class Foo {} === 'function' })
results.language.push({ feature: 'asyncArrow', ok: typeof (async () => {}) === 'function' })
results.language.push({ feature: 'generator', ok: typeof function* gen() {} === 'function' })
results.language.push({ feature: 'labeledBreak', ok: true })
results.language.push({ feature: 'arrayAt', ok: typeof [].at === 'function' })
results.language.push({ feature: 'arrayFlatMap', ok: typeof [].flatMap === 'function' })
results.language.push({ feature: 'objectFromEntries', ok: typeof Object.fromEntries === 'function' })
results.language.push({ feature: 'stringReplaceAll', ok: typeof ''.replaceAll === 'function' })
results.language.push({ feature: 'promiseAllSettled', ok: typeof Promise.allSettled === 'function' })

// Can we reach a constructor escape hatch? Purely informational for the security notes.
let functionConstructorWorks = false

try {
  const sneaky = (function () {}).constructor('return 1 + 1')
  functionConstructorWorks = sneaky() === 2
} catch (err) {
  functionConstructorWorks = 'throws: ' + err.message
}

results.functionConstructor = functionConstructorWorks

_files.write('env.json', JSON.stringify(results, null, 2))

_helpers.Report('Wrote env.json')
_helpers.Report('Namespaces present: ' + results.namespaces.filter(x => x.type !== 'undefined').map(x => x.name).join(', '))
