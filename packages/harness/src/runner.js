// Runs a Lexicon action file the way Lexicon does: the file is a bare async
// function body with globals injected, and mutations to the objects it was
// handed are what get persisted.

import { readFileSync, existsSync } from 'node:fs'
import { join, isAbsolute, resolve } from 'node:path'
import { createPermissionChecker, PermissionError } from './permissions.js'
import { createLibrary } from './library.js'
import { RUNTIME_SPEC } from './runtime-spec.js'

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

const INJECTED = [
  '_vars',
  '_library',
  '_settings',
  '_storage',
  '_network',
  '_ui',
  '_helpers',
  '_files',
  '_musicplayer'
]

export function loadPlugin(pluginDir) {
  const dir = isAbsolute(pluginDir) ? pluginDir : resolve(process.cwd(), pluginDir)
  const configPath = join(dir, 'config.json')

  if (!existsSync(configPath)) {
    throw new Error(`No config.json in ${dir}`)
  }

  return { dir: dir, config: JSON.parse(readFileSync(configPath, 'utf8')) }
}

export async function runAction(options) {
  const { dir, config } = options.config
    ? { dir: options.dir ?? '.', config: options.config }
    : loadPlugin(options.plugin)

  const action = config.actions.find((a) => a.id === options.action)

  if (!action) {
    throw new Error(
      `Action "${options.action}" is not declared in ${join(dir, 'config.json')}. ` +
        `Declared: ${config.actions.map((a) => a.id).join(', ')}`
    )
  }

  const scriptPath = options.source ? null : join(dir, `${action.id}.js`)
  const source = options.source ?? readFileSync(scriptPath, 'utf8')

  const permissions = action.config.permissions ?? {}
  const perms = createPermissionChecker(permissions, { strict: options.strictPermissions !== false })

  const record = {
    trackChanges: [],
    playlistChanges: [],
    warnings: []
  }

  const library = createLibrary({
    tracks: options.tracks,
    playlists: options.playlists,
    customTags: options.customTags,
    customTagCategories: options.customTagCategories,
    selectedTrackIds: normaliseSelection(options.selected, options.tracks),
    selectedPlaylistIds: options.selectedPlaylists ?? [],
    smartlistResolver: options.smartlistResolver,
    batchSize: options.batchSize,
    permissions: perms,
    record: record
  })

  // --- settings ------------------------------------------------------------

  const declaredSettings = action.config.settings ?? {}
  const settingsValues = { ...declaredSettings, ...(options.settings ?? {}) }
  const settings = {}

  for (const [key, value] of Object.entries(settingsValues)) {
    // Lexicon hands settings to plugins as strings.
    settings[key] = RUNTIME_SPEC.settingsAreStrings.value && value !== null && value !== undefined
      ? String(value)
      : value
  }

  // --- storage -------------------------------------------------------------

  const storageState = new Map(Object.entries(options.storage ?? {}))

  const storage = {
    save(key, value) {
      perms.storage()

      // Lexicon serialises storage values, so what comes back out is the JSON
      // form of what went in. Strings, numbers, booleans, null, arrays and
      // nested objects survive intact — but a Date goes in as an object and
      // comes back as an ISO string. Round-tripping here reproduces that
      // instead of handing back a live Date the real app would not give you.
      storageState.set(key, value === undefined ? undefined : JSON.parse(JSON.stringify(value)))
    },

    load(key) {
      perms.storage()
      return storageState.has(key) ? storageState.get(key) : RUNTIME_SPEC.storageMissingValue.value
    }
  }

  // --- network -------------------------------------------------------------

  const networkCalls = []

  function resolveResponse(method, params) {
    const responses = options.network ?? {}

    if (typeof responses === 'function') {
      return responses(method, params)
    }

    const byUrl = responses[params.url]

    if (byUrl !== undefined) {
      return typeof byUrl === 'function' ? byUrl(params) : byUrl
    }

    for (const [pattern, value] of Object.entries(responses)) {
      if (params.url.includes(pattern)) {
        return typeof value === 'function' ? value(params) : value
      }
    }

    throw new Error(
      `No mock response for ${method} ${params.url}. ` +
        'Pass `network: { "<url or substring>": response }` to the harness.'
    )
  }

  const network = {
    async GET(params = {}) {
      perms.networkGet(params.url ?? '')
      networkCalls.push({ method: 'GET', url: params.url, headers: params.headers, data: params.data })
      return resolveResponse('GET', params)
    },

    async POST(params = {}) {
      perms.networkPost(params.url ?? '')
      networkCalls.push({ method: 'POST', url: params.url, headers: params.headers, data: params.data })
      return resolveResponse('POST', params)
    }
  }

  // --- ui ------------------------------------------------------------------

  const controlCalls = []
  const dialogs = []
  const dialogAnswers = [...(options.dialogAnswers ?? [])]
  let lastProgress = null

  const ui = {
    async showInputDialog(params = {}) {
      dialogs.push(params)

      if (dialogAnswers.length === 0) {
        throw new Error(
          `Action called _ui.showInputDialog("${params.message}") but no answer was queued. ` +
            'Pass `dialogAnswers: ["..."]` to the harness. Use null to simulate the user closing it.'
        )
      }

      const answer = dialogAnswers.shift()
      return answer === null || answer === undefined ? null : String(answer)
    },

    progress(value) {
      lastProgress = value
    },

    control(name, params) {
      perms.control()
      controlCalls.push({ name: name, params: params })
    }
  }

  // --- helpers, files, musicplayer ----------------------------------------

  const logs = []
  const reportLines = []
  const waits = []

  const helpers = {
    Log(message) {
      logs.push(String(message))
    },

    Report(message) {
      reportLines.push(String(message))
    },

    async Wait(ms) {
      // Recorded, not actually slept — tests should not take real seconds.
      waits.push(ms)

      if (options.realWaits === true) {
        await new Promise((done) => setTimeout(done, ms))
      }
    }
  }

  const fileState = new Map(Object.entries(options.files ?? {}))

  const files = {
    write(filename, contents) {
      perms.filesWrite()
      assertSafeFilename(filename)
      fileState.set(filename, String(contents))
    },

    read(filename) {
      perms.filesRead()
      assertSafeFilename(filename)
      return fileState.has(filename) ? fileState.get(filename) : null
    },

    list() {
      perms.filesList()
      return [...fileState.keys()]
    }
  }

  const player = options.musicplayer ?? {}

  const musicplayer = {
    getNowPlaying() {
      return player.nowPlaying ?? null
    },

    getQueue() {
      return player.queue ?? []
    },

    getCurrentProgress() {
      return player.progress ?? 0
    },

    getCurrentTime() {
      return player.currentTime ?? 0
    },

    getBpm() {
      return player.bpm ?? 0
    }
  }

  // --- execute -------------------------------------------------------------

  const globals = {
    _vars: library.vars,
    _library: library.library,
    _settings: settings,
    _storage: storage,
    _network: network,
    _ui: ui,
    _helpers: helpers,
    _files: files,
    _musicplayer: musicplayer
  }

  let error = null
  let permissionError = null

  try {
    const fn = new AsyncFunction(...INJECTED, source)
    await fn(...INJECTED.map((name) => globals[name]))
  } catch (err) {
    error = err

    if (err instanceof PermissionError) {
      permissionError = err
    }

    if (options.throwOnError !== false) {
      throw err
    }
  }

  const snapshot = library.snapshot()

  return {
    error: error,
    permissionError: permissionError,
    permissionDenials: perms.denials,
    warnings: record.warnings,

    tracks: snapshot.tracks,
    trackById(id) {
      return snapshot.tracks.find((t) => t.id === id) ?? null
    },
    playlists: snapshot.playlists,
    playlistByName(name) {
      return snapshot.playlists.find((p) => p.name === name) ?? null
    },
    customTags: snapshot.customTags,
    customTagCategories: snapshot.customTagCategories,

    changes: {
      tracks: record.trackChanges,
      playlists: record.playlistChanges
    },
    created: library.created,
    deleted: library.deleted,

    report: reportLines,
    logs: logs,
    waits: waits,
    progress: lastProgress,
    dialogs: dialogs,
    control: controlCalls,
    network: networkCalls,
    storage: Object.fromEntries(storageState),
    files: Object.fromEntries(fileState)
  }
}

function normaliseSelection(selected, tracks) {
  if (!selected) {
    return []
  }

  if (selected === 'all') {
    return (tracks ?? []).map((t, index) => t.id ?? index + 1)
  }

  return selected.map((item) => (typeof item === 'object' ? item.id : item))
}

// Lexicon restricts plugin file writes to <PluginPath>/<PluginName>/Files/.
function assertSafeFilename(filename) {
  const name = String(filename)

  if (name.includes('/') || name.includes('\\') || name.includes('..')) {
    throw new Error(
      `Unsafe filename "${name}". Lexicon rejects path separators and ".." in _files calls.`
    )
  }
}
