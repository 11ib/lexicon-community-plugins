#!/usr/bin/env node
// Static consistency check between what an action's code does and what its
// config.json asks for.
//
// Two directions, both useful:
//   ERROR   code uses a capability the manifest does not grant
//           -> the plugin would fail at runtime for every user
//   WARNING manifest grants a capability the code never uses
//           -> over-broad permission request, the thing reviewers should catch
//
// This is a heuristic, not a proof. It reads unambiguous namespace calls
// (_network.GET, _storage.save, ...) exactly, and tracks track-typed variables
// through the common binding patterns to check field writes.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as espree from 'espree'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// Overridable so the tooling tests can point at tests/fixtures/.
const PLUGINS_DIR = process.env.PLUGINS_DIR
  ? join(ROOT, process.env.PLUGINS_DIR)
  : join(ROOT, 'plugins')

const TRACK_FIELDS = new Set([
  'title', 'artist', 'albumTitle', 'label', 'remixer', 'mix', 'composer',
  'producer', 'grouping', 'lyricist', 'comment', 'key', 'genre', 'bpm',
  'rating', 'color', 'year', 'duration', 'bitrate', 'playCount', 'location',
  'lastPlayed', 'dateAdded', 'trackNumber', 'energy', 'danceability',
  'popularity', 'happiness', 'extra1', 'extra2', 'streamingService',
  'streamingId', 'tags', 'tempomarkers', 'cuepoints', 'beatshiftCase',
  'archived', 'incoming', 'type', 'data'
])

const PLAYLIST_FIELDS = new Set(['name', 'tracks', 'trackIds', 'smartlist', 'parentId', 'position'])

// --- tiny AST walker -------------------------------------------------------

function walk(node, visit, parent = null) {
  if (node === null || typeof node !== 'object') {
    return
  }

  if (Array.isArray(node)) {
    for (const child of node) {
      walk(child, visit, parent)
    }
    return
  }

  if (typeof node.type !== 'string') {
    return
  }

  visit(node, parent)

  for (const key of Object.keys(node)) {
    if (key === 'parent') {
      continue
    }
    walk(node[key], visit, node)
  }
}

// Render a member expression like _library.track.getNextAllBatch back to text.
function memberPath(node) {
  const parts = []
  let current = node

  while (current && current.type === 'MemberExpression' && !current.computed) {
    parts.unshift(current.property.name)
    current = current.object
  }

  if (current && current.type === 'Identifier') {
    parts.unshift(current.name)
    return parts.join('.')
  }

  return null
}

// --- capability model ------------------------------------------------------

function has(value) {
  return Array.isArray(value) ? value.length > 0 : value === true
}

function scopeAllows(perm, scope) {
  return Array.isArray(perm) && perm.includes(scope)
}

// Each entry: how a usage maps to a permission requirement.
function buildRequirements(perms) {
  const track = perms.track ?? {}
  const playlist = perms.playlist ?? {}
  const customTag = perms.customTag ?? {}
  const files = perms.files ?? {}
  const network = perms.network ?? {}

  return {
    '_vars.tracksSelected': {
      granted: scopeAllows(track.read, 'selected'),
      need: 'track.read: ["selected"]'
    },
    '_vars.tracksAllAmount': {
      granted: has(track.read),
      need: 'track.read'
    },
    '_vars.playlistsAll': {
      granted: scopeAllows(playlist.read, 'all'),
      need: 'playlist.read: ["all"]'
    },
    '_vars.playlistsSelected': {
      granted: scopeAllows(playlist.read, 'selected'),
      need: 'playlist.read: ["selected"]'
    },
    '_vars.customTags': {
      granted: has(customTag.read),
      need: 'customTag.read: ["all"]'
    },
    '_vars.customTagsCategories': {
      granted: has(customTag.read),
      need: 'customTag.read: ["all"]'
    },
    '_library.track.getNextAllBatch': {
      granted: scopeAllows(track.read, 'all'),
      need: 'track.read: ["all"]'
    },
    '_library.track.create': { granted: track.create === true, need: 'track.create: true' },
    '_library.track.delete': { granted: track.delete === true, need: 'track.delete: true' },
    '_library.playlist.create': { granted: playlist.create === true, need: 'playlist.create: true' },
    '_library.playlist.delete': { granted: playlist.delete === true, need: 'playlist.delete: true' },
    '_library.customTag.create': { granted: customTag.create === true, need: 'customTag.create: true' },
    '_library.customTag.delete': { granted: customTag.delete === true, need: 'customTag.delete: true' },
    '_library.customTagCategory.create': { granted: customTag.create === true, need: 'customTag.create: true' },
    '_library.customTagCategory.delete': { granted: customTag.delete === true, need: 'customTag.delete: true' },
    '_network.GET': { granted: has(network.GET), need: 'network.GET: ["domain.com"]' },
    '_network.POST': { granted: has(network.POST), need: 'network.POST: ["domain.com"]' },
    '_storage.save': { granted: perms.storage === true, need: 'storage: true' },
    '_storage.load': { granted: perms.storage === true, need: 'storage: true' },
    '_files.write': { granted: files.write === true, need: 'files.write: true' },
    '_files.read': { granted: files.read === true, need: 'files.read: true' },
    '_files.list': { granted: files.list === true, need: 'files.list: true' },
    '_ui.control': { granted: perms.control === true, need: 'control: true' }
  }
}

// --- per-action analysis ---------------------------------------------------

function analyseAction(source, action) {
  const perms = action.config.permissions ?? {}
  const requirements = buildRequirements(perms)

  const problems = []
  const used = new Set()

  let ast
  try {
    ast = espree.parse(source, {
      ecmaVersion: 2022,
      sourceType: 'module',
      loc: true
    })
  } catch (err) {
    return {
      problems: [{ level: 'error', message: `failed to parse: ${err.message}` }],
      used
    }
  }

  // Identifier names that hold a track object, seeded from the usual sources.
  const trackVars = new Set()
  const playlistVars = new Set()

  function sourceIsTracks(node) {
    const path = memberPath(node)

    if (path === '_vars.tracksSelected') {
      return true
    }

    if (node.type === 'AwaitExpression') {
      return sourceIsTracks(node.argument)
    }

    if (node.type === 'CallExpression') {
      const callee = memberPath(node.callee)
      if (callee === '_library.track.getNextAllBatch') {
        return true
      }
      if (callee && callee.endsWith('.getTracks')) {
        return true
      }
    }

    return false
  }

  function sourceIsPlaylists(node) {
    const path = memberPath(node)

    if (path === '_vars.playlistsAll' || path === '_vars.playlistsSelected') {
      return true
    }

    if (node.type === 'AwaitExpression') {
      return sourceIsPlaylists(node.argument)
    }

    if (node.type === 'CallExpression') {
      const callee = memberPath(node.callee)
      if (callee === '_library.playlist.create') {
        return true
      }
    }

    // playlistsAll.find(...) / .filter(...)[0]
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
      const objPath = memberPath(node.callee.object)
      if (objPath === '_vars.playlistsAll' || objPath === '_vars.playlistsSelected') {
        return true
      }
    }

    if (node.type === 'LogicalExpression') {
      return sourceIsPlaylists(node.left) || sourceIsPlaylists(node.right)
    }

    if (node.type === 'MemberExpression' && node.computed) {
      return sourceIsPlaylists(node.object)
    }

    return false
  }

  // Pass 1: bindings.
  walk(ast, (node) => {
    if (node.type === 'ForOfStatement' && node.left.type === 'VariableDeclaration') {
      const name = node.left.declarations[0]?.id?.name

      if (name && sourceIsTracks(node.right)) {
        trackVars.add(name)
      }

      if (name && sourceIsPlaylists(node.right)) {
        playlistVars.add(name)
      }
    }

    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.init) {
      // const track = _vars.tracksSelected[0]
      const init = node.init
      const unwrapped = init.type === 'AwaitExpression' ? init.argument : init

      if (unwrapped.type === 'MemberExpression' && unwrapped.computed && sourceIsTracks(unwrapped.object)) {
        trackVars.add(node.id.name)
      }

      if (sourceIsPlaylists(unwrapped)) {
        playlistVars.add(node.id.name)
      }

      if (unwrapped.type === 'MemberExpression' && unwrapped.computed && sourceIsPlaylists(unwrapped.object)) {
        playlistVars.add(node.id.name)
      }
    }
  })

  // Pass 2: usages and writes.
  walk(ast, (node) => {
    if (node.type === 'MemberExpression' && !node.computed) {
      const path = memberPath(node)

      if (path && requirements[path]) {
        used.add(path)

        if (!requirements[path].granted) {
          problems.push({
            level: 'error',
            line: node.loc.start.line,
            message: `uses ${path} but config.json does not grant ${requirements[path].need}`
          })
        }
      }
    }

    if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression' && !node.left.computed) {
      const objectName = node.left.object.type === 'Identifier' ? node.left.object.name : null
      const field = node.left.property.name

      if (objectName && trackVars.has(objectName) && TRACK_FIELDS.has(field)) {
        used.add(`track.modifyFields:${field}`)

        const modifyFields = perms.track?.modifyFields ?? []

        if (!has(perms.track?.modify)) {
          problems.push({
            level: 'error',
            line: node.loc.start.line,
            message: `writes track.${field} but config.json does not grant track.modify`
          })
        } else if (!modifyFields.includes(field)) {
          problems.push({
            level: 'error',
            line: node.loc.start.line,
            message: `writes track.${field} but modifyFields is [${modifyFields.join(', ')}]`
          })
        }
      }

      if (objectName && playlistVars.has(objectName) && PLAYLIST_FIELDS.has(field)) {
        const declared = field === 'trackIds' ? 'tracks' : field
        used.add(`playlist.modifyFields:${declared}`)

        const modifyFields = perms.playlist?.modifyFields ?? []

        if (!has(perms.playlist?.modify)) {
          problems.push({
            level: 'error',
            line: node.loc.start.line,
            message: `writes playlist.${field} but config.json does not grant playlist.modify`
          })
        } else if (!modifyFields.includes(declared)) {
          problems.push({
            level: 'error',
            line: node.loc.start.line,
            message: `writes playlist.${field} but modifyFields is [${modifyFields.join(', ')}]`
          })
        }
      }
    }
  })

  // Over-broad grants. A read scope can be consumed by more than one path
  // (track.read is satisfied by _vars.tracksSelected OR _vars.tracksAllAmount),
  // so check each granted scope against every path that could consume it.
  function usedAny(...paths) {
    return paths.some((p) => used.has(p))
  }

  function warnUnused(condition, message) {
    if (condition) {
      problems.push({ level: 'warning', message: message })
    }
  }

  warnUnused(
    scopeAllows(perms.track?.read, 'selected') &&
      !usedAny('_vars.tracksSelected', '_vars.tracksAllAmount'),
    'grants track.read ["selected"] but never reads selected tracks'
  )

  warnUnused(
    scopeAllows(perms.track?.read, 'all') &&
      !usedAny('_library.track.getNextAllBatch', '_vars.tracksAllAmount'),
    'grants track.read ["all"] but never walks the full library'
  )

  warnUnused(
    scopeAllows(perms.playlist?.read, 'all') && !usedAny('_vars.playlistsAll'),
    'grants playlist.read ["all"] but never reads _vars.playlistsAll'
  )

  warnUnused(
    scopeAllows(perms.playlist?.read, 'selected') && !usedAny('_vars.playlistsSelected'),
    'grants playlist.read ["selected"] but never reads _vars.playlistsSelected'
  )

  warnUnused(
    has(perms.customTag?.read) && !usedAny('_vars.customTags', '_vars.customTagsCategories'),
    'grants customTag.read but never reads custom tags'
  )

  // Booleans and network grants map one-to-one onto their call sites.
  const SIMPLE_GRANTS = [
    ['_library.track.create', 'track.create'],
    ['_library.track.delete', 'track.delete'],
    ['_library.playlist.create', 'playlist.create'],
    ['_library.playlist.delete', 'playlist.delete'],
    ['_network.GET', 'network.GET'],
    ['_network.POST', 'network.POST'],
    ['_files.write', 'files.write'],
    ['_files.read', 'files.read'],
    ['_files.list', 'files.list'],
    ['_ui.control', 'control']
  ]

  for (const [path, label] of SIMPLE_GRANTS) {
    warnUnused(
      requirements[path]?.granted && !used.has(path),
      `grants ${label} but never calls ${path}`
    )
  }

  warnUnused(
    perms.storage === true && !usedAny('_storage.save', '_storage.load'),
    'grants storage but never calls _storage.save or _storage.load'
  )

  warnUnused(
    (perms.customTag?.create === true || perms.customTag?.delete === true) &&
      !usedAny(
        '_library.customTag.create',
        '_library.customTag.delete',
        '_library.customTagCategory.create',
        '_library.customTagCategory.delete'
      ),
    'grants customTag create/delete but never calls them'
  )

  for (const field of perms.track?.modifyFields ?? []) {
    if (!used.has(`track.modifyFields:${field}`)) {
      problems.push({
        level: 'warning',
        message: `declares track.modifyFields "${field}" but never assigns it`
      })
    }
  }

  for (const field of perms.playlist?.modifyFields ?? []) {
    if (!used.has(`playlist.modifyFields:${field}`)) {
      problems.push({
        level: 'warning',
        message: `declares playlist.modifyFields "${field}" but never assigns it`
      })
    }
  }

  return { problems, used }
}

// --- run over every plugin -------------------------------------------------

let errorCount = 0
let warningCount = 0
let actionCount = 0

const folders = existsSync(PLUGINS_DIR)
  ? readdirSync(PLUGINS_DIR)
      .filter((n) => !n.startsWith('.'))
      .filter((n) => statSync(join(PLUGINS_DIR, n)).isDirectory())
  : []

for (const folder of folders) {
  const dir = join(PLUGINS_DIR, folder)
  const configPath = join(dir, 'config.json')

  if (!existsSync(configPath)) {
    continue
  }

  const config = JSON.parse(readFileSync(configPath, 'utf8'))

  for (const action of config.actions) {
    const file = join(dir, `${action.id}.js`)

    if (!existsSync(file)) {
      continue
    }

    actionCount += 1

    const { problems } = analyseAction(readFileSync(file, 'utf8'), action)

    for (const problem of problems) {
      const where = problem.line ? `${folder}/${action.id}.js:${problem.line}` : `${folder}/${action.id}.js`

      if (problem.level === 'error') {
        errorCount += 1
        console.error(`error    ${where} ${problem.message}`)
      } else {
        warningCount += 1
        console.warn(`warning  ${where} ${problem.message}`)
      }
    }
  }
}

console.log(`\nChecked ${actionCount} action(s): ${errorCount} error(s), ${warningCount} warning(s).`)

if (errorCount > 0) {
  process.exit(1)
}
