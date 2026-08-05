#!/usr/bin/env node
// Builds one installable ZIP per plugin into dist/.
//
// Lexicon expects config.json at the root of the ZIP, so a monorepo cannot be
// installed by pointing users at "Download ZIP" on the repo. Each plugin gets
// its own archive, published as a release asset.
//
// Test folders are excluded — users should not ship __tests__ into their
// Lexicon Plugins directory.

import { readdirSync, readFileSync, existsSync, statSync, mkdirSync, createWriteStream, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import yazl from 'yazl'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PLUGINS_DIR = join(ROOT, 'plugins')
const DIST_DIR = join(ROOT, 'dist')

const EXCLUDED_DIRS = new Set(['__tests__', 'node_modules', '.git'])

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

function zipPlugin(folder) {
  return new Promise((resolve, reject) => {
    const dir = join(PLUGINS_DIR, folder)
    const config = JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8'))
    const files = collectFiles(dir)
    const outPath = join(DIST_DIR, `${folder}.zip`)

    const zip = new yazl.ZipFile()

    for (const file of files) {
      zip.addFile(file.absolute, file.relative)
    }

    const out = createWriteStream(outPath)
    zip.outputStream.pipe(out)

    out.on('close', () => {
      resolve({ folder: folder, id: config.id, actions: config.actions.length, files: files.length, path: outPath })
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
  : []

const built = []

for (const folder of folders) {
  built.push(await zipPlugin(folder))
}

for (const result of built) {
  console.log(`${result.folder}.zip  (${result.id}, ${result.actions} action(s), ${result.files} file(s))`)
}

console.log(`\nBuilt ${built.length} plugin ZIP(s) into dist/.`)
