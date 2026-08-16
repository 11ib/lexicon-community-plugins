// Command line front end. main() returns an exit code instead of calling
// process.exit, so the tests drive the real commands in-process.

import { parseArgs } from 'node:util'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { CliError } from './errors.js'
import { DEFAULT_INDEX_URL, fetchIndex, resolveEntry } from './registry.js'
import { resolvePluginsDir, PLUGINS_DIR_ENV } from './paths.js'
import { scanInstalled, findInstalled } from './installed.js'
import { planInstall, planUpdate, performInstall } from './install.js'

const PKG_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')

const USAGE = `Install Lexicon DJ community plugins.

Usage
  lexicon-plugins install <plugin>...     install or update the named plugins
  lexicon-plugins install --all           install every plugin in the index
  lexicon-plugins update [<plugin>...]    update installed plugins
  lexicon-plugins list                    list the index and what is installed

Options
  --dir <path>     Plugins folder to install into
                   (default: Documents/Lexicon/Plugins, or $${PLUGINS_DIR_ENV})
  --index <url>    registry index to read
                   (default: the latest release's index.json)
  --force          reinstall even when the installed version looks current
  --json           machine-readable output
  -h, --help       this text
  -v, --version    print the CLI version

A plugin can be named by its full id, its folder, or the part after the last
dot, as long as that is unambiguous.`

const OPTIONS = {
  dir: { type: 'string' },
  index: { type: 'string' },
  force: { type: 'boolean', default: false },
  all: { type: 'boolean', default: false },
  json: { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h', default: false },
  version: { type: 'boolean', short: 'v', default: false }
}

const STATUS_WIDTH = 10

const PROGRESS = { install: 'fetching', reinstall: 'fetching', update: 'fetching' }

function line(status, id, detail) {
  return `${status.padEnd(STATUS_WIDTH)} ${id}${detail ? `  ${detail}` : ''}`
}

async function cliVersion() {
  const pkg = JSON.parse(await readFile(join(PKG_DIR, 'package.json'), 'utf8'))

  return pkg.version
}

// install and update differ only in how they decide, so they share this.
async function runInstalls(targets, context) {
  const { out, json, pluginsDir } = context
  const results = []

  for (const { entry, existing, plan } of targets) {
    if (plan.action === 'skip') {
      results.push({ id: entry.id, action: 'skipped', reason: plan.reason, version: entry.version ?? null })

      if (!json) {
        out(line('skipped', entry.id, plan.reason))
      }

      continue
    }

    if (!json) {
      out(line(PROGRESS[plan.action], entry.id, plan.reason))

      // Never silently install bytes from somewhere other than the index says.
      if (entry.localZip) {
        out(`${' '.repeat(STATUS_WIDTH + 1)}  from ${entry.zipUrl} (next to the index, not the release URL)`)
      }

      for (const permission of entry.permissions ?? []) {
        out(`${' '.repeat(STATUS_WIDTH + 1)}  permissions: ${permission}`)
      }
    }

    try {
      const installed = await performInstall(entry, { ...context, pluginsDir: pluginsDir, existing: existing })

      results.push({
        id: entry.id,
        action: plan.action === 'update' ? 'updated' : 'installed',
        version: installed.version,
        path: installed.path
      })

      if (!json) {
        out(line(plan.action === 'update' ? 'updated' : 'installed', entry.id, installed.path))
      }
    } catch (err) {
      if (!(err instanceof CliError)) {
        throw err
      }

      results.push({ id: entry.id, action: 'failed', error: err.message, hint: err.hint })

      if (!json) {
        out(line('failed', entry.id, err.message))

        if (err.hint) {
          out(`${' '.repeat(STATUS_WIDTH + 1)}  ${err.hint}`)
        }
      }
    }
  }

  return results
}

async function commandInstall(names, context) {
  const { index, installed, force, all } = context

  if (!all && names.length === 0) {
    throw new CliError('install needs a plugin name, or --all', 'run `lexicon-plugins list` to see what is available')
  }

  const entries = all ? index.plugins : names.map((name) => resolveEntry(index, name))
  const seen = new Set()
  const targets = []

  for (const entry of entries) {
    if (seen.has(entry.id)) {
      continue
    }

    seen.add(entry.id)

    const existing = findInstalled(installed, entry.id)

    targets.push({ entry: entry, existing: existing, plan: planInstall(entry, existing, { force: force }) })
  }

  return runInstalls(targets, context)
}

async function commandUpdate(names, context) {
  const { index, installed, force } = context

  const entries = names.length > 0 ? names.map((name) => resolveEntry(index, name)) : index.plugins
  const targets = []

  for (const entry of entries) {
    const existing = findInstalled(installed, entry.id)

    // An `update` with no arguments sweeps the index; plugins that are simply
    // not installed are not worth a line of output.
    if (!existing && names.length === 0) {
      continue
    }

    targets.push({ entry: entry, existing: existing, plan: planUpdate(entry, existing, { force: force }) })
  }

  if (targets.length === 0 && !context.json) {
    context.out('Nothing to update — no plugins from this index are installed.')
  }

  return runInstalls(targets, context)
}

function commandList(context) {
  const { index, installed, out, json } = context
  const results = []

  for (const entry of index.plugins) {
    const existing = findInstalled(installed, entry.id)

    results.push({
      id: entry.id,
      version: entry.version ?? null,
      installed: existing ? existing.version ?? 'unknown' : null,
      description: entry.description ?? '',
      permissions: entry.permissions ?? []
    })
  }

  if (!json) {
    if (results.length === 0) {
      out('The index has no plugins.')
    }

    for (const result of results) {
      const state = result.installed === null ? '-' : `installed ${result.installed}`

      out(`${result.id}  ${result.version ?? 'unversioned'}  ${state}`)

      if (result.description) {
        out(`  ${result.description}`)
      }
    }

    const strays = installed.filter((record) => record.id && !index.plugins.some((entry) => entry.id === record.id))

    for (const stray of strays) {
      out(`${stray.id}  -  installed ${stray.version ?? 'unknown'} (not in this index)`)
    }
  }

  return results
}

export async function main(argv, io = {}) {
  const out = io.out ?? ((text) => console.log(text))
  const err = io.err ?? ((text) => console.error(text))

  let parsed

  try {
    parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true })
  } catch (parseError) {
    err(parseError.message)
    err('')
    err(USAGE)

    return 2
  }

  const { values, positionals } = parsed
  const [command, ...names] = positionals

  if (values.version) {
    out(await cliVersion())

    return 0
  }

  if (values.help || command === 'help') {
    out(USAGE)

    return 0
  }

  if (!command) {
    err(USAGE)

    return 2
  }

  if (!['install', 'update', 'list'].includes(command)) {
    err(`unknown command "${command}"`)
    err('')
    err(USAGE)

    return 2
  }

  try {
    const pluginsDir = resolvePluginsDir(values.dir, io)
    const source = values.index || io.defaultIndex || DEFAULT_INDEX_URL
    const index = await fetchIndex(source, io)
    const installed = await scanInstalled(pluginsDir)

    const context = {
      index: index,
      installed: installed,
      pluginsDir: pluginsDir,
      force: values.force,
      all: values.all,
      json: values.json,
      out: out,
      fetch: io.fetch
    }

    let results

    if (command === 'install') {
      results = await commandInstall(names, context)
    } else if (command === 'update') {
      results = await commandUpdate(names, context)
    } else {
      results = commandList(context)
    }

    if (values.json) {
      out(JSON.stringify({ command: command, pluginsDir: pluginsDir, index: source, results: results }, null, 2))
    }

    return results.some((result) => result.action === 'failed') ? 1 : 0
  } catch (error) {
    if (!(error instanceof CliError)) {
      throw error
    }

    err(`error  ${error.message}`)

    if (error.hint) {
      err(`       ${error.hint}`)
    }

    return 1
  }
}
