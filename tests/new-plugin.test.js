// Tests for the scaffold.
//
// Its entire promise is that a freshly scaffolded plugin passes the gates
// before anyone writes a line of logic — so the tests run the real gate
// scripts against the real generated output, not a snapshot of it.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCRIPT = join(ROOT, 'scripts', 'new-plugin.mjs')

let pluginsDir

function scaffold(args) {
  const result = spawnSync('node', [SCRIPT, ...args], {
    cwd: ROOT,
    env: { ...process.env, PLUGINS_DIR: pluginsDir },
    encoding: 'utf8'
  })

  return { code: result.status, output: `${result.stdout}${result.stderr}` }
}

function gate(script) {
  const result = spawnSync('node', [join(ROOT, 'scripts', script)], {
    cwd: ROOT,
    env: { ...process.env, PLUGINS_DIR: pluginsDir },
    encoding: 'utf8'
  })

  return { code: result.status, output: `${result.stdout}${result.stderr}` }
}

const configOf = (folder) => JSON.parse(readFileSync(join(pluginsDir, folder, 'config.json'), 'utf8'))

beforeEach(() => {
  pluginsDir = mkdtempSync(join(tmpdir(), 'lexicon-scaffold-'))
})

afterEach(() => {
  rmSync(pluginsDir, { recursive: true, force: true })
})

describe('new:plugin', () => {
  it('creates a manifest, an action and a test', () => {
    expect(scaffold(['color-by-energy']).code).toBe(0)

    expect(existsSync(join(pluginsDir, 'color-by-energy', 'config.json'))).toBe(true)
    expect(existsSync(join(pluginsDir, 'color-by-energy', 'color.by.energy.js'))).toBe(true)
    expect(existsSync(join(pluginsDir, 'color-by-energy', '__tests__', 'color.by.energy.test.js'))).toBe(true)
  })

  it('scaffolds a versioned manifest, since an unversioned plugin cannot be updated', () => {
    scaffold(['color-by-energy'])

    expect(configOf('color-by-energy')).toMatchObject({
      id: 'alt9.color-by-energy',
      version: '1.0.0',
      actions: [{ id: 'color.by.energy', name: 'Color By Energy' }]
    })
  })

  it('passes the manifest and permission gates as generated', () => {
    scaffold(['color-by-energy'])

    const validate = gate('validate-configs.mjs')
    const permissions = gate('check-permissions.mjs')

    expect(validate.code, validate.output).toBe(0)
    expect(permissions.code, permissions.output).toBe(0)
    // Not just exit 0 — a warning here would train contributors to ignore them.
    expect(permissions.output).toMatch(/0 error\(s\), 0 warning\(s\)/)
  })

  it('scaffolds one action file and test per --actions entry', () => {
    scaffold(['multi-thing', '--actions', 'tag.tracks,rename.playlists'])

    expect(configOf('multi-thing').actions.map((a) => a.id)).toEqual(['tag.tracks', 'rename.playlists'])
    expect(existsSync(join(pluginsDir, 'multi-thing', 'tag.tracks.js'))).toBe(true)
    expect(existsSync(join(pluginsDir, 'multi-thing', '__tests__', 'rename.playlists.test.js'))).toBe(true)
    expect(gate('validate-configs.mjs').code).toBe(0)
  })

  it('takes an author and contact route', () => {
    scaffold(['branded', '--author', 'Someone', '--email', 'someone@example.com'])

    expect(configOf('branded')).toMatchObject({
      id: 'someone.branded',
      author: { name: 'Someone', email: 'someone@example.com' }
    })
  })

  it('refuses a folder name that is not lowercase-and-dashes', () => {
    const result = scaffold(['My Plugin'])

    expect(result.code).toBe(1)
    expect(result.output).toMatch(/lowercase letters, numbers and dashes/)
  })

  it('refuses to overwrite an existing plugin', () => {
    scaffold(['color-by-energy'])

    const second = scaffold(['color-by-energy'])

    expect(second.code).toBe(1)
    expect(second.output).toMatch(/already exists/)
  })

  it('needs a folder name', () => {
    expect(scaffold([]).code).toBe(2)
  })
})
