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

  it('rejects Object.prototype access', async () => {
    // Real Lexicon error: Static method or property access not permitted
    await expectRejected(
      'const a = { b: 1 }\nconst has = Object.prototype.hasOwnProperty.call(a, "b")\n_helpers.Log(String(has))',
      'Object.prototype'
    )
  })

  it('rejects a catch binding inside a nested function', async () => {
    // Real Lexicon error: err is not defined
    await expectRejected(
      `function risky() {
  try {
    throw new Error("x")
  } catch (err) {
    return err.message
  }
}
_helpers.Log(risky())`,
      'catch binding inside a nested function'
    )
  })

  it('rejects a catch binding inside an arrow function', async () => {
    await expectRejected(
      `const risky = () => {
  try {
    throw new Error("x")
  } catch (err) {
    return err.message
  }
}
_helpers.Log(risky())`,
      'catch binding inside a nested function'
    )
  })

  it('accepts a top-level try/catch, which does work', async () => {
    const ids = await ruleIdsFor(
      'try {\n  throw new Error("x")\n} catch (err) {\n  _helpers.Log(err.message)\n}'
    )
    expect(ids).not.toContain('no-restricted-syntax')
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
