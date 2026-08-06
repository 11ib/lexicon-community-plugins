# Conformance probe

A Lexicon plugin whose actions report what the runtime actually does, so the
harness can be built on observation rather than on the documentation.

Everything marked `source: 'probe'` in
[`runtime-spec.js`](../../packages/harness/src/runtime-spec.js) came from
running these against a real library. Seven rounds settled the sandbox's parser
restrictions, its permission behaviour, and several places where the official
docs are wrong.

## Running it

1. Create `Documents/Lexicon/Plugins/development.json`:

   ```json
   { "reloadBeforeRun": true, "loadPluginFolders": true }
   ```

2. Copy this folder into `Documents/Lexicon/Plugins/`
3. **Fully quit and reopen Lexicon** — a new plugin folder needs a real restart
4. Select a few tracks you don't mind touching, if the action says to
5. Run the actions from the menu bar → **Plugins**

Results are written to `Documents/Lexicon/Plugins/conformance-probe/Files/` as
JSON. Errors go to `Documents/Lexicon/Plugins/Logs/conformance-probe/`, one file
per action.

Create a scratch playlist first and select tracks only from it. Write probes
target `extra1` / `extra2`, which are almost always empty, but a scratch
playlist means a mistake can't touch anything you care about.

## Writing a probe

Two rules, both learned the hard way.

**Use stage markers, not try/catch.** Some failures terminate the action with no
error and nothing logged — a `try` block whose body doesn't throw is one of
them, and `catch` bindings don't work at all. So write the results file after
every step and record how far you got:

```js
const results = { lastCompleted: 'none' }

function save() {
  _files.write('probe.json', JSON.stringify(results, null, 2))
}

save()

const value = _vars.playlistsAll
results.lastCompleted = 'read playlistsAll'
save()
```

The last value in the file is the step *before* the one that killed it. Without
this you get a probe that vanishes and tells you nothing — which is exactly what
happened in rounds 1 and 2.

**One concern per action file.** A parse error kills the entire file, so a probe
testing five things tells you only that one of them failed. Rounds 3 to 5 split
everything into single-purpose actions and got answers immediately.

Keep to syntax already known to work — see
[`docs/SANDBOX.md`](../../docs/SANDBOX.md). A probe that can't parse teaches you
nothing about the thing you were actually testing.

## If a probe contradicts the harness

That's a harness bug and a valuable PR. Open an issue with the probe output, the
JSON file, and your Lexicon version.
