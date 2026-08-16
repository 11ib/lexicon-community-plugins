# @lexicon-plugins/harness

Runs [Lexicon DJ](https://www.lexicondj.com) plugin actions **outside** of
Lexicon, against a fake library, so they can be tested in milliseconds instead
of by restarting the app and clicking through the UI.

```bash
npm install --save-dev @lexicon-plugins/harness
```

```js
import { runAction } from '@lexicon-plugins/harness'

const run = await runAction({
  plugin: 'plugins/bpm-tools',      // folder containing config.json
  action: 'halve.double',           // action id, matching halve.double.js
  tracks: [{ id: 1, title: 'Track', bpm: 174 }],
  selected: [1]
})

expect(run.trackById(1).bpm).toBe(87)
expect(run.report).toEqual(['Updated 1 track'])
```

Permissions come from the plugin's real `config.json`, so an action that
touches a capability its manifest never asked for fails here for the same
reason it would fail in Lexicon — a `PermissionError`, not a passing test and a
broken install.

## What you get back

`result.tracks` / `trackById` / `playlists` / `playlistByName` for final state,
`result.changes` for a field-level diff, `result.created` and `result.deleted`,
plus everything the action did on the way through: `report`, `logs`, `progress`,
`dialogs`, `control`, `network`, `storage`, `files`, `waits`.

Fixtures are partial — missing fields get defaults — and inputs cover settings,
storage, files, canned network responses, dialog answers, and the music player.

## What it does not model

- **Smartlist rules are not evaluated.** `getTrackIds()` returns `[]` and pushes
  a warning; pass `smartlistResolver` if your action depends on them.
- **`_ui.control` calls are recorded, not executed.** Nothing plays.
- **Timing.** `_helpers.Wait` returns immediately unless you pass `realWaits: true`.
- **Anything marked `source: 'guess'`** in `src/runtime-spec.js` — that file
  tracks which runtime behaviours were verified against a real Lexicon install
  and which are still inferred from the docs.

Test in a real library before shipping. This catches the boring failures fast;
it does not replace running the thing.

## Full documentation

Inputs, results, the sandbox syntax rules Lexicon's parser enforces, and the
CI gates that go with them:
[lexicon-community-plugins](https://github.com/11ib/lexicon-community-plugins).
