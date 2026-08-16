// Tests for the version-bump gate.
//
// The check is entirely about git history, so the fixtures are real git
// repositories rather than mocks — a temp repo with a plugin committed on
// main, then edited the way a contributor would edit it.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCRIPT = join(ROOT, 'scripts', 'check-versions.mjs')

let repo

function git(args) {
  const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8' })

  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`)
  }

  return result.stdout
}

function writePlugin(folder, config, action = '_helpers.Report("v1")\n') {
  const dir = join(repo, 'plugins', folder)

  mkdirSync(join(dir, '__tests__'), { recursive: true })
  writeFileSync(join(dir, 'config.json'), JSON.stringify(config, null, 2))
  writeFileSync(join(dir, 'demo.action.js'), action)
  writeFileSync(join(dir, '__tests__', 'demo.action.test.js'), '// test\n')
}

function config(overrides = {}) {
  return {
    id: 'tester.demo',
    version: '1.0.0',
    author: { name: 'Tester', email: 'tester@example.com' },
    actions: [
      {
        id: 'demo.action',
        name: 'Demo Action',
        description: 'Does a demonstrable thing to the selected tracks.',
        config: { permissions: {} }
      }
    ],
    ...overrides
  }
}

function check(extraArgs = []) {
  const result = spawnSync('node', [SCRIPT, '--repo', repo, '--base', 'main', ...extraArgs], {
    cwd: ROOT,
    encoding: 'utf8'
  })

  return { code: result.status, output: `${result.stdout}${result.stderr}` }
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'lexicon-versions-'))

  git(['init', '-b', 'main'])
  git(['config', 'user.email', 'test@example.com'])
  git(['config', 'user.name', 'Test'])

  writePlugin('demo', config())

  git(['add', '-A'])
  git(['commit', '-m', 'initial'])
})

afterEach(() => {
  rmSync(repo, { recursive: true, force: true })
})

describe('check-versions', () => {
  it('passes when nothing changed', () => {
    const result = check()

    expect(result.code).toBe(0)
    expect(result.output).toMatch(/No plugin changes/)
  })

  it('fails when a shipped file changed and the version did not', () => {
    writeFileSync(join(repo, 'plugins', 'demo', 'demo.action.js'), '_helpers.Report("v2")\n')

    const result = check()

    expect(result.code).toBe(1)
    expect(result.output).toMatch(/demo\.action\.js changed but version is still 1\.0\.0/)
  })

  it('passes when the version was bumped alongside the change', () => {
    writeFileSync(join(repo, 'plugins', 'demo', 'demo.action.js'), '_helpers.Report("v2")\n')
    writeFileSync(join(repo, 'plugins', 'demo', 'config.json'), JSON.stringify(config({ version: '1.0.1' }), null, 2))

    const result = check()

    expect(result.code).toBe(0)
    expect(result.output).toMatch(/Version check passed/)
  })

  // Tests are stripped from the ZIP, so changing one changes nothing a user
  // would receive.
  it('ignores changes under __tests__', () => {
    writeFileSync(join(repo, 'plugins', 'demo', '__tests__', 'demo.action.test.js'), '// more tests\n')

    const result = check()

    expect(result.code).toBe(0)
    expect(result.output).toMatch(/No plugin changes/)
  })

  it('detects changes committed on a branch, not just uncommitted ones', () => {
    git(['checkout', '-b', 'feature'])
    writeFileSync(join(repo, 'plugins', 'demo', 'demo.action.js'), '_helpers.Report("v2")\n')
    git(['add', '-A'])
    git(['commit', '-m', 'edit action'])

    const result = check()

    expect(result.code).toBe(1)
    expect(result.output).toMatch(/version is still 1\.0\.0/)
  })

  it('requires a version on a brand new plugin', () => {
    writePlugin('fresh', config({ id: 'tester.fresh', version: undefined }))

    const result = check()

    expect(result.code).toBe(1)
    expect(result.output).toMatch(/fresh: new plugin with no "version"/)
  })

  it('accepts a brand new plugin that has one', () => {
    writePlugin('fresh', config({ id: 'tester.fresh' }))

    const result = check()

    expect(result.code).toBe(0)
  })

  it('rejects a version that went backwards', () => {
    writeFileSync(join(repo, 'plugins', 'demo', 'demo.action.js'), '_helpers.Report("v2")\n')
    writeFileSync(join(repo, 'plugins', 'demo', 'config.json'), JSON.stringify(config({ version: '0.9.0' }), null, 2))

    const result = check()

    expect(result.code).toBe(1)
    expect(result.output).toMatch(/went backwards, 1\.0\.0 → 0\.9\.0/)
  })

  it('accepts adding a version to a plugin that never had one', () => {
    git(['checkout', '-b', 'feature'])
    writeFileSync(join(repo, 'plugins', 'demo', 'config.json'), JSON.stringify(config({ version: undefined }), null, 2))
    git(['add', '-A'])
    git(['commit', '-m', 'drop version'])
    git(['checkout', '-b', 'later'])

    writeFileSync(join(repo, 'plugins', 'demo', 'demo.action.js'), '_helpers.Report("v2")\n')
    writeFileSync(join(repo, 'plugins', 'demo', 'config.json'), JSON.stringify(config({ version: '1.0.1' }), null, 2))

    const result = spawnSync('node', [SCRIPT, '--repo', repo, '--base', 'feature'], { cwd: ROOT, encoding: 'utf8' })

    expect(result.status).toBe(0)
  })

  // Local clones are shallow, offline, or missing origin often enough that a
  // hard failure would just teach people to skip the gate.
  it('skips an unresolvable base ref, unless --strict', () => {
    const lenient = spawnSync('node', [SCRIPT, '--repo', repo, '--base', 'origin/nope'], {
      cwd: ROOT,
      encoding: 'utf8'
    })

    expect(lenient.status).toBe(0)
    expect(lenient.stdout).toMatch(/Skipped the version check/)

    const strict = spawnSync('node', [SCRIPT, '--repo', repo, '--base', 'origin/nope', '--strict'], {
      cwd: ROOT,
      encoding: 'utf8'
    })

    expect(strict.status).toBe(1)
    expect(strict.stderr).toMatch(/cannot check plugin versions/)
  })
})
