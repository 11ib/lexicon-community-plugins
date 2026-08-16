// Tests for the registry index that build-zips.mjs emits.
//
// The index is the contract between this repo and @lexicon-community/install:
// a wrong sha256 or a wrong zipUrl is an install failure on a user's machine,
// with no way to notice it here except a test that reads the bytes back.

import { describe, it, expect, beforeAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCRIPT = join(ROOT, 'scripts', 'build-zips.mjs')

function writePlugin(pluginsDir, folder, config, files = {}) {
  const dir = join(pluginsDir, folder)

  mkdirSync(join(dir, '__tests__'), { recursive: true })
  writeFileSync(join(dir, 'config.json'), JSON.stringify(config, null, 2))
  writeFileSync(join(dir, '__tests__', 'excluded.test.js'), '// not shipped\n')

  for (const action of config.actions) {
    writeFileSync(join(dir, `${action.id}.js`), '_helpers.Report("ok")\n')
  }

  for (const [name, contents] of Object.entries(files)) {
    writeFileSync(join(dir, name), contents)
  }
}

function build(pluginsDir, env = {}) {
  const distDir = mkdtempSync(join(tmpdir(), 'lexicon-dist-'))

  execFileSync('node', [SCRIPT], {
    env: { ...process.env, PLUGINS_DIR: pluginsDir, DIST_DIR: distDir, ...env },
    encoding: 'utf8'
  })

  return { distDir: distDir, index: JSON.parse(readFileSync(join(distDir, 'index.json'), 'utf8')) }
}

const action = (overrides = {}) => ({
  id: 'demo.action',
  name: 'Demo Action',
  description: 'Does a demonstrable thing to the selected tracks.',
  config: {
    permissions: { track: { read: ['selected'], modify: ['selected'], modifyFields: ['rating'] } }
  },
  ...overrides
})

describe('index.json', () => {
  let built
  let entry

  beforeAll(() => {
    const pluginsDir = mkdtempSync(join(tmpdir(), 'lexicon-plugins-'))

    writePlugin(pluginsDir, 'demo', {
      id: 'tester.demo',
      version: '1.2.3',
      keywords: ['demo', 'example'],
      author: { name: 'Tester', email: 'tester@example.com' },
      actions: [
        action(),
        action({
          id: 'other.action',
          name: 'Other Action',
          description: 'Renames every playlist and calls an API about it.',
          config: {
            permissions: {
              playlist: { read: ['all'], modify: ['all'], modifyFields: ['name'] },
              network: { GET: ['api.example.com'] },
              storage: true
            }
          }
        })
      ]
    })

    built = build(pluginsDir)
    entry = built.index.plugins[0]
  })

  it('carries what an installer needs', () => {
    expect(built.index.schemaVersion).toBe(1)
    expect(entry).toMatchObject({
      id: 'tester.demo',
      folder: 'demo',
      version: '1.2.3',
      keywords: ['demo', 'example'],
      zipName: 'demo.zip'
    })
    expect(entry.actions.map((a) => a.id)).toEqual(['demo.action', 'other.action'])
  })

  it('records the sha256 and size of the ZIP it just wrote', () => {
    const bytes = readFileSync(join(built.distDir, 'demo.zip'))

    expect(entry.sha256).toBe(createHash('sha256').update(bytes).digest('hex'))
    expect(entry.size).toBe(bytes.length)
  })

  it('summarises permissions across every action, so the ask is visible before install', () => {
    expect(entry.permissions).toEqual([
      'track: read selected, modify selected (rating)',
      'playlist: read all, modify all (name)',
      'network GET: api.example.com',
      'storage'
    ])
  })

  it('points zipUrl at the latest release by default, and at the tag when ZIP_BASE_URL is set', () => {
    expect(entry.zipUrl).toBe(
      'https://github.com/11ib/lexicon-community-plugins/releases/latest/download/demo.zip'
    )

    const pluginsDir = mkdtempSync(join(tmpdir(), 'lexicon-plugins-'))

    writePlugin(pluginsDir, 'demo', {
      id: 'tester.demo',
      version: '1.2.3',
      author: { name: 'Tester', email: 'tester@example.com' },
      actions: [action()]
    })

    const pinned = build(pluginsDir, { ZIP_BASE_URL: 'https://example.com/releases/download/v9.9.9/' })

    expect(pinned.index.plugins[0].zipUrl).toBe('https://example.com/releases/download/v9.9.9/demo.zip')
  })

  it('reports a missing version as null rather than inventing one', () => {
    const pluginsDir = mkdtempSync(join(tmpdir(), 'lexicon-plugins-'))

    writePlugin(pluginsDir, 'unversioned', {
      id: 'tester.unversioned',
      author: { name: 'Tester', email: 'tester@example.com' },
      actions: [action()]
    })

    const { index } = build(pluginsDir)

    expect(index.plugins[0].version).toBeNull()
    expect(index.plugins[0].keywords).toEqual([])
  })

  it('excludes __tests__ from the ZIP the index describes', () => {
    expect(existsSync(join(built.distDir, 'demo.zip'))).toBe(true)

    const bytes = readFileSync(join(built.distDir, 'demo.zip'))

    expect(bytes.includes(Buffer.from('excluded.test.js'))).toBe(false)
    expect(bytes.includes(Buffer.from('config.json'))).toBe(true)
  })
})
