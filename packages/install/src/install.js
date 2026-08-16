// Decide what to do about one plugin, then do it.
//
// The install itself is download → verify sha256 → extract to a temp folder
// inside Plugins/ → swap. Nothing lands in the plugin's real folder until a
// complete, checked, sanity-tested copy exists next to it, because a
// half-written plugin folder is one Lexicon will try to load.

import { mkdir, mkdtemp, rm, rename, readFile } from 'node:fs/promises'
import { join, dirname, basename } from 'node:path'
import { downloadZip } from './download.js'
import { extractZip } from './extract.js'
import { TEMP_PREFIX } from './installed.js'
import { compareVersions } from './versions.js'
import { CliError } from './errors.js'

const show = (version) => version ?? 'unknown version'

// `install` is an explicit request, so it reinstalls when it cannot tell
// whether the copy on disk is current. `update` is a sweep, so the same
// uncertainty means "leave it alone and say why".
export function planInstall(entry, existing, options = {}) {
  const force = options.force === true

  if (!existing) {
    return { action: 'install', reason: `installing ${show(entry.version)}` }
  }

  if (force) {
    return { action: 'reinstall', reason: `reinstalling ${show(entry.version)} (--force)` }
  }

  const cmp = compareVersions(existing.version, entry.version)

  if (cmp === null) {
    return { action: 'reinstall', reason: `reinstalling ${show(entry.version)} over ${show(existing.version)}` }
  }

  if (cmp === 0) {
    return { action: 'skip', reason: `already at ${entry.version}` }
  }

  if (cmp > 0) {
    return {
      action: 'skip',
      reason: `installed ${existing.version} is newer than ${entry.version} in the index — pass --force to downgrade`
    }
  }

  return { action: 'update', reason: `${existing.version} → ${entry.version}` }
}

export function planUpdate(entry, existing, options = {}) {
  const force = options.force === true

  if (!existing) {
    return { action: 'skip', reason: 'not installed' }
  }

  if (force) {
    return { action: 'update', reason: `reinstalling ${show(entry.version)} (--force)` }
  }

  const cmp = compareVersions(existing.version, entry.version)

  if (cmp === null) {
    const which = existing.version ? `version "${existing.version}"` : 'no version'
    return { action: 'skip', reason: `${which} on disk — cannot tell if it is current, reinstall with --force` }
  }

  if (cmp < 0) {
    return { action: 'update', reason: `${existing.version} → ${entry.version}` }
  }

  return { action: 'skip', reason: `up to date (${existing.version})` }
}

async function swap(stagingDir, targetDir) {
  // Dot-prefixed and inside Plugins/, so a crash between the two renames
  // leaves something Lexicon ignores and scanInstalled skips, on the same
  // filesystem as the target (rename across devices would fail).
  const trashDir = join(dirname(targetDir), `${TEMP_PREFIX}old-${basename(targetDir)}`)

  await rm(trashDir, { recursive: true, force: true })

  let displaced = false

  try {
    await rename(targetDir, trashDir)
    displaced = true
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err
    }
  }

  try {
    await rename(stagingDir, targetDir)
  } catch (err) {
    if (displaced) {
      await rename(trashDir, targetDir)
    }

    throw err
  }

  await rm(trashDir, { recursive: true, force: true })
}

// Runs the actual install for a resolved index entry. `existing` is the
// scanned record for the same plugin id, or null.
export async function performInstall(entry, options) {
  const pluginsDir = options.pluginsDir
  const targetDir = join(pluginsDir, entry.folder)

  await mkdir(pluginsDir, { recursive: true })

  const buffer = await downloadZip(entry.zipUrl, entry.sha256, options)
  const stagingDir = await mkdtemp(join(pluginsDir, TEMP_PREFIX))

  try {
    await extractZip(buffer, stagingDir)

    let config

    try {
      config = JSON.parse(await readFile(join(stagingDir, 'config.json'), 'utf8'))
    } catch (err) {
      throw new CliError(
        `${entry.id}: the archive has no readable config.json at its root — ${err.message}`,
        'the ZIP is not a Lexicon plugin, or was built wrong'
      )
    }

    if (config.id !== entry.id) {
      throw new CliError(`${entry.id}: the archive contains plugin "${config.id}" instead — nothing was installed`)
    }

    await swap(stagingDir, targetDir)
  } finally {
    await rm(stagingDir, { recursive: true, force: true })
  }

  // A plugin installed by hand under a different folder name would leave a
  // second copy of the same id behind, and Lexicon loads every folder.
  if (options.existing && options.existing.folder !== entry.folder) {
    await rm(options.existing.path, { recursive: true, force: true })
  }

  return { id: entry.id, folder: entry.folder, path: targetDir, version: entry.version ?? null }
}
