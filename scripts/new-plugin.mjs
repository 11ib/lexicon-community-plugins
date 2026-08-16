#!/usr/bin/env node
// Scaffolds a plugin folder that already passes every gate.
//
//   npm run new:plugin my-plugin
//   npm run new:plugin my-plugin --actions tag.tracks,rename.playlists
//
// The point is that `npm run verify` is green before a single line of real
// logic exists, so the first failure anyone sees is about their code and not
// about boilerplate they were never told to write.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// Overridable so the tooling tests can scaffold into a fixture tree, matching
// the other scripts.
const PLUGINS_DIR = process.env.PLUGINS_DIR
  ? (isAbsolute(process.env.PLUGINS_DIR) ? process.env.PLUGINS_DIR : join(ROOT, process.env.PLUGINS_DIR))
  : join(ROOT, 'plugins')

const args = process.argv.slice(2)

const folder = args.find((arg) => !arg.startsWith('--'))

function flagValue(name) {
  const at = args.indexOf(name)

  return at === -1 ? null : args[at + 1]
}

if (!folder) {
  console.error('usage: npm run new:plugin <folder-name> [--actions a.b,c.d] [--author "Name"] [--email you@example.com]')
  process.exit(2)
}

if (!/^[a-z0-9][a-z0-9-]*$/.test(folder)) {
  console.error(`error    "${folder}" — use lowercase letters, numbers and dashes`)
  process.exit(1)
}

const dir = join(PLUGINS_DIR, folder)

if (existsSync(dir)) {
  console.error(`error    ${folder} already exists in ${PLUGINS_DIR}`)
  process.exit(1)
}

const actionIds = (flagValue('--actions') ?? `${folder.replace(/-/g, '.')}`).split(',').map((id) => id.trim()).filter(Boolean)

// Lexicon rejects the whole plugin if an action name contains anything outside
// letters, numbers, dots, spaces, dash and underscore — so the generated name
// is built from the id rather than passed through.
function titleFrom(id) {
  return id
    .split(/[.\-_]/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ')
}

const author = flagValue('--author') ?? 'alt9'
const email = flagValue('--email') ?? '10055660+11ib@users.noreply.github.com'

const config = {
  id: `${author.toLowerCase().replace(/[^a-z0-9]+/g, '')}.${folder}`,
  version: '1.0.0',
  keywords: [],
  author: { name: author, email: email },
  actions: actionIds.map((id) => ({
    id: id,
    name: titleFrom(id),
    description: 'Say what this changes, in plain language, in at least ten characters.',
    config: {
      permissions: {
        track: {
          read: ['selected'],
          modify: ['selected'],
          modifyFields: ['comment']
        }
      }
    }
  }))
}

const actionSource = (id) => `// ${titleFrom(id)}
//
// Action files are not modules: this is a bare script body Lexicon runs as an
// async function. No import, no export, no require. Tracks are mutated in
// place — there is no save call.
//
// See docs/SANDBOX.md for the syntax the parser rejects. The ones that catch
// people out: optional chaining, nullish coalescing, destructuring, try/catch,
// and brace-less if bodies.

const tracks = _vars.tracksSelected

if (tracks.length === 0) {
  _helpers.Report('No tracks selected')
} else {
  let updated = 0

  // Iterate the collection directly rather than through the local alias:
  // check-permissions follows \`for (const x of _vars.tracksSelected)\` when it
  // decides whether modifyFields is honest.
  for (const track of _vars.tracksSelected) {
    // Replace this with what the action actually does. Every field assigned
    // here must appear in modifyFields in config.json — Lexicon accepts an
    // undeclared write in memory and silently discards it on save.
    track.comment = 'touched'
    updated += 1

    _ui.progress(updated / tracks.length)
  }

  _helpers.Report('Updated ' + updated + ' track(s)')
}
`

const testSource = (id) => `import { describe, it, expect } from 'vitest'
import { runAction } from '@lexicon-plugins/harness'

const PLUGIN = 'plugins/${folder}'

describe('${id}', () => {
  it('updates the selected tracks', async () => {
    const run = await runAction({
      plugin: PLUGIN,
      action: '${id}',
      tracks: [{ id: 1, title: 'A Track' }],
      selected: [1]
    })

    expect(run.trackById(1).comment).toBe('touched')
    expect(run.report).toEqual(['Updated 1 track(s)'])
  })

  // The edge case every plugin gets wrong first: nothing selected.
  it('reports instead of failing when nothing is selected', async () => {
    const run = await runAction({
      plugin: PLUGIN,
      action: '${id}',
      tracks: [{ id: 1, title: 'A Track' }],
      selected: []
    })

    expect(run.report).toEqual(['No tracks selected'])
  })
})
`

mkdirSync(join(dir, '__tests__'), { recursive: true })
writeFileSync(join(dir, 'config.json'), `${JSON.stringify(config, null, 2)}\n`)

for (const id of actionIds) {
  writeFileSync(join(dir, `${id}.js`), actionSource(id))
  writeFileSync(join(dir, '__tests__', `${id}.test.js`), testSource(id))
}

console.log(`Created plugins/${folder}/`)
console.log(`  config.json          id ${config.id}, version ${config.version}`)

for (const id of actionIds) {
  console.log(`  ${id}.js`)
  console.log(`  __tests__/${id}.test.js`)
}

console.log('\nIt passes `npm run verify` as-is. Now:')
console.log('  1. write the action, and narrow modifyFields to what you actually assign')
console.log('  2. replace the placeholder description and add keywords')
console.log('  3. npm run verify')
