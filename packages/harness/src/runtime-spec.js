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

  // Docs say settings are always delivered as strings.
  settingsAreStrings: { value: true, source: 'docs' },

  // What _settings[key] gives for a key not declared in config.json.
  settingsMissingValue: { value: undefined, source: 'guess' },

  // How Lexicon reacts to touching an ungranted capability:
  //   'throw'   — raises an error the action can catch
  //   'silent'  — returns undefined / no-ops
  //   'none'    — not enforced at runtime at all
  permissionDenialMode: { value: 'throw', source: 'guess' },

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

  // Whether _vars.playlistsAll is a flat array or a nested tree.
  playlistsAllIsFlat: { value: true, source: 'guess' },

  // Whether playlist.getTrackIds() / getTracks() return promises.
  playlistAccessorsAreAsync: { value: true, source: 'docs' }
}

// Sandbox parser restrictions discovered by probing, beyond the four the docs
// list. Each maps to a lint rule in eslint.config.js.
export const SANDBOX_PARSER_FACTS = {
  // `a?.b` fails with: Unexpected token after inlineIf: ?: ? "71"
  // The ternary ?: operator itself is fine — it is specifically ?. that breaks.
  optionalChaining: { supported: false, source: 'probe' },

  // `Object.prototype.hasOwnProperty.call(x, k)` and comparisons against
  // Object.prototype fail with:
  //   Static method or property access not permitted: Object.prototype
  objectPrototypeAccess: { supported: false, source: 'probe' },

  // A catch binding inside a nested function declaration failed with
  // "err is not defined", while a top-level try/catch works. Being confirmed.
  catchInsideNestedFunction: { supported: false, source: 'probe-pending' }
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

export const CUSTOM_TAG_DEFAULTS = {
  id: 0,
  name: '',
  categoryId: null,
  position: 0
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
