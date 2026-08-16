#!/usr/bin/env node
// Builds one installable ZIP per plugin into dist/, plus dist/index.json.
//
// Lexicon expects config.json at the root of the ZIP, so a monorepo cannot be
// installed by pointing users at "Download ZIP" on the repo. Each plugin gets
// its own archive, published as a release asset.
//
// Test folders are excluded — users should not ship __tests__ into their
// Lexicon Plugins directory.
//
// index.json is the registry: one entry per plugin with everything an
// installer or a search page needs, including the sha256 of the ZIP this run
// just wrote. @lexicon-plugins/install consumes it.
//
// Env overrides (used by tests and by release.yml):
//   PLUGINS_DIR   source tree            default <root>/plugins
//   DIST_DIR      output tree            default <root>/dist
//   ZIP_BASE_URL  prefix for zipUrl      default the latest release download

import { readdirSync, readFileSync, existsSync, statSync, mkdirSync, createWriteStream, rmSync, writeFileSync } from 'node:fs'
import { join, dirname, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import yazl from 'yazl'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function fromEnv(name, fallback) {
  const value = process.env[name]

  if (!value) {
    return fallback
  }

  return isAbsolute(value) ? value : join(ROOT, value)
}

const PLUGINS_DIR = fromEnv('PLUGINS_DIR', join(ROOT, 'plugins'))
const DIST_DIR = fromEnv('DIST_DIR', join(ROOT, 'dist'))

const REPOSITORY = 'https://github.com/11ib/lexicon-community-plugins'
// Release builds pin this to the tag being released, so the sha256 in the
// index always matches the exact asset the URL resolves to. A local build has
// no tag, so it points at whatever the latest release is.
const ZIP_BASE_URL = (process.env.ZIP_BASE_URL || `${REPOSITORY}/releases/latest/download`).replace(/\/+$/, '')

const EXCLUDED_DIRS = new Set(['__tests__', 'node_modules', '.git'])

const ENTITY_PERMISSIONS = ['track', 'playlist', 'customTag']

function collectFiles(dir, base = '') {
  const found = []

  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.')) {
      continue
    }

    const full = join(dir, entry)
    const relative = base ? `${base}/${entry}` : entry

    if (statSync(full).isDirectory()) {
      if (EXCLUDED_DIRS.has(entry)) {
        continue
      }

      found.push(...collectFiles(full, relative))
      continue
    }

    found.push({ absolute: full, relative: relative })
  }

  return found
}

// Flattens the per-action permission objects into short lines a user can read
// before installing. Union across actions: the index describes what the plugin
// as a whole can reach, which is what matters at install time.
function summarizePermissions(actions) {
  const entities = new Map()
  const network = { GET: new Set(), POST: new Set() }
  const files = new Set()
  const flags = new Set()

  for (const action of actions) {
    const perms = action.config?.permissions ?? {}

    for (const name of ENTITY_PERMISSIONS) {
      const granted = perms[name]

      if (!granted) {
        continue
      }

      if (!entities.has(name)) {
        entities.set(name, { read: new Set(), modify: new Set(), fields: new Set(), create: false, delete: false })
      }

      const acc = entities.get(name)

      for (const scope of granted.read ?? []) {
        acc.read.add(scope)
      }
      for (const scope of granted.modify ?? []) {
        acc.modify.add(scope)
      }
      for (const field of granted.modifyFields ?? []) {
        acc.fields.add(field)
      }

      acc.create = acc.create || granted.create === true
      acc.delete = acc.delete || granted.delete === true
    }

    for (const method of ['GET', 'POST']) {
      for (const domain of perms.network?.[method] ?? []) {
        network[method].add(domain)
      }
    }

    for (const mode of ['read', 'write', 'list']) {
      if (perms.files?.[mode] === true) {
        files.add(mode)
      }
    }

    for (const flag of ['control', 'storage', 'silent']) {
      if (perms[flag] === true) {
        flags.add(flag)
      }
    }
  }

  const sorted = (set) => [...set].sort()
  const lines = []

  for (const name of ENTITY_PERMISSIONS) {
    const acc = entities.get(name)

    if (!acc) {
      continue
    }

    const parts = []

    if (acc.read.size > 0) {
      parts.push(`read ${sorted(acc.read).join('+')}`)
    }
    if (acc.modify.size > 0) {
      const fields = acc.fields.size > 0 ? ` (${sorted(acc.fields).join(', ')})` : ''
      parts.push(`modify ${sorted(acc.modify).join('+')}${fields}`)
    }
    if (acc.create) {
      parts.push('create')
    }
    if (acc.delete) {
      parts.push('delete')
    }

    if (parts.length > 0) {
      lines.push(`${name}: ${parts.join(', ')}`)
    }
  }

  for (const method of ['GET', 'POST']) {
    if (network[method].size > 0) {
      lines.push(`network ${method}: ${sorted(network[method]).join(', ')}`)
    }
  }

  if (files.size > 0) {
    lines.push(`files: ${sorted(files).join(', ')}`)
  }

  for (const flag of sorted(flags)) {
    lines.push(flag)
  }

  return lines
}

function zipPlugin(folder) {
  return new Promise((resolve, reject) => {
    const dir = join(PLUGINS_DIR, folder)
    const config = JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8'))
    const files = collectFiles(dir)
    const zipName = `${folder}.zip`
    const outPath = join(DIST_DIR, zipName)

    const zip = new yazl.ZipFile()

    for (const file of files) {
      zip.addFile(file.absolute, file.relative)
    }

    const out = createWriteStream(outPath)
    zip.outputStream.pipe(out)

    out.on('close', () => {
      const bytes = readFileSync(outPath)

      resolve({
        folder: folder,
        zipName: zipName,
        path: outPath,
        fileCount: files.length,
        entry: {
          id: config.id,
          folder: folder,
          name: config.name ?? folder,
          // No plugin-level description exists in Lexicon's manifest, so fall
          // back to the first action's — better than an empty search index.
          description: config.description ?? config.actions[0]?.description ?? '',
          version: config.version ?? null,
          keywords: config.keywords ?? [],
          author: config.author,
          actions: config.actions.map((action) => ({
            id: action.id,
            name: action.name,
            description: action.description
          })),
          permissions: summarizePermissions(config.actions),
          zipUrl: `${ZIP_BASE_URL}/${zipName}`,
          zipName: zipName,
          size: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex')
        }
      })
    })
    out.on('error', reject)

    zip.end()
  })
}

if (existsSync(DIST_DIR)) {
  rmSync(DIST_DIR, { recursive: true })
}

mkdirSync(DIST_DIR, { recursive: true })

const folders = existsSync(PLUGINS_DIR)
  ? readdirSync(PLUGINS_DIR)
      .filter((n) => !n.startsWith('.'))
      .filter((n) => statSync(join(PLUGINS_DIR, n)).isDirectory())
      .filter((n) => existsSync(join(PLUGINS_DIR, n, 'config.json')))
      .sort()
  : []

const built = []

for (const folder of folders) {
  built.push(await zipPlugin(folder))
}

const index = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  repository: REPOSITORY,
  plugins: built.map((result) => result.entry)
}

writeFileSync(join(DIST_DIR, 'index.json'), `${JSON.stringify(index, null, 2)}\n`)

for (const result of built) {
  const entry = result.entry
  const version = entry.version ? ` v${entry.version}` : ''
  console.log(`${result.zipName}  (${entry.id}${version}, ${entry.actions.length} action(s), ${result.fileCount} file(s))`)
}

console.log(`\nBuilt ${built.length} plugin ZIP(s) and index.json into ${DIST_DIR}.`)
