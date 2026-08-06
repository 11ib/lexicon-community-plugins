// Tests for the sandbox lint rules themselves.
//
// These rules are the only thing standing between a contributor and a plugin
// that won't load in Lexicon at all. Two reasons they need their own tests:
//
//   1. `no-extra-semi` is deprecated in ESLint 9. It still works today, but if
//      it is dropped in a future major we lose one of the four restrictions
//      Lexicon documents — silently, with CI still green.
//   2. The undocumented restrictions (optional chaining, Object.prototype,
//      catch-in-nested-function) were found by probing a real Lexicon. If a
//      selector regresses, nothing else would catch it.

import { describe, it, expect, beforeAll } from 'vitest'
import { ESLint } from 'eslint'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// Lint as if the file were a plugin action, so the sandbox config block applies.
const AS_PLUGIN = join(ROOT, 'plugins', 'lint-target', 'some.action.js')

let eslint

beforeAll(() => {
  eslint = new ESLint({ cwd: ROOT })
})

async function lint(code) {
  const results = await eslint.lintText(code, { filePath: AS_PLUGIN })
  return results[0].messages
}

async function ruleIdsFor(code) {
  const messages = await lint(code)
  return messages.map((m) => m.ruleId)
}

async function expectRejected(code, expectedText) {
  const messages = await lint(code)
  const combined = messages.map((m) => m.message).join('\n')

  expect(
    messages.length,
    `expected this to be rejected but lint was clean:\n${code}`
  ).toBeGreaterThan(0)

  expect(combined).toContain(expectedText)
}

describe('documented Lexicon parser restrictions', () => {
  it('rejects if-statement one-liners', async () => {
    await expectRejected('if (_vars.tracksSelected.length) {\n}\nif (1) _helpers.Log("x")', 'Expected { after')
  })

  it('accepts an if with braces', async () => {
    const ids = await ruleIdsFor('if (1) {\n  _helpers.Log("x")\n}')
    expect(ids).not.toContain('curly')
  })

  it('rejects do-while loops', async () => {
    await expectRejected(
      'let i = 0\ndo {\n  i += 1\n} while (i < 3)',
      'rejects do-while loops'
    )
  })

  it('rejects trailing semicolons after a block', async () => {
    // This is the deprecated no-extra-semi rule. If ESLint ever drops it, this
    // test fails and we replace it before contributors are affected.
    const ids = await ruleIdsFor('for (const x of [1]) {\n  _helpers.Log(String(x))\n};')
    expect(ids).toContain('no-extra-semi')
  })

  it('rejects object shorthand', async () => {
    await expectRejected(
      'const name = "x"\nconst obj = { name }\n_helpers.Log(obj.name)',
      'longform'
    )
  })

  it('accepts explicit object keys', async () => {
    const ids = await ruleIdsFor('const name = "x"\nconst obj = { name: name }\n_helpers.Log(obj.name)')
    expect(ids).not.toContain('object-shorthand')
  })
})

describe('undocumented restrictions found by probing', () => {
  it('rejects optional chaining', async () => {
    // Real Lexicon error: Unexpected token after inlineIf: ?: ? "71"
    await expectRejected('const a = { b: 1 }\nconst v = a?.b', 'optional chaining')
  })

  it('still accepts the ternary operator, which does work', async () => {
    const ids = await ruleIdsFor('const v = 1 > 0 ? "yes" : "no"\n_helpers.Log(v)')
    expect(ids).not.toContain('no-restricted-syntax')
  })

  it('rejects nullish coalescing', async () => {
    // Real Lexicon error: Unexpected token after inlineIf: ?: ? "0"
    await expectRejected('const v = null ?? "fallback"\n_helpers.Log(v)', 'nullish coalescing')
  })

  it('rejects default parameter values', async () => {
    // Real Lexicon error: Unexpected token after prop: w: function withDefault(value = "0")
    await expectRejected(
      'function f(value = "x") {\n  return value\n}\n_helpers.Log(f())',
      'default values in parameters'
    )
  })

  it('rejects object destructuring', async () => {
    // Real Lexicon error: Unexpected token after prop: {: const { alpha } = source
    await expectRejected(
      'const source = { alpha: 1 }\nconst { alpha } = source\n_helpers.Log(String(alpha))',
      'object destructuring'
    )
  })

  it('rejects array destructuring', async () => {
    await expectRejected(
      'const items = [1, 2]\nconst [first] = items\n_helpers.Log(String(first))',
      'array destructuring'
    )
  })

  it('accepts template literals, which do work', async () => {
    const ids = await ruleIdsFor('const n = 3\n_helpers.Report(`Added ${n} track(s)`)')
    expect(ids).not.toContain('no-restricted-syntax')
  })

  it('accepts spread, which does work', async () => {
    const ids = await ruleIdsFor('const a = [1, 2]\nconst b = [...a, 3]\n_helpers.Log(String(b.length))')
    expect(ids).not.toContain('no-restricted-syntax')
  })

  it('rejects assigning to an injected global', async () => {
    // This halts the action silently in Lexicon — the worst failure mode there is.
    await expectRejected("_settings['Key'] = 'x'", 'silently halts')
    await expectRejected('_vars.tracksSelected = []', 'silently halts')
  })

  it('still accepts mutating a track handed to the action', async () => {
    // This is the normal way to persist changes and must not be flagged.
    const ids = await ruleIdsFor(
      'for (const track of _vars.tracksSelected) {\n  track.rating = 5\n}'
    )
    expect(ids).not.toContain('no-restricted-syntax')
  })

  it('rejects Object.prototype access', async () => {
    // Real Lexicon error: Static method or property access not permitted
    await expectRejected(
      'const a = { b: 1 }\nconst has = Object.prototype.hasOwnProperty.call(a, "b")\n_helpers.Log(String(has))',
      'Object.prototype'
    )
  })

  it('rejects try/catch anywhere, including at the top level', async () => {
    // The catch parameter is never bound ("err is not defined"), and renaming
    // it does not help ("errA is not defined"). Separately, a try block that
    // does not throw halts the action silently.
    await expectRejected(
      'try {\n  throw new Error("x")\n} catch (err) {\n  _helpers.Log(err.message)\n}',
      'try/catch does not work in Lexicon'
    )
  })

  it('rejects try/catch inside a function too', async () => {
    await expectRejected(
      `function risky() {
  try {
    return doThing()
  } catch (err) {
    return err.message
  }
}
_helpers.Log(risky())`,
      'try/catch does not work in Lexicon'
    )
  })

  it('accepts throwing a plain Error, which is the reliable failure path', async () => {
    const ids = await ruleIdsFor(
      'if (!_settings["Key"]) {\n  throw new Error("Set a value in the action settings")\n}'
    )
    expect(ids).not.toContain('no-restricted-syntax')
  })

  it('rejects Object.assign but allows Object.keys, values and entries', async () => {
    await expectRejected('const merged = Object.assign({}, { a: 1 })\n_helpers.Log(String(merged.a))', 'Object.assign')

    const ids = await ruleIdsFor(
      'const source = { a: 1 }\n' +
        '_helpers.Log(String(Object.keys(source).length))\n' +
        '_helpers.Log(String(Object.values(source).length))\n' +
        '_helpers.Log(String(Object.entries(source).length))'
    )
    expect(ids).not.toContain('no-restricted-syntax')
  })

  it('rejects the stubbed Object.freeze and Object.getPrototypeOf', async () => {
    // These are worse than blocked: they return undefined with no error at all.
    await expectRejected('const frozen = Object.freeze({ a: 1 })\n_helpers.Log(String(frozen))', 'stubbed')
    await expectRejected('const proto = Object.getPrototypeOf({ a: 1 })\n_helpers.Log(String(proto))', 'stubbed')
  })

  it('allows the many statics that do work', async () => {
    const ids = await ruleIdsFor(
      `const fromEntries = Object.fromEntries([['a', 1]])
const names = Object.getOwnPropertyNames(fromEntries)
const arr = Array.from([1, 2, 3])
const finite = Number.isFinite(1)
const rounded = Math.round(1.5)
const parsed = JSON.parse('{"a":1}')
const now = Date.now()
const when = new Date().toISOString()
const matches = new RegExp('^a$').test('a')
_helpers.Log(String(names.length + arr.length + rounded + parsed.a + now) + finite + when + matches)`
    )
    expect(ids).not.toContain('no-restricted-syntax')
  })
})

describe('flattened block scope', () => {
  it('rejects the same const name in two sibling blocks', async () => {
    // Real Lexicon error: Identifier 'value' has already been declared
    await expectRejected(
      `if (1) {
  const value = 'first'
  _helpers.Log(value)
}

if (1) {
  const value = 'second'
  _helpers.Log(value)
}`,
      'already declared in this action'
    )
  })

  it('rejects a name reused between a block and the top level', async () => {
    await expectRejected(
      `const total = 1

if (1) {
  const total = 2
  _helpers.Log(String(total))
}`,
      'already declared in this action'
    )
  })

  it('allows two loops sharing a variable name, which does work', async () => {
    // Probed: two sequential for-of loops both using `item` ran fine. The
    // flattened-scope collision applies to block bodies, not loop heads —
    // and flagging this would break nearly every real plugin.
    const ids = await ruleIdsFor(
      `for (const item of [1, 2]) {
  _helpers.Log(String(item))
}

for (const item of [3, 4]) {
  _helpers.Log(String(item))
}`
    )
    expect(ids).not.toContain('lexicon/no-duplicate-block-scoped-names')
  })

  it('accepts distinct names in sibling blocks', async () => {
    const ids = await ruleIdsFor(
      `if (1) {
  const first = 'a'
  _helpers.Log(first)
}

if (1) {
  const second = 'b'
  _helpers.Log(second)
}`
    )
    expect(ids).not.toContain('lexicon/no-duplicate-block-scoped-names')
  })

  it('allows the same name in two different function scopes', async () => {
    // Separate function scopes are genuinely separate; only block scope is flat.
    const ids = await ruleIdsFor(
      `function a() {
  const value = 1
  return value
}

function b() {
  const value = 2
  return value
}

_helpers.Log(String(a() + b()))`
    )
    expect(ids).not.toContain('lexicon/no-duplicate-block-scoped-names')
  })
})

describe('sandbox environment restrictions', () => {
  it('rejects require()', async () => {
    await expectRejected('const fs = require("fs")\n_helpers.Log(String(fs))', 'module system')
  })

  it('rejects import statements', async () => {
    await expectRejected('import fs from "fs"\n_helpers.Log(String(fs))', 'cannot use import')
  })

  it('rejects window and document', async () => {
    await expectRejected('window.alert("x")', 'no window object')
    await expectRejected('document.title = "x"', 'no document object')
  })

  it('rejects fetch in favour of _network', async () => {
    await expectRejected('await fetch("https://example.com")', '_network.GET')
  })

  it('rejects dynamic code construction', async () => {
    await expectRejected('const f = new Function("return 1")\n_helpers.Log(String(f()))', 'Function')
    await expectRejected('eval("1 + 1")', 'eval')
  })

  it('catches typos in the injected globals', async () => {
    // _helper is not a thing; _helpers is.
    const ids = await ruleIdsFor('_helper.Log("x")')
    expect(ids).toContain('no-undef')
  })
})

describe('a well-formed action lints clean', () => {
  it('accepts the idiomatic style the README teaches', async () => {
    const messages = await lint(`const perStar = Number(_settings['Energy Per Star'])

if (!Number.isFinite(perStar) || perStar <= 0) {
  throw new Error('bad setting')
}

let updated = 0

for (const track of _vars.tracksSelected) {
  if (!track.energy) {
    continue
  }

  const stars = Math.round(track.energy / perStar)

  if (track.rating !== stars) {
    track.rating = stars
    updated += 1
  }
}

_helpers.Report('Updated ' + updated + ' track(s)')`)

    expect(messages, JSON.stringify(messages, null, 2)).toEqual([])
  })
})
