# Writing a plugin in this repo

Procedure only. The rules live in [`docs/SANDBOX.md`](docs/SANDBOX.md) and in
`eslint.config.js`, which are executable and therefore cannot drift from what
CI enforces. Do not restate them here or anywhere else.

## The loop

```bash
npm run new:plugin <folder-name>     # scaffolds a plugin that already passes
# write the action
npm run verify                       # lint, manifests, permissions, versions, tests
```

`npm run verify` is the oracle. It runs the same five gates CI does, in about
two seconds, and its errors are written to be acted on directly — an error
naming a line and a construct means the plugin would not have loaded in
Lexicon at all. Iterate against it until green rather than reasoning about
whether something parses.

## What you are writing

A folder in `plugins/` containing `config.json`, one `.js` per action named
exactly `<action-id>.js`, and `__tests__/<action-id>.test.js` per action.
`plugins/example-energy-rating/` is a working example of all three.

An action file is **not a module**. It is a bare script body Lexicon runs as an
async function: no `import`, no `export`, no `require`, and no wrapping
function. Tracks and playlists are mutated in place; there is no save call.

Lexicon's parser is not V8 and rejects syntax Node accepts. `npm run lint`
encodes every construct that has been probed — read
[`docs/SANDBOX.md`](docs/SANDBOX.md) before writing, not after failing.

## The five gates

| `npm run …` | What failing it means |
| --- | --- |
| `lint` | The plugin would not load in Lexicon at all |
| `validate` | `config.json` is malformed, or an action has no file or no test |
| `check:permissions` | Code uses a capability the manifest never granted, or the manifest asks for more than the code uses |
| `check:versions` | A shipped file changed without `version` moving — the change would reach nobody |
| `test` | Behaviour is wrong, against the harness's fake library |

## Rules that are not syntax

- **`modifyFields` must list every field the action assigns.** An undeclared
  write is accepted in memory and silently discarded on save. This is the
  failure that ships broken, and `check:permissions` is what catches it.
- **Ask for the narrowest permissions that work.** A grant the code never uses
  is a warning now and a review comment later.
- **`network` requires explicit domains.** Wildcards are rejected by CI.
- **Anything that deletes needs a `confirmationMessage`.**
- **Settings arrive as strings, always.** `_settings['Some Number']` is `'7'`,
  not `7`.
- **Bump `version` in `config.json`** whenever a shipped file changes.

## Tests

Every action needs the happy path and at least one edge case. The ones that
actually break plugins: an empty selection, a field that is empty/`null`/`0`, a
setting the user typed wrong, and running the action twice (a suffix or tag
should not double-apply).

Tests run against `@lexicon-plugins/harness`, which enforces the real
`config.json` permissions — so a permission mistake fails the test the same way
it would fail in the app. The harness does not model smartlist rules, `_ui.control`
execution, or timing; see the README section on what it does not model.

## Finishing

State honestly in the PR what was tested against the harness and what was not
tested in a real Lexicon library. A green suite here is not the same as having
run the thing.
