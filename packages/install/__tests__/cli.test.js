// End to end: a real HTTP registry, real ZIPs, a real Plugins folder in tmp.
// Only the location of the Plugins folder is faked, via --dir.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { main } from '../src/cli.js'
import { startRegistry, pluginConfig, pluginZip, makeZip, sha256, tempDir } from './helpers.js'

let registry
let pluginsDir
let scratch

async function run(argv, options = {}) {
  const out = []
  const err = []
  const args = [...argv]

  if (!argv.includes('--dir')) {
    args.push('--dir', options.dir ?? pluginsDir)
  }
  if (!argv.includes('--index')) {
    args.push('--index', options.index ?? registry.indexUrl)
  }

  const code = await main(args, {
    out: (text) => out.push(text),
    err: (text) => err.push(text),
    env: {}
  })

  return { code: code, out: out.join('\n'), err: err.join('\n') }
}

const installedConfig = (folder) => JSON.parse(readFileSync(join(pluginsDir, folder, 'config.json'), 'utf8'))

beforeEach(async () => {
  scratch = tempDir()
  pluginsDir = join(scratch, 'Plugins')

  registry = await startRegistry([
    { folder: 'demo', config: pluginConfig() },
    { folder: 'other', config: pluginConfig({ id: 'tester.other', version: '2.0.0' }) }
  ])
})

afterEach(async () => {
  await registry.close()
  rmSync(scratch, { recursive: true, force: true })
})

describe('install', () => {
  it('installs a plugin by id, verified against the index', async () => {
    const result = await run(['install', 'tester.demo'])

    expect(result.code).toBe(0)
    expect(result.out).toMatch(/installed\s+tester\.demo/)
    expect(installedConfig('demo').id).toBe('tester.demo')
    expect(existsSync(join(pluginsDir, 'demo', 'demo.action.js'))).toBe(true)
  })

  it('shows the permissions it is about to grant', async () => {
    const result = await run(['install', 'tester.demo'])

    expect(result.out).toMatch(/permissions: track: read selected/)
  })

  it('accepts the folder name or the part after the last dot', async () => {
    expect((await run(['install', 'demo'])).code).toBe(0)
    expect(installedConfig('demo').id).toBe('tester.demo')
  })

  it('installs everything with --all', async () => {
    const result = await run(['install', '--all'])

    expect(result.code).toBe(0)
    expect(readdirSync(pluginsDir).sort()).toEqual(['demo', 'other'])
  })

  it('skips a plugin that is already at the indexed version, and reinstalls with --force', async () => {
    await run(['install', 'tester.demo'])

    const second = await run(['install', 'tester.demo'])

    expect(second.out).toMatch(/skipped\s+tester\.demo\s+already at 1\.0\.0/)

    const forced = await run(['install', 'tester.demo', '--force'])

    expect(forced.out).toMatch(/installed\s+tester\.demo/)
  })

  it('reports an unknown plugin without touching the Plugins folder', async () => {
    const result = await run(['install', 'tester.nope'])

    expect(result.code).toBe(1)
    expect(result.err).toMatch(/no plugin named "tester\.nope"/)
    expect(existsSync(pluginsDir)).toBe(false)
  })

  it('suggests a near match', async () => {
    const result = await run(['install', 'dem'])

    expect(result.err).toMatch(/did you mean: tester\.demo/)
  })

  it('refuses a ZIP whose sha256 does not match the index, and installs nothing', async () => {
    registry.setZip('demo.zip', await pluginZip(pluginConfig({ id: 'tester.evil' })))

    const result = await run(['install', 'tester.demo'])

    expect(result.code).toBe(1)
    expect(result.out).toMatch(/checksum mismatch/)
    expect(existsSync(join(pluginsDir, 'demo'))).toBe(false)
  })

  it('refuses an archive with no config.json at its root', async () => {
    const buffer = await makeZip({ 'nested/config.json': '{}' })

    registry.setZip('demo.zip', buffer)
    registry.index.plugins[0].sha256 = sha256(buffer)

    const result = await run(['install', 'tester.demo'])

    expect(result.code).toBe(1)
    expect(result.out).toMatch(/no readable config\.json/)
    expect(existsSync(join(pluginsDir, 'demo'))).toBe(false)
  })

  it('refuses an archive whose config.json is a different plugin', async () => {
    const buffer = await pluginZip(pluginConfig({ id: 'tester.somethingelse' }))

    registry.setZip('demo.zip', buffer)
    registry.index.plugins[0].sha256 = sha256(buffer)

    const result = await run(['install', 'tester.demo'])

    expect(result.code).toBe(1)
    expect(result.out).toMatch(/contains plugin "tester\.somethingelse"/)
    expect(existsSync(join(pluginsDir, 'demo'))).toBe(false)
  })

  it('leaves the previous install in place when the new download fails', async () => {
    await run(['install', 'tester.demo'])

    registry.index.plugins[0].version = '1.1.0'
    registry.index.plugins[0].sha256 = 'f'.repeat(64)

    const result = await run(['install', 'tester.demo'])

    expect(result.code).toBe(1)
    expect(installedConfig('demo').version).toBe('1.0.0')
  })

  it('replaces a copy of the same plugin installed under a different folder name', async () => {
    const strayDir = join(pluginsDir, 'hand-dropped')

    mkdirSync(strayDir, { recursive: true })
    writeFileSync(join(strayDir, 'config.json'), JSON.stringify(pluginConfig({ version: '0.9.0' })))

    await run(['install', 'tester.demo'])

    expect(existsSync(strayDir)).toBe(false)
    expect(installedConfig('demo').version).toBe('1.0.0')
  })
})

describe('update', () => {
  it('updates an installed plugin when the index moves ahead', async () => {
    await run(['install', 'tester.demo'])

    const next = pluginConfig({ version: '1.1.0' })
    const buffer = await pluginZip(next)

    registry.setZip('demo.zip', buffer)
    registry.index.plugins[0].version = '1.1.0'
    registry.index.plugins[0].sha256 = sha256(buffer)

    const result = await run(['update'])

    expect(result.code).toBe(0)
    expect(result.out).toMatch(/updated\s+tester\.demo/)
    expect(installedConfig('demo').version).toBe('1.1.0')
  })

  it('says nothing is installed rather than installing anything', async () => {
    const result = await run(['update'])

    expect(result.code).toBe(0)
    expect(result.out).toMatch(/Nothing to update/)
    expect(existsSync(join(pluginsDir, 'demo'))).toBe(false)
  })

  it('leaves an up-to-date plugin alone', async () => {
    await run(['install', 'tester.demo'])

    const result = await run(['update'])

    expect(result.out).toMatch(/skipped\s+tester\.demo\s+up to date/)
  })

  it('will not guess about a plugin with no version on disk', async () => {
    const dir = join(pluginsDir, 'demo')

    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'config.json'), JSON.stringify(pluginConfig({ version: undefined })))

    const result = await run(['update'])

    expect(result.out).toMatch(/no version on disk/)
    expect(result.out).toMatch(/--force/)
    expect(installedConfig('demo').version).toBeUndefined()

    const forced = await run(['update', '--force'])

    expect(forced.out).toMatch(/updated\s+tester\.demo/)
    expect(installedConfig('demo').version).toBe('1.0.0')
  })
})

describe('list', () => {
  it('shows the index and what is installed', async () => {
    await run(['install', 'tester.demo'])

    const result = await run(['list'])

    expect(result.code).toBe(0)
    expect(result.out).toMatch(/tester\.demo\s+1\.0\.0\s+installed 1\.0\.0/)
    expect(result.out).toMatch(/tester\.other\s+2\.0\.0\s+-/)
  })

  it('mentions installed plugins that are not in the index', async () => {
    const dir = join(pluginsDir, 'local-thing')

    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'config.json'), JSON.stringify({ id: 'someone.local', version: '3.0.0' }))

    const result = await run(['list'])

    expect(result.out).toMatch(/someone\.local.*not in this index/)
  })

  it('emits machine-readable output with --json', async () => {
    await run(['install', 'tester.demo'])

    const result = await run(['list', '--json'])
    const parsed = JSON.parse(result.out)

    expect(parsed.command).toBe('list')
    expect(parsed.pluginsDir).toBe(pluginsDir)
    expect(parsed.results).toContainEqual(
      expect.objectContaining({ id: 'tester.demo', version: '1.0.0', installed: '1.0.0' })
    )
  })
})

describe('index sources', () => {
  it('reads a local index.json and resolves its zipUrls next to it', async () => {
    const dist = join(scratch, 'dist')
    const config = pluginConfig()
    const buffer = await pluginZip(config)

    mkdirSync(dist, { recursive: true })
    writeFileSync(join(dist, 'demo.zip'), buffer)
    writeFileSync(
      join(dist, 'index.json'),
      JSON.stringify({
        schemaVersion: 1,
        plugins: [
          {
            id: config.id,
            folder: 'demo',
            version: config.version,
            description: '',
            permissions: [],
            zipUrl: 'demo.zip',
            sha256: sha256(buffer)
          }
        ]
      })
    )

    const result = await run(['install', 'tester.demo'], { index: join(dist, 'index.json') })

    expect(result.code).toBe(0)
    expect(installedConfig('demo').id).toBe('tester.demo')
  })

  // dist/index.json is written before the release exists, so its zipUrls point
  // at a 404. Testing a build locally has to use the ZIP sitting next to it.
  it('prefers the ZIP next to a local index over the release URL in it', async () => {
    const dist = join(scratch, 'dist')
    const config = pluginConfig()
    const buffer = await pluginZip(config)

    mkdirSync(dist, { recursive: true })
    writeFileSync(join(dist, 'example.zip'), buffer)
    writeFileSync(
      join(dist, 'index.json'),
      JSON.stringify({
        schemaVersion: 1,
        plugins: [
          {
            id: config.id,
            folder: 'example',
            version: config.version,
            zipName: 'example.zip',
            zipUrl: 'https://github.com/11ib/lexicon-community-plugins/releases/latest/download/example.zip',
            sha256: sha256(buffer)
          }
        ]
      })
    )

    const result = await run(['install', 'tester.demo'], { index: join(dist, 'index.json') })

    expect(result.code).toBe(0)
    expect(installedConfig('example').id).toBe('tester.demo')
  })

  it('refuses an index from a newer schema version', async () => {
    registry.index.schemaVersion = 99

    const result = await run(['list'])

    expect(result.code).toBe(1)
    expect(result.err).toMatch(/schema version 99/)
  })

  it('reports a missing index instead of throwing', async () => {
    const result = await run(['list'], { index: `${registry.url}/nope.json` })

    expect(result.code).toBe(1)
    expect(result.err).toMatch(/404/)
  })
})

describe('argument handling', () => {
  it('prints usage for --help', async () => {
    const result = await run(['--help'])

    expect(result.code).toBe(0)
    expect(result.out).toMatch(/lexicon-plugins install/)
  })

  it('rejects an unknown command', async () => {
    const result = await run(['frobnicate'])

    expect(result.code).toBe(2)
    expect(result.err).toMatch(/unknown command "frobnicate"/)
  })

  it('rejects install with no plugin and no --all', async () => {
    const result = await run(['install'])

    expect(result.code).toBe(1)
    expect(result.err).toMatch(/install needs a plugin name/)
  })
})
