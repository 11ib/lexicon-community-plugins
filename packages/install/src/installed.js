// What is already in the Plugins folder.
//
// The folder itself is the state: every install target has a config.json with
// an id and (since the registry) a version. Nothing is tracked in a sidecar
// file, so a plugin the user unzipped by hand is seen exactly like one this
// CLI installed, and deleting a folder is a complete uninstall.

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const TEMP_PREFIX = '.lexicon-install-'

export async function scanInstalled(pluginsDir) {
  let entries

  try {
    entries = await readdir(pluginsDir, { withFileTypes: true })
  } catch (err) {
    if (err.code === 'ENOENT') {
      return []
    }

    throw err
  }

  const found = []

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) {
      continue
    }

    const folder = entry.name
    const path = join(pluginsDir, folder)
    const record = { folder: folder, path: path, id: null, version: null, problem: null }

    try {
      const config = JSON.parse(await readFile(join(path, 'config.json'), 'utf8'))

      record.id = typeof config.id === 'string' ? config.id : null
      record.version = typeof config.version === 'string' ? config.version : null

      if (!record.id) {
        record.problem = 'config.json has no id'
      }
    } catch (err) {
      record.problem = err.code === 'ENOENT' ? 'no config.json' : `unreadable config.json — ${err.message}`
    }

    found.push(record)
  }

  return found
}

export function findInstalled(installed, id) {
  return installed.find((record) => record.id === id) ?? null
}
