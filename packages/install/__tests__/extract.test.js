// Extraction is where a hostile archive would get its chance, so the tests
// build actually-hostile archives rather than asserting on the guard code.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { extractZip, safeEntryPath } from '../src/extract.js'
import { makeZip, makeZipWithRawName, tempDir } from './helpers.js'

describe('safeEntryPath', () => {
  it('normalises ordinary names', () => {
    expect(safeEntryPath('config.json')).toBe('config.json')
    expect(safeEntryPath('./nested/action.js')).toBe('nested/action.js')
  })

  it('rejects traversal, absolute paths, backslashes and null bytes', () => {
    for (const name of ['../evil.js', 'a/../../evil.js', '/etc/passwd', 'C:/Windows/evil.js', 'a\\b.js', 'a\0b']) {
      expect(() => safeEntryPath(name)).toThrow(/refusing to extract/)
    }
  })
})

describe('extractZip', () => {
  it('writes files and nested directories', async () => {
    const dir = tempDir()
    const zip = await makeZip({
      'config.json': '{"id":"tester.demo"}',
      'demo.action.js': 'x',
      'lib/helper.js': 'y'
    })

    const written = await extractZip(zip, dir)

    expect(written.sort()).toEqual(['config.json', 'demo.action.js', 'lib/helper.js'])
    expect(readFileSync(join(dir, 'lib/helper.js'), 'utf8')).toBe('y')

    rmSync(dir, { recursive: true, force: true })
  })

  it('refuses an entry that escapes the destination, and writes nothing outside it', async () => {
    const dir = tempDir()
    const outside = join(dir, '..', 'escaped.js')
    const zip = await makeZipWithRawName('aa/escaped.js', '../escaped.js')

    // yauzl rejects a traversal name itself, before safeEntryPath ever sees
    // it, so either message is a pass — what matters is that it throws and
    // nothing lands outside the destination.
    await expect(extractZip(zip, dir)).rejects.toThrow(/refusing to extract|invalid relative path/)
    expect(existsSync(outside)).toBe(false)

    rmSync(dir, { recursive: true, force: true })
  })

  it('refuses an absolute entry name', async () => {
    const dir = tempDir()
    const zip = await makeZipWithRawName('aetc/passwd', '/etc/passwd')

    await expect(extractZip(zip, dir)).rejects.toThrow(/absolute path/)

    rmSync(dir, { recursive: true, force: true })
  })

  it('refuses a symlink entry', async () => {
    const dir = tempDir()
    // 0o120777: S_IFLNK plus permissions, which is how an archiver records a
    // symlink whose contents are the link target.
    const zip = await makeZip({}, [['link.js', '/etc/passwd', { mode: 0o120777 }]])

    await expect(extractZip(zip, dir)).rejects.toThrow(/symlinks are not allowed/)

    rmSync(dir, { recursive: true, force: true })
  })

  it('rejects a buffer that is not a ZIP', async () => {
    const dir = tempDir()

    await expect(extractZip(Buffer.from('not a zip at all'), dir)).rejects.toThrow(/not a readable ZIP/)

    rmSync(dir, { recursive: true, force: true })
  })
})
