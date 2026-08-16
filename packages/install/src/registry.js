// Reads dist/index.json, published as a release asset.
//
// The default URL is the *latest release* asset rather than a Pages URL: it
// needs no extra publishing step, and the zipUrls inside a released index are
// pinned to that release's tag, so the sha256 in the index always describes
// the exact bytes the URL serves.

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve, isAbsolute } from 'node:path'
import { CliError } from './errors.js'

export const DEFAULT_INDEX_URL =
  'https://github.com/11ib/lexicon-community-plugins/releases/latest/download/index.json'

const SUPPORTED_SCHEMA_VERSION = 1

function isHttp(source) {
  return /^https?:\/\//i.test(source)
}

async function readSource(source, fetchImpl) {
  if (!isHttp(source)) {
    const path = isAbsolute(source) ? source : resolve(source)

    try {
      return { text: await readFile(path, 'utf8'), dir: dirname(path) }
    } catch (err) {
      throw new CliError(`could not read index at ${path} — ${err.message}`)
    }
  }

  let response

  try {
    response = await fetchImpl(source, { headers: { accept: 'application/json' }, redirect: 'follow' })
  } catch (err) {
    throw new CliError(`could not reach the plugin index at ${source} — ${err.message}`, 'check your connection, or pass --index with a local index.json')
  }

  if (!response.ok) {
    const hint =
      response.status === 404
        ? 'no release has published an index.json yet — pass --index to point at one'
        : null

    throw new CliError(`plugin index request failed — ${response.status} ${response.statusText} for ${source}`, hint)
  }

  return { text: await response.text(), dir: null }
}

function validateEntry(entry, position) {
  const where = entry?.id ? `plugin "${entry.id}"` : `plugin at position ${position}`

  for (const field of ['id', 'folder', 'zipUrl', 'sha256']) {
    if (typeof entry?.[field] !== 'string' || entry[field].length === 0) {
      throw new CliError(`plugin index is malformed — ${where} has no "${field}"`)
    }
  }

  // The folder name becomes a directory under Plugins/, so it never gets to
  // contain a separator or a traversal segment.
  if (/[\\/]/.test(entry.folder) || entry.folder === '.' || entry.folder === '..') {
    throw new CliError(`plugin index is malformed — ${where} has an unusable folder name "${entry.folder}"`)
  }

  if (!/^[0-9a-f]{64}$/i.test(entry.sha256)) {
    throw new CliError(`plugin index is malformed — ${where} has an invalid sha256`)
  }
}

export async function fetchIndex(source, options = {}) {
  const fetchImpl = options.fetch ?? fetch
  const { text, dir } = await readSource(source, fetchImpl)

  let index

  try {
    index = JSON.parse(text)
  } catch (err) {
    throw new CliError(`plugin index at ${source} is not valid JSON — ${err.message}`)
  }

  if (!Array.isArray(index?.plugins)) {
    throw new CliError(`plugin index at ${source} is malformed — no "plugins" array`)
  }

  if (typeof index.schemaVersion === 'number' && index.schemaVersion > SUPPORTED_SCHEMA_VERSION) {
    throw new CliError(
      `plugin index is schema version ${index.schemaVersion}, this CLI understands ${SUPPORTED_SCHEMA_VERSION}`,
      'upgrade with: npm install -g @lexicon-community/install'
    )
  }

  index.plugins.forEach(validateEntry)

  // A local index (--index ./dist/index.json) is how you test a release before
  // publishing it. Its zipUrls point at a release that does not exist yet, so
  // prefer the ZIP sitting next to the file — and let a hand-written index use
  // relative paths.
  if (dir) {
    for (const entry of index.plugins) {
      if (!isHttp(entry.zipUrl)) {
        entry.zipUrl = resolve(dir, entry.zipUrl)
        entry.localZip = true
        continue
      }

      const sibling = resolve(dir, entry.zipName ?? `${entry.folder}.zip`)

      if (existsSync(sibling)) {
        entry.zipUrl = sibling
        entry.localZip = true
      }
    }
  }

  index.source = source

  return index
}

// Accepts the full id, the folder name, or the part after the last dot, as
// long as exactly one plugin matches.
export function resolveEntry(index, query) {
  const exact = index.plugins.find((entry) => entry.id === query)

  if (exact) {
    return exact
  }

  const lower = query.toLowerCase()
  const candidates = index.plugins.filter((entry) => {
    return (
      entry.id.toLowerCase() === lower ||
      entry.folder.toLowerCase() === lower ||
      entry.id.toLowerCase().split('.').pop() === lower
    )
  })

  if (candidates.length === 1) {
    return candidates[0]
  }

  if (candidates.length > 1) {
    throw new CliError(
      `"${query}" matches ${candidates.length} plugins`,
      `use the full id: ${candidates.map((entry) => entry.id).join(', ')}`
    )
  }

  const near = index.plugins
    .filter((entry) => entry.id.toLowerCase().includes(lower) || entry.folder.toLowerCase().includes(lower))
    .map((entry) => entry.id)

  throw new CliError(
    `no plugin named "${query}" in the index`,
    near.length > 0 ? `did you mean: ${near.join(', ')}` : 'run `lexicon-plugins list` to see what is available'
  )
}
