import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import { defaultPluginsDir, resolvePluginsDir } from '../src/paths.js'

describe('defaultPluginsDir', () => {
  it('uses Documents/Lexicon/Plugins under the home directory on macOS', () => {
    expect(defaultPluginsDir({ platform: 'darwin', home: '/Users/dj', env: {} })).toBe(
      join('/Users/dj', 'Documents', 'Lexicon', 'Plugins')
    )
  })

  it('prefers USERPROFILE on Windows', () => {
    const dir = defaultPluginsDir({ platform: 'win32', home: 'C:\\ignored', env: { USERPROFILE: 'C:\\Users\\dj' } })

    expect(dir).toBe(join('C:\\Users\\dj', 'Documents', 'Lexicon', 'Plugins'))
  })

  it('falls back to the home directory when USERPROFILE is unset', () => {
    const dir = defaultPluginsDir({ platform: 'win32', home: 'C:\\Users\\dj', env: {} })

    expect(dir).toBe(join('C:\\Users\\dj', 'Documents', 'Lexicon', 'Plugins'))
  })
})

describe('resolvePluginsDir', () => {
  it('prefers the flag over the environment', () => {
    const dir = resolvePluginsDir('/tmp/flag', { env: { LEXICON_PLUGINS_DIR: '/tmp/env' }, home: '/Users/dj' })

    expect(dir).toBe('/tmp/flag')
  })

  it('falls back to LEXICON_PLUGINS_DIR', () => {
    const dir = resolvePluginsDir(undefined, { env: { LEXICON_PLUGINS_DIR: '/tmp/env' }, home: '/Users/dj' })

    expect(dir).toBe('/tmp/env')
  })

  it('falls back to the platform default', () => {
    const dir = resolvePluginsDir(undefined, { env: {}, platform: 'darwin', home: '/Users/dj' })

    expect(dir).toBe(join('/Users/dj', 'Documents', 'Lexicon', 'Plugins'))
  })
})
