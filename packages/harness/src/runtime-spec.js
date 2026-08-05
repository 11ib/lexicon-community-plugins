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
  probedAt: null,

  // Size of each _library.track.getNextAllBatch() page.
  trackBatchSize: { value: 1000, source: 'guess' },

  // What _storage.load() returns for a key that was never saved.
  storageMissingValue: { value: null, source: 'docs' },

  // Whether _storage.load / _storage.save return promises.
  storageIsAsync: { value: false, source: 'docs' },

  // Whether values survive a storage round trip with their type intact.
  storagePreservesTypes: { value: true, source: 'docs' },

  // Docs say settings are always delivered as strings.
  settingsAreStrings: { value: true, source: 'docs' },

  // What _settings[key] gives for a key not declared in config.json.
  settingsMissingValue: { value: undefined, source: 'guess' },

  // How Lexicon reacts to touching an ungranted capability:
  //   'throw'   — raises an error the action can catch
  //   'silent'  — returns undefined / no-ops
  //   'none'    — not enforced at runtime at all
  permissionDenialMode: { value: 'throw', source: 'guess' },

  // How a write to a field outside modifyFields behaves:
  //   'throw'   — assignment raises
  //   'ignored' — assignment succeeds in memory but is not persisted
  //   'applied' — persisted anyway (permissions not enforced on write)
  modifyFieldDenialMode: { value: 'ignored', source: 'guess' },

  // Whether _vars.playlistsAll is a flat array or a nested tree.
  playlistsAllIsFlat: { value: true, source: 'guess' },

  // Whether playlist.getTrackIds() / getTracks() return promises.
  playlistAccessorsAreAsync: { value: true, source: 'docs' }
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
  tempomarkers: []
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
