#!/usr/bin/env node
// Validates every plugin manifest in plugins/ and the files around it.
//
//   - config.json matches schema/plugin.config.schema.json
//   - every action id has a matching <id>.js next to config.json
//   - every .js file next to config.json is claimed by an action
//   - every action has at least one test in __tests__/
//   - plugin ids and folder names are unique
//
// Exits non-zero with a readable report if anything is wrong.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv from 'ajv'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// Overridable so the tooling tests can point at tests/fixtures/.
const PLUGINS_DIR = process.env.PLUGINS_DIR
  ? join(ROOT, process.env.PLUGINS_DIR)
  : join(ROOT, 'plugins')

const schema = JSON.parse(readFileSync(join(ROOT, 'schema/plugin.config.schema.json'), 'utf8'))
const ajv = new Ajv({ allErrors: true, strict: false })
const validate = ajv.compile(schema)

const errors = []
const warnings = []

function fail(plugin, message) {
  errors.push(`${plugin}: ${message}`)
}

function warn(plugin, message) {
  warnings.push(`${plugin}: ${message}`)
}

export function listPluginDirs() {
  if (!existsSync(PLUGINS_DIR)) {
    return []
  }

  return readdirSync(PLUGINS_DIR)
    .filter((name) => !name.startsWith('.'))
    .filter((name) => statSync(join(PLUGINS_DIR, name)).isDirectory())
}

const seenIds = new Map()

for (const folder of listPluginDirs()) {
  const dir = join(PLUGINS_DIR, folder)
  const configPath = join(dir, 'config.json')

  if (!existsSync(configPath)) {
    fail(folder, 'missing config.json')
    continue
  }

  let config
  try {
    config = JSON.parse(readFileSync(configPath, 'utf8'))
  } catch (err) {
    fail(folder, `config.json is not valid JSON — ${err.message}`)
    continue
  }

  if (!validate(config)) {
    for (const err of validate.errors) {
      const where = err.instancePath || '(root)'
      fail(folder, `config.json${where} ${err.message}`)
    }
    continue
  }

  if (seenIds.has(config.id)) {
    fail(folder, `plugin id "${config.id}" is already used by ${seenIds.get(config.id)}`)
  }
  seenIds.set(config.id, folder)

  const jsFiles = readdirSync(dir).filter((f) => f.endsWith('.js'))
  const actionIds = config.actions.map((a) => a.id)

  for (const action of config.actions) {
    const expected = `${action.id}.js`

    if (!jsFiles.includes(expected)) {
      fail(folder, `action "${action.id}" has no matching ${expected}`)
    }

    const testsDir = join(dir, '__tests__')
    const hasTest =
      existsSync(testsDir) &&
      readdirSync(testsDir).some((f) => f.startsWith(action.id) && f.endsWith('.test.js'))

    if (!hasTest) {
      fail(folder, `action "${action.id}" has no test — add __tests__/${action.id}.test.js`)
    }

    // A destructive action that runs without asking is a bad default for a
    // public repo, so nudge (not block) on it.
    const perms = action.config.permissions ?? {}
    const destructive =
      perms.track?.delete === true ||
      perms.playlist?.delete === true ||
      perms.customTag?.delete === true

    if (destructive && !action.config.confirmationMessage) {
      warn(folder, `action "${action.id}" can delete but has no confirmationMessage`)
    }

    if (perms.network?.GET?.includes('*') || perms.network?.POST?.includes('*')) {
      fail(folder, `action "${action.id}" requests wildcard network access — list explicit domains`)
    }
  }

  for (const file of jsFiles) {
    const id = file.replace(/\.js$/, '')

    if (!actionIds.includes(id)) {
      fail(folder, `${file} is not declared as an action in config.json`)
    }
  }
}

for (const line of warnings) {
  console.warn(`warning  ${line}`)
}

if (errors.length > 0) {
  console.error('')
  for (const line of errors) {
    console.error(`error    ${line}`)
  }
  console.error(`\n${errors.length} problem(s) found.`)
  process.exit(1)
}

console.log(`Validated ${seenIds.size} plugin(s), no problems found.`)
