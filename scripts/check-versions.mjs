#!/usr/bin/env node
// Fails when a plugin's shipped files changed but its version did not.
//
// The registry index is keyed on version: an installed plugin only updates
// when the index carries a higher one. So an edited action with an unchanged
// version is worse than a broken build — it ships, silently, to nobody. Every
// existing install goes on believing it is current, forever.
//
// This is a diff question, not a registry question: what matters is whether
// the files that go into the ZIP changed since the base branch. __tests__ is
// excluded because it never ships.
//
//   node scripts/check-versions.mjs [--base <ref>] [--repo <dir>] [--strict]
//
// Without --strict, an unresolvable base ref (shallow clone, no origin) is a
// notice rather than a failure, so `npm run verify` still works offline.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compareVersions } from '../packages/install/src/versions.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)

function flagValue(name) {
  const at = args.indexOf(name)

  return at === -1 ? null : args[at + 1]
}

const strict = args.includes('--strict')
const repo = flagValue('--repo') ?? ROOT
const baseRef = flagValue('--base') ?? process.env.BASE_REF ?? 'origin/main'

function git(gitArgs) {
  return execFileSync('git', gitArgs, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function tryGit(gitArgs) {
  try {
    return git(gitArgs)
  } catch {
    return null
  }
}

function skip(reason) {
  if (strict) {
    console.error(`error    cannot check plugin versions — ${reason}`)
    process.exit(1)
  }

  console.log(`Skipped the version check — ${reason}.`)
  process.exit(0)
}

const resolved = tryGit(['rev-parse', '--verify', `${baseRef}^{commit}`])

if (!resolved) {
  skip(`no such ref "${baseRef}"`)
}

// Three-dot semantics by hand: compare against where this branch left the base,
// not against the base's current tip, so unrelated commits on main are not
// mistaken for changes here.
const base = tryGit(['merge-base', resolved, 'HEAD']) ?? resolved

// No HEAD argument, so uncommitted edits count too — a contributor should hear
// about this before committing, not after pushing. git diff does not see
// untracked files, which is exactly what a brand new plugin folder is, so they
// are collected separately.
const changed = [
  ...(tryGit(['diff', '--name-only', base, '--', 'plugins']) ?? '').split('\n'),
  ...(tryGit(['ls-files', '--others', '--exclude-standard', '--', 'plugins']) ?? '').split('\n')
].filter(Boolean)

// Only files that end up inside the ZIP. Tests and dotfiles are excluded.
function shipsInZip(path) {
  const parts = path.split('/')

  if (parts.length < 3 || parts[0] !== 'plugins') {
    return false
  }

  return !parts.includes('__tests__') && !parts.some((part) => part.startsWith('.'))
}

const folders = [...new Set(changed.filter(shipsInZip).map((path) => path.split('/')[1]))].sort()
const errors = []

for (const folder of folders) {
  const configPath = join(repo, 'plugins', folder, 'config.json')

  if (!existsSync(configPath)) {
    continue
  }

  let current

  try {
    current = JSON.parse(readFileSync(configPath, 'utf8'))
  } catch (err) {
    errors.push(`${folder}: config.json is not valid JSON — ${err.message}`)
    continue
  }

  const previousRaw = tryGit(['show', `${base}:plugins/${folder}/config.json`])

  if (!previousRaw) {
    // New plugin. Nothing to bump against, but it still needs a version to be
    // updatable later.
    if (!current.version) {
      errors.push(`${folder}: new plugin with no "version" in config.json — add one, e.g. "1.0.0"`)
    }

    continue
  }

  let previous

  try {
    previous = JSON.parse(previousRaw)
  } catch {
    continue
  }

  const touched = changed
    .filter(shipsInZip)
    .filter((path) => path.split('/')[1] === folder)
    .map((path) => path.split('/').slice(2).join('/'))

  if (!current.version) {
    errors.push(`${folder}: ${touched.join(', ')} changed and config.json has no "version" — add one, e.g. "1.0.0"`)
    continue
  }

  const order = compareVersions(previous.version, current.version)

  if (previous.version && order === null) {
    errors.push(`${folder}: version "${current.version}" is not comparable to "${previous.version}" — use MAJOR.MINOR.PATCH`)
    continue
  }

  if (order === 0) {
    errors.push(
      `${folder}: ${touched.join(', ')} changed but version is still ${current.version} — ` +
        'bump it in config.json, or installed copies will never see the change'
    )
    continue
  }

  if (order > 0) {
    errors.push(`${folder}: version went backwards, ${previous.version} → ${current.version}`)
  }
}

if (errors.length > 0) {
  console.error('')
  for (const line of errors) {
    console.error(`error    ${line}`)
  }
  console.error(`\n${errors.length} problem(s) found, comparing against ${baseRef}.`)
  process.exit(1)
}

if (folders.length === 0) {
  console.log(`No plugin changes against ${baseRef}.`)
} else {
  console.log(`Version check passed for ${folders.length} changed plugin(s): ${folders.join(', ')}.`)
}
