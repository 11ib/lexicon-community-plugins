// Tests for the manifest validator.
//
// These gates exist to catch config.json mistakes before a contributor spends
// a restart cycle discovering them in Lexicon. The action-name pattern in
// particular came from a real failure:
//
//   Some plugin(s) failed to load.
//   DEVELOPMENT conformance-probe: invalid config: action "name" property may
//   only contain characters a-z, numbers, dots, spaces, dash and underscore.
//
// A single colon in an action name takes down the entire plugin, every action
// in it, with no indication of which action is at fault.

import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCRIPT = join(ROOT, 'scripts', 'validate-configs.mjs')

// Build a throwaway plugins/ tree and run the real validator against it.
function validate(config, extraFiles = {}) {
  const base = mkdtempSync(join(tmpdir(), 'lexicon-validate-'))
  const pluginsDir = join(base, 'plugins')
  const dir = join(pluginsDir, 'fixture-plugin')

  mkdirSync(join(dir, '__tests__'), { recursive: true })
  writeFileSync(join(dir, 'config.json'), JSON.stringify(config, null, 2))

  // By default give every declared action a matching js file and a test, so
  // the only thing under examination is the manifest itself.
  for (const action of config.actions ?? []) {
    writeFileSync(join(dir, `${action.id}.js`), '_helpers.Report("ok")\n')
    writeFileSync(join(dir, '__tests__', `${action.id}.test.js`), '// test\n')
  }

  for (const [name, contents] of Object.entries(extraFiles)) {
    writeFileSync(join(dir, name), contents)
  }

  try {
    const stdout = execFileSync('node', [SCRIPT], {
      cwd: ROOT,
      env: { ...process.env, PLUGINS_DIR: join(base, 'plugins') },
      encoding: 'utf8',
      // Capture the validator's own output instead of letting it print into
      // the test run, where its intentional errors read as test failures.
      stdio: ['ignore', 'pipe', 'pipe']
    })
    return { ok: true, output: stdout }
  } catch (err) {
    return { ok: false, output: `${err.stdout ?? ''}${err.stderr ?? ''}` }
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
}

function manifest(overrides = {}) {
  return {
    id: 'fixture.plugin',
    author: { name: 'Fixture', email: 'fixture@example.com' },
    actions: [
      {
        id: 'my.action',
        name: 'My Action',
        description: 'A perfectly ordinary action that does a thing.',
        config: { permissions: {} }
      }
    ],
    ...overrides
  }
}

describe('action name character restriction', () => {
  it('accepts letters, numbers, dots, spaces, dash and underscore', () => {
    const result = validate(
      manifest({
        actions: [
          {
            id: 'my.action',
            name: 'Energy 2 Rating - v1.0_final',
            description: 'Uses every allowed character class.',
            config: { permissions: {} }
          }
        ]
      })
    )

    expect(result.ok, result.output).toBe(true)
  })

  it.each([
    ['a colon', 'Probe 1: Environment'],
    ['a slash', 'Syntax try/catch'],
    ['parentheses', 'Rename Playlists (fast)'],
    ['an ampersand', 'Drum & Bass Tagger'],
    ['an emoji', 'Tag Tracks 🚀']
  ])('rejects %s in an action name', (_label, name) => {
    const result = validate(
      manifest({
        actions: [
          {
            id: 'my.action',
            name: name,
            description: 'Action name contains a character Lexicon rejects.',
            config: { permissions: {} }
          }
        ]
      })
    )

    expect(result.ok, `expected "${name}" to be rejected`).toBe(false)
    expect(result.output).toContain('name must match pattern')
  })
})

describe('author contact requirement', () => {
  // Lexicon refuses to load a plugin whose author has neither field:
  //   invalid config: plugin property "author.discordUsername" or
  //   "author.email" is required
  // The official docs list both as optional, so this is easy to trip over.
  it('rejects an author with neither email nor discordUsername', () => {
    const result = validate(manifest({ author: { name: 'Nameless' } }))

    expect(result.ok).toBe(false)
    expect(result.output).toContain('author needs a contact route')
  })

  it('accepts an author with only an email', () => {
    const result = validate(manifest({ author: { name: 'A', email: 'a@example.com' } }))
    expect(result.ok, result.output).toBe(true)
  })

  it('accepts an author with only a discord username', () => {
    const result = validate(manifest({ author: { name: 'A', discordUsername: 'someone' } }))
    expect(result.ok, result.output).toBe(true)
  })
})

describe('manifest structure', () => {
  it('accepts a well-formed plugin', () => {
    const result = validate(manifest())
    expect(result.ok, result.output).toBe(true)
  })

  it('rejects an action with no matching js file', () => {
    const config = manifest()
    const base = mkdtempSync(join(tmpdir(), 'lexicon-validate-'))
    const dir = join(base, 'plugins', 'fixture-plugin')
    mkdirSync(join(dir, '__tests__'), { recursive: true })
    writeFileSync(join(dir, 'config.json'), JSON.stringify(config, null, 2))
    writeFileSync(join(dir, '__tests__', 'my.action.test.js'), '// test\n')

    let output = ''
    try {
      execFileSync('node', [SCRIPT], {
        cwd: ROOT,
        env: { ...process.env, PLUGINS_DIR: join(base, 'plugins') },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
      })
      throw new Error('expected validation to fail')
    } catch (err) {
      output = `${err.stdout ?? ''}${err.stderr ?? ''}`
    } finally {
      rmSync(base, { recursive: true, force: true })
    }

    expect(output).toContain('has no matching my.action.js')
  })

  it('rejects a js file not declared as an action', () => {
    const result = validate(manifest(), { 'stray.js': '_helpers.Report("x")\n' })

    expect(result.ok).toBe(false)
    expect(result.output).toContain('stray.js is not declared as an action')
  })

  it('rejects an unknown field in modifyFields', () => {
    const result = validate(
      manifest({
        actions: [
          {
            id: 'my.action',
            name: 'My Action',
            description: 'Requests a track field that does not exist.',
            config: {
              permissions: {
                track: { modify: ['selected'], modifyFields: ['notARealField'] }
              }
            }
          }
        ]
      })
    )

    expect(result.ok).toBe(false)
  })

  it('rejects modify without modifyFields', () => {
    const result = validate(
      manifest({
        actions: [
          {
            id: 'my.action',
            name: 'My Action',
            description: 'Asks to modify tracks without naming the fields.',
            config: {
              permissions: { track: { modify: ['selected'] } }
            }
          }
        ]
      })
    )

    expect(result.ok).toBe(false)
  })

  it('rejects wildcard network access', () => {
    const result = validate(
      manifest({
        actions: [
          {
            id: 'my.action',
            name: 'My Action',
            description: 'Asks for unrestricted outbound network access.',
            config: {
              permissions: { network: { GET: ['*'] } }
            }
          }
        ]
      })
    )

    expect(result.ok).toBe(false)
    expect(result.output).toContain('wildcard network access')
  })

  it('rejects an unknown permission key, which is usually a typo', () => {
    const result = validate(
      manifest({
        actions: [
          {
            id: 'my.action',
            name: 'My Action',
            description: 'Uses a permission key that does not exist.',
            config: { permissions: { tracks: { read: ['all'] } } }
          }
        ]
      })
    )

    expect(result.ok).toBe(false)
  })
})
