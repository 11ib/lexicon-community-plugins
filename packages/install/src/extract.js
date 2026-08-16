// Unpacks a plugin ZIP into a directory.
//
// Lexicon plugin ZIPs are flat-ish trees with config.json at the root, but a
// ZIP is an archive from the internet either way, so entry names are checked
// rather than trusted: no absolute paths, no traversal out of the destination,
// no symlinks (a symlink entry is how an archive writes outside its own tree
// on the *next* extraction, and Lexicon would follow it).

import yauzl from 'yauzl'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, dirname, sep, resolve } from 'node:path'
import { CliError } from './errors.js'

const S_IFMT = 0o170000
const S_IFLNK = 0o120000
const MADE_BY_UNIX = 3

export const MAX_ENTRIES = 5000
export const MAX_TOTAL_BYTES = 200 * 1024 * 1024

// Returns the entry path relative to the destination, or throws. Exported for
// the tests — these rules are the security boundary of this package.
export function safeEntryPath(fileName) {
  const reject = (why) => {
    throw new CliError(`refusing to extract "${fileName}" — ${why}`)
  }

  if (fileName.includes('\\')) {
    reject('backslash in the entry name')
  }

  if (fileName.startsWith('/') || /^[A-Za-z]:/.test(fileName)) {
    reject('absolute path')
  }

  if (fileName.includes('\0')) {
    reject('null byte in the entry name')
  }

  const segments = fileName.split('/').filter((part) => part !== '' && part !== '.')

  if (segments.some((part) => part === '..')) {
    reject('path traversal')
  }

  if (segments.length === 0) {
    reject('empty entry name')
  }

  return segments.join('/')
}

function isSymlink(entry) {
  if (entry.versionMadeBy >> 8 !== MADE_BY_UNIX) {
    return false
  }

  return ((entry.externalFileAttributes >>> 16) & S_IFMT) === S_IFLNK
}

function openBuffer(buffer) {
  return new Promise((resolvePromise, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        reject(new CliError(`plugin archive is not a readable ZIP — ${err.message}`))
        return
      }

      resolvePromise(zipfile)
    })
  })
}

function readEntry(zipfile, entry) {
  return new Promise((resolvePromise, reject) => {
    zipfile.openReadStream(entry, (err, stream) => {
      if (err) {
        reject(new CliError(`could not read "${entry.fileName}" from the archive — ${err.message}`))
        return
      }

      const chunks = []

      stream.on('data', (chunk) => chunks.push(chunk))
      stream.on('error', reject)
      stream.on('end', () => resolvePromise(Buffer.concat(chunks)))
    })
  })
}

// Extracts into destDir, which must already exist. Returns the relative paths
// written, in archive order.
export async function extractZip(buffer, destDir) {
  const root = resolve(destDir)
  const zipfile = await openBuffer(buffer)
  const written = []

  let totalBytes = 0
  let entryCount = 0

  try {
    for (;;) {
      const entry = await nextEntry(zipfile)

      if (!entry) {
        break
      }

      entryCount += 1

      if (entryCount > MAX_ENTRIES) {
        throw new CliError(`plugin archive has more than ${MAX_ENTRIES} entries — refusing to extract`)
      }

      if (isSymlink(entry)) {
        throw new CliError(`refusing to extract "${entry.fileName}" — symlinks are not allowed in plugin archives`)
      }

      const relative = safeEntryPath(entry.fileName)
      const target = join(root, relative)

      // Belt and braces: safeEntryPath already rejects traversal, this catches
      // anything path semantics do that string checks did not anticipate.
      if (target !== root && !target.startsWith(root + sep)) {
        throw new CliError(`refusing to extract "${entry.fileName}" — resolves outside the plugin folder`)
      }

      if (entry.fileName.endsWith('/')) {
        await mkdir(target, { recursive: true })
        continue
      }

      totalBytes += entry.uncompressedSize

      if (totalBytes > MAX_TOTAL_BYTES) {
        throw new CliError(`plugin archive unpacks to more than ${MAX_TOTAL_BYTES} bytes — refusing to extract`)
      }

      const contents = await readEntry(zipfile, entry)

      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, contents, { mode: 0o644 })

      written.push(relative)
    }
  } finally {
    zipfile.close()
  }

  return written
}

function nextEntry(zipfile) {
  return new Promise((resolvePromise, reject) => {
    const onEntry = (entry) => {
      cleanup()
      resolvePromise(entry)
    }

    const onEnd = () => {
      cleanup()
      resolvePromise(null)
    }

    const onError = (err) => {
      cleanup()
      reject(new CliError(`plugin archive could not be read — ${err.message}`))
    }

    function cleanup() {
      zipfile.removeListener('entry', onEntry)
      zipfile.removeListener('end', onEnd)
      zipfile.removeListener('error', onError)
    }

    zipfile.once('entry', onEntry)
    zipfile.once('end', onEnd)
    zipfile.once('error', onError)

    zipfile.readEntry()
  })
}
