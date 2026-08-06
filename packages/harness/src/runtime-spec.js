// Empirical facts about the real Lexicon plugin runtime.
//
// Everything in this file is meant to be VERIFIED against a real Lexicon
// install, not inferred from the docs. The conformance probe plugin in
// tools/conformance-probe/ produces the JSON that fills this in.
//
// Each entry carries a `source`:
//   'probe'  — observed in a real Lexicon run, trustworthy
//   'docs'   — taken from the published documentation, not yet observed
//   'guess'  — inferred, needs a probe before anyone relies on it
//
// Anything still marked 'guess' is a place the harness may lie to you.

export const RUNTIME_SPEC = {
  lexiconVersion: null,
  probedAt: '2026-08-05',

  // Size of each _library.track.getNextAllBatch() page. Observed exactly 1000
  // per batch across a 66,422 track library, ids ascending.
  trackBatchSize: { value: 1000, source: 'probe' },

  // Whether _library.track.getNextAllBatch() returns a promise.
  batchAccessorIsAsync: { value: true, source: 'probe' },

  // What _storage.load() returns for a key that was never saved.
  storageMissingValue: { value: null, source: 'probe' },

  // _storage.load and _storage.save are both SYNCHRONOUS — neither returns a
  // thenable. Awaiting them is harmless but unnecessary.
  storageIsAsync: { value: false, source: 'probe' },

  // Strings, numbers, booleans, null, arrays and nested objects all survive a
  // round trip with their type intact.
  storagePreservesTypes: { value: true, source: 'probe' },

  // ...but a Date does NOT. It is serialised to an ISO string on save and
  // comes back as a string. Anything relying on Date methods must re-wrap it.
  storagePreservesDates: { value: false, source: 'probe' },

  // Every setting arrives as a string, including ones declared as numbers or
  // booleans in config.json. An empty setting is '' rather than null.
  settingsAreStrings: { value: true, source: 'probe' },

  // What _settings[key] gives for a key not declared in config.json.
  settingsMissingValue: { value: undefined, source: 'probe' },

  // How Lexicon reacts to touching an ungranted capability: the capability is
  // simply OMITTED from what gets injected. There is no permission error.
  //
  //   denied _vars read      -> a useless placeholder, NOT undefined and NOT
  //                             an array. _vars.playlistsAll came back as a
  //                             non-array object with no length;
  //                             _vars.tracksAllAmount came back as null.
  //                             Execution continues.
  //   denied _library method -> absent from the object, so calling it is a
  //                             plain TypeError:
  //                             "getNextAllBatch is not a function"
  //
  // So a plugin with the wrong permissions does not fail loudly. It iterates
  // an empty placeholder, finds nothing, reports success, and does nothing —
  // or dies on a TypeError that never mentions permissions.
  //
  // The harness is deliberately STRICTER: it throws PermissionError naming the
  // exact manifest line to add, because a test that silently passes over an
  // empty placeholder is worthless.
  permissionDenialMode: { value: 'omitted', source: 'probe' },

  // Some failures still terminate the script where it stands, with no log
  // entry, no error, and no chance to react. Confirmed for a `try` block whose
  // body does not throw, and for assigning to an injected global.
  //
  // Practical consequence: you cannot defend against this at runtime. The only
  // defence is not writing the offending code, which is what the lint rules
  // and the permission checker are for.
  sandboxHaltsSilently: { value: true, source: 'probe' },

  // How a write to a field outside modifyFields behaves.
  //   'throw'   — assignment raises
  //   'ignored' — assignment succeeds in memory but is not persisted
  //   'applied' — persisted anyway (permissions not enforced on write)
  //
  // CONFIRMED 'ignored', and this is the nastiest failure mode in the whole
  // plugin system. An action with modifyFields: ["extra1"] wrote both extra1
  // and extra2. Neither assignment threw, both read back correctly in memory,
  // the action reported success — and only extra1 reached the database.
  // Lexicon logged "Saved changes to 8 tracks(s)" either way.
  //
  // This is exactly why the harness enforces modifyFields strictly: the app
  // gives you no signal at all.
  modifyFieldDenialMode: { value: 'ignored', source: 'probe' },

  // Assigning a property that is not part of the track schema at all is also
  // silently dropped rather than rejected.
  unknownFieldWritesDropped: { value: true, source: 'probe' },

  // _vars.playlistsAll is a FLAT array, unlike the Local API's nested tree.
  // Confirmed across 548 playlists: none carried a `playlists` child array.
  playlistsAllIsFlat: { value: true, source: 'probe' },

  // playlist.getTrackIds() and getTracks() both return promises.
  playlistAccessorsAreAsync: { value: true, source: 'probe' },

  // A playlist never exposes `trackIds` as a property — it is undefined both
  // before and after getTrackIds() is called. You must use the accessor.
  playlistExposesTrackIdsProperty: { value: false, source: 'probe' },

  // The docs name this _vars.customTagsCategories. That key does not exist.
  // The real one is _vars.customTagCategories. Reading the documented spelling
  // returns undefined, and the next property access kills the action.
  customTagCategoriesKey: { value: 'customTagCategories', source: 'probe' },

  // Assigning to an injected global halts the action silently, mid-statement.
  // Confirmed: a probe stopped dead on `_settings['AString'] = '...'`, with the
  // surrounding try/catch never running and nothing logged.
  assigningToInjectedGlobalHalts: { value: true, source: 'probe' }
}

// Sandbox parser restrictions discovered by probing, beyond the four the docs
// list. Each maps to a lint rule in eslint.config.js.
export const SANDBOX_PARSER_FACTS = {
  // `a?.b` fails with: Unexpected token after inlineIf: ?: ? "71"
  // The ternary ?: operator itself is fine — it is specifically ?. that breaks.
  optionalChaining: { supported: false, source: 'probe' },

  // `a ?? b` fails the same way: Unexpected token after inlineIf: ?: ? "0"
  nullishCoalescing: { supported: false, source: 'probe' },

  // `function f(value = 'x')` fails with:
  //   Unexpected token after prop: w: function withDefault(value = "0")
  // Assign fallbacks in the function body instead.
  defaultParameters: { supported: false, source: 'probe' },

  // `const { alpha } = source` fails with:
  //   Unexpected token after prop: {: const { alpha } = source
  // Read properties explicitly: `const alpha = source.alpha`.
  destructuring: { supported: false, source: 'probe' },

  // Template literals and spread both work — verified in isolation, so the
  // lint rules deliberately allow them.
  templateLiterals: { supported: true, source: 'probe' },
  spread: { supported: true, source: 'probe' },

  // `Object.prototype.hasOwnProperty.call(x, k)` and comparisons against
  // Object.prototype fail with:
  //   Static method or property access not permitted: Object.prototype
  objectPrototypeAccess: { supported: false, source: 'probe' },

  // try/catch is effectively UNUSABLE. Two independent failures:
  //
  //  1. The catch parameter is never bound. Referencing it throws
  //     "err is not defined" — and renaming it changes nothing: a probe using
  //     `catch (errA)` failed with "errA is not defined". So this is not a
  //     name collision, the binding simply does not exist. An earlier reading
  //     blamed nested functions; top-level catch is equally broken.
  //
  //  2. A `try` block whose body does NOT throw halts the action silently.
  //     A probe ran `Object.keys({a: 1, b: 2}).length` at the top level fine,
  //     then the identical statement inside a try block, and stopped dead.
  //
  // Conclusion: you cannot do error handling in a Lexicon plugin. Validate
  // inputs up front and throw a clear Error instead — a thrown error IS shown
  // to the user, which is the one reliable failure path.
  tryCatch: { supported: false, source: 'probe' },
  catchBindingIsBound: { supported: false, source: 'probe' },

  // Block scope is FLATTENED. Two sibling blocks each declaring `const value`
  // fails with "Identifier 'value' has already been declared", which is legal
  // JavaScript everywhere else. Every block-scoped name in an action must be
  // unique across the whole file.
  blockScopeIsolated: { supported: false, source: 'probe' },

  // Object.assign is blocked: "Static method or property access not
  // permitted: Object.assign", same guard as Object.prototype.
  objectAssign: { supported: false, source: 'probe' },

  // Object.getPrototypeOf and Object.freeze are worse than blocked — they are
  // STUBBED. No error, no halt: they just return undefined. So
  // `const frozen = Object.freeze(obj)` silently hands you undefined, and the
  // failure surfaces somewhere else entirely.
  objectGetPrototypeOfReturnsUndefined: { supported: false, source: 'probe' },
  objectFreezeReturnsUndefined: { supported: false, source: 'probe' },

  // Everything else probed works normally: Object.keys / values / entries /
  // fromEntries / getOwnPropertyNames, Array.isArray / from, Number.isFinite /
  // parseFloat, Math.*, JSON.parse / stringify, Date.now, new Date,
  // String.fromCharCode, Promise.resolve / all, new RegExp.
  commonStaticsWork: { supported: true, source: 'probe' },

  // Loop variables do NOT collide, unlike block-scoped declarations. Two
  // sequential `for (const item of ...)` loops both ran. So the flattened-scope
  // rule applies to block bodies, not loop heads — which is why the lint rule
  // deliberately skips them.
  loopVariablesCollide: { supported: false, source: 'probe' }
}

// Fields that appear on a track object handed to a plugin, with the defaults a
// fixture gets when it doesn't specify them. Field list taken from the Lexicon
// Local API OpenAPI spec (components.schemas.Track).
export const TRACK_DEFAULTS = {
  id: 0,
  type: '0',
  title: '',
  artist: '',
  albumTitle: '',
  label: '',
  remixer: '',
  mix: '',
  composer: '',
  producer: '',
  grouping: '',
  lyricist: '',
  comment: '',
  key: '',
  genre: '',
  bpm: 0,
  rating: 0,
  color: '',
  year: 0,
  duration: 0,
  bitrate: 0,
  playCount: 0,
  location: '',
  locationUnique: '',
  lastPlayed: null,
  dateAdded: '2024-01-01T00:00:00.000Z',
  dateModified: '2024-01-01T00:00:00.000Z',
  sizeBytes: 0,
  sampleRate: 44100,
  trackNumber: 0,
  energy: 0,
  danceability: 0,
  popularity: 0,
  happiness: 0,
  extra1: '',
  extra2: '',
  streamingService: null,
  streamingId: null,
  fingerprint: '',
  beatshiftCase: 'A',
  archived: 0,
  archivedSince: null,
  incoming: 0,
  importSource: '0',
  data: {},
  tags: [],
  cuepoints: [],
  tempomarkers: [],

  // Present on the object plugins receive, but not in the Local API's Track
  // schema. Observed via _library.track.getNextAllBatch().
  releaseDate: null,
  hasCuepoints: 0,
  hasTempomarkers: 0,
  cloudFileState: null
}

export const PLAYLIST_DEFAULTS = {
  id: 0,
  name: '',
  type: '2',
  folderType: null,
  parentId: null,
  position: 0,
  dateAdded: '2024-01-01T00:00:00.000Z',
  dateModified: '2024-01-01T00:00:00.000Z',
  data: null
}

// Confirmed against a live library of 79 custom tags. Note the tag's text is
// `label`, not `name` — a plugin reading tag.name gets undefined.
export const CUSTOM_TAG_DEFAULTS = {
  id: 0,
  categoryId: null,
  label: '',
  position: 0,
  shortcut: 0
}

export const CUSTOM_TAG_CATEGORY_DEFAULTS = {
  id: 0,
  name: '',
  position: 0
}

// Playlist types as used by config/smartlist code.
export const PLAYLIST_TYPE = {
  FOLDER: '1',
  PLAYLIST: '2',
  SMARTLIST: '3'
}
