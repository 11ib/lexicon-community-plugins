// Where Lexicon looks for plugins.
//
// The app reads Documents/Lexicon/Plugins and nothing else — there is no
// setting for it — so the only real variation is the home directory.

import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

export const PLUGINS_DIR_ENV = 'LEXICON_PLUGINS_DIR'

export function defaultPluginsDir(options = {}) {
  const platform = options.platform ?? process.platform
  const env = options.env ?? process.env
  const home = options.home ?? homedir()

  // USERPROFILE is what the roadmap documents, and it is what Explorer shows
  // as "Documents". Redirected/OneDrive Documents folders are not detected —
  // that is what --dir is for.
  const base = platform === 'win32' ? env.USERPROFILE || home : home

  return join(base, 'Documents', 'Lexicon', 'Plugins')
}

// Precedence: --dir, then LEXICON_PLUGINS_DIR, then the platform default.
export function resolvePluginsDir(flagDir, options = {}) {
  const env = options.env ?? process.env
  const chosen = flagDir || env[PLUGINS_DIR_ENV]

  if (chosen) {
    return resolve(chosen)
  }

  return defaultPluginsDir(options)
}
