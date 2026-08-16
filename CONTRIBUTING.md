# Contributing

New to Lexicon plugins? Read the [README](README.md) first — it covers the
execution model and the harness API. This file covers the process.

## Adding a plugin

```bash
npm run new:plugin my-plugin
```

That scaffolds a manifest, an action and a test that already pass every gate,
so the first failure you see is about your code rather than boilerplate. Then:

1. Fill in `config.json` — the real description, `keywords`, and the narrowest
   permissions that work
2. Write the action in `<action-id>.js` (the filename must match the action id
   exactly)
3. Replace the scaffolded tests in `__tests__/<action-id>.test.js`
4. Run `npm run verify`
5. Install it in a real Lexicon and run it against a library you don't mind
   changing
6. Open a PR

`plugins/example-energy-rating/` is a complete working example, and
[`AGENTS.md`](AGENTS.md) is the same loop written for a coding agent.

## Requesting a plugin instead of writing one

If you want a plugin but don't write code, open a
[plugin request](../../issues/new?template=plugin-request.yml). Describe it in
plain language with a before/after example for one track — that example settles
more questions than any amount of description. A maintainer builds it and the
PR credits you.

## Versions

Plugins are installed by `npx @lexicon-plugins/install`, which decides whether
an installed copy is current by comparing its `version` against the one in the
[registry index](docs/REGISTRY.md).

```json
{
  "id": "yourname.my-plugin",
  "version": "1.0.0",
  "keywords": ["tags", "cleanup"]
}
```

Neither field is part of Lexicon's own manifest — it ignores unknown root
fields — so they cost nothing in the app and are what make the plugin
installable and findable outside it.

**Bump `version` in the same PR as any change to a file that ships.** An edited
action with an unchanged version reaches nobody: every existing install
compares versions, concludes it is current, and never downloads it.
`npm run check:versions` enforces this, comparing against the base branch:

- Changed a shipped file without bumping → error
- Changed only `__tests__/` → fine, tests are stripped from the ZIP
- New plugin → needs a `version`, nothing to bump against
- Version went backwards → error

Use judgement on the number: patch for a fix, minor for new behaviour, major
when existing users would notice something they relied on changing.

Locally the check is skipped when it cannot resolve `origin/main` — a shallow
or offline clone will not fail `verify`, but CI runs it with `--strict`.

## What CI checks

`npm run verify` runs the same gates CI does:

```bash
npm run lint               # Lexicon's parser restrictions
npm run validate           # config.json schema, file/action/test pairing
npm run check:permissions  # code vs. manifest, both directions
npm run check:versions     # version bumped when shipped files changed
npm test                   # your tests
```

The permission check reports two kinds of problem:

- **errors** — your code uses something the manifest doesn't grant. This would
  fail at runtime for every user.
- **warnings** — your manifest grants something the code never uses. Not fatal,
  but a reviewer will ask you to remove it.

## Permissions

Plugins run inside other people's libraries. Ask for as little as possible.

**Lexicon does enforce capability calls.** Calling a method you didn't declare
fails loudly with `Missing required "storage" permission` and stops the action,
verified against a real install. So the manifest is a genuine runtime boundary
for anything a plugin *does*.

Two gaps are worth knowing as a reviewer:

- **Reads fail silently.** An ungranted `_vars` read returns `null` rather than
  raising, so a plugin with a wrong read permission quietly does nothing instead
  of reporting a problem.
- **`modifyFields` isn't enforced at write time.** Writes to undeclared fields
  are accepted in memory and silently discarded on save. This is the one that
  ships broken.

`npm run check:permissions` flags mismatches in both directions, but read the
diff — narrow permissions are still the thing to insist on.

**Reviewed closely on every PR:**

- `network` — list explicit domains. Wildcards are rejected by CI. Say in the PR
  what data leaves the user's machine and why.
- `files` — plugins can only write inside their own `Files/` folder, but say what
  you write and why.
- `track.delete`, `playlist.delete`, `customTag.delete` — must have a
  `confirmationMessage`.
- `modifyFields` — list only fields you actually assign.

**Not accepted:**

- Minified, obfuscated, or generated code. Every line must be reviewable.
- Dynamic code construction (`eval`, `new Function`).
- Wildcard network access.
- Telemetry or analytics of any kind.

## Testing expectations

Every action needs tests covering the happy path and at least one edge case.
Cases worth covering, since they're where plugins actually break:

- Empty selection — no tracks selected
- A field that's empty, `null`, or `0`
- A setting the user typed wrong (settings arrive as **strings**, always)
- Idempotency — running twice shouldn't double-apply a suffix or a tag

Tests run against the harness, not real Lexicon. Read
[what the harness doesn't model](README.md#what-the-harness-does-not-model)
before assuming a green suite means you're done.

## Style

Match the surrounding code. Beyond that:

- Report results with `_helpers.Report` so users see what happened
- Use `_helpers.Log` for debugging detail, not user-facing summaries
- Throw a clear `Error` when a setting is invalid — the message is shown to the user
- Call `_ui.progress()` in long loops

## After your PR is merged

Merging does not ship anything. A maintainer tags a release
(`git tag vX.Y.Z && git push origin vX.Y.Z`), which builds every plugin ZIP,
regenerates `index.json` with a fresh checksum per plugin, and attaches both to
the release. That is the point at which

```bash
npx @lexicon-plugins/install update
```

starts offering your version to people who already have the plugin. If you need
a release cut, say so in the PR.

## Reporting a harness bug

If the harness and real Lexicon disagree, that's a bug worth fixing for everyone.
Open an issue with:

- What the harness did
- What Lexicon actually did
- Your Lexicon version
- Ideally, output from `tools/conformance-probe/`

## Code of conduct

Be decent to each other. Plugins are a hobby for most people here.
