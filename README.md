# Lexicon Community Plugins

Community-built plugins for [Lexicon DJ](https://www.lexicondj.com), plus a test
harness that runs plugin actions **outside** of Lexicon so they can be tested in CI.

## Install a plugin

1. Download the plugin's `.zip` from [Releases](../../releases)
2. Drop it in `Documents/Lexicon/Plugins`
3. Restart Lexicon
4. Run it from the top menu bar → **Plugins**

## Why this repo exists

Lexicon plugins are plain JavaScript with no official test tooling. Writing one
means editing a file, restarting Lexicon, clicking through the UI, and hoping.
A mistake in `config.json` permissions means the action fails on a user's machine
after it worked on yours.

This repo adds the missing layer:

| Gate | Catches |
| --- | --- |
| **Sandbox lint** | Syntax Lexicon's parser rejects — the plugin wouldn't load at all |
| **Manifest validation** | Malformed `config.json`, missing action files, missing tests |
| **Permission check** | Code that uses a capability its manifest doesn't grant, and manifests that ask for more than the code uses |
| **Harness tests** | Actual behaviour, against a fake library, in milliseconds |

## Quick start

```bash
git clone <this repo>
cd lexicon-community-plugins
npm install
npm run verify      # lint + validate + permission check + tests
```

## Writing a plugin

A plugin is a folder in `plugins/` with a `config.json` and one `.js` file per
action. **The action's `id` must exactly match its filename.**

```
plugins/
  my-plugin/
    config.json
    my.action.js
    __tests__/
      my.action.test.js
```

### 1. The manifest

```json
{
  "id": "yourname.my-plugin",
  "author": { "name": "Your Name" },
  "actions": [
    {
      "id": "my.action",
      "name": "My Action",
      "description": "Says what this changes, in plain language.",
      "config": {
        "permissions": {
          "track": {
            "read": ["selected"],
            "modify": ["selected"],
            "modifyFields": ["rating"]
          }
        },
        "settings": { "Some Setting": "default value" }
      }
    }
  ]
}
```

Ask for the narrowest permissions that work. CI warns about grants your code
never uses, and reviewers will ask you to drop them.

### 2. The action

An action file is **not** a module. It's a bare script body that Lexicon runs
with globals already injected — no imports, no exports, no wrapper function.
Top-level `await` works.

```js
for (const track of _vars.tracksSelected) {
  if (track.energy >= 8) {
    track.rating = 5
  }
}

_helpers.Report('Done')
```

You change the library by **mutating the objects you were handed**. There's no
save call.

### 3. Syntax rules

Lexicon parses plugin JS more strictly than Node does. These are enforced by
`npm run lint`, because breaking them means the plugin won't load:

- Always use curly braces — no `if (x) doThing()` one-liners
- No `do-while` loops
- No trailing semicolons after loops or closing brackets
- Explicit object keys — `{ name: name }`, never `{ name }`
- No `require()`, `import`, `window`, or `document`

### 4. The tests

```js
import { describe, it, expect } from 'vitest'
import { runAction } from '@lexicon-community/harness'

const PLUGIN = new URL('..', import.meta.url).pathname

it('gives high-energy tracks five stars', async () => {
  const result = await runAction({
    plugin: PLUGIN,
    action: 'my.action',
    tracks: [
      { id: 1, title: 'Banger', energy: 9 },
      { id: 2, title: 'Chill', energy: 3 }
    ],
    selected: [1, 2]
  })

  expect(result.trackById(1).rating).toBe(5)
  expect(result.trackById(2).rating).toBe(0)
  expect(result.report).toEqual(['Done'])
})
```

The harness reads your real `config.json` and **enforces the same permissions
Lexicon does**. If your code writes a field that isn't in `modifyFields`, the
test throws a `PermissionError` — which is exactly what would have bitten your
users.

## Harness reference

### Inputs

```js
await runAction({
  plugin: PLUGIN,             // folder containing config.json
  action: 'my.action',        // action id
  source: '...',              // optional: run this code instead of the file

  tracks: [{ id: 1, bpm: 128 }],   // partial fixtures, missing fields get defaults
  selected: [1],                   // selected track ids, or 'all'
  playlists: [{ id: 10, name: 'P', type: '2', trackIds: [1] }],
  selectedPlaylists: [10],
  customTags: [{ id: 1, name: 'Peak Time' }],
  customTagCategories: [],

  settings: { 'Some Setting': 'override' },
  storage: { existingKey: 'value' },
  files: { 'existing.txt': 'contents' },
  network: { 'api.example.com': { ok: true } },  // url or substring -> response
  dialogAnswers: ['user typed this', null],      // null = user closed the dialog
  musicplayer: { nowPlaying: {}, queue: [], bpm: 128 },

  batchSize: 1000,                 // getNextAllBatch page size
  strictPermissions: true,         // false = record denials instead of throwing
  throwOnError: true               // false = capture the error on result.error
})
```

### Results

```js
result.tracks                 // final state of every track
result.trackById(1)           // one track
result.playlists              // final playlists, each with trackIds
result.playlistByName('P')

result.changes.tracks         // [{ id, field, from, to }]
result.changes.playlists
result.created                // { tracks, playlists, customTags, customTagCategories }
result.deleted

result.report                 // _helpers.Report lines
result.logs                   // _helpers.Log lines
result.waits                  // _helpers.Wait durations (not actually slept)
result.progress               // last _ui.progress value
result.dialogs                // _ui.showInputDialog calls
result.control                // _ui.control calls
result.network                // outgoing requests
result.storage                // final storage state
result.files                  // final file state

result.error                  // when throwOnError: false
result.permissionDenials      // when strictPermissions: false
result.warnings               // harness fidelity warnings, e.g. smartlists
```

### What the harness does not model

Be aware of these before trusting a green test:

- **Smartlist rules aren't evaluated.** `getTrackIds()` on a smartlist returns
  `[]` and pushes a warning. Pass `smartlistResolver` if your action depends on it.
- **`_ui.control` calls are recorded, not executed.** Nothing plays.
- **Timing.** `_helpers.Wait` returns immediately unless you pass `realWaits: true`.
- **Anything marked `source: 'guess'`** in
  [`packages/harness/src/runtime-spec.js`](packages/harness/src/runtime-spec.js).
  That file records which runtime behaviours have been verified against a real
  Lexicon install and which are still inferred from the docs.

Test in a real Lexicon library before you open a PR. The harness catches the
boring failures fast; it does not replace running the thing.

## Verifying harness fidelity

`tools/conformance-probe/` is a plugin whose actions dump observed runtime
behaviour to JSON — batch sizes, storage round trips, what happens when an
action touches a capability it wasn't granted.

To run it:

1. Create `Documents/Lexicon/Plugins/development.json`:
   ```json
   { "reloadBeforeRun": true, "loadPluginFolders": true }
   ```
2. Copy `tools/conformance-probe/` into `Documents/Lexicon/Plugins/`
3. Restart Lexicon and run the probes from the Plugins menu
4. Results land in the plugin's `Files/` folder

If a probe contradicts `runtime-spec.js`, that's a harness bug worth a PR.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Short version: one plugin per folder,
narrow permissions, tests for every action, and `npm run verify` green.

## Links

- [Plugin documentation](https://www.lexicondj.com/docs/developers/plugin)
- [Local API documentation](https://www.lexicondj.com/docs/developers/api)
- [Official example plugins](https://github.com/rekordcloud/lexicon-example-plugins)
- [Lexicon forum — plugins](https://discuss.lexicondj.com/c/advanced/plugins/33)

## License

MIT. Each plugin's author is credited in its `config.json`.
