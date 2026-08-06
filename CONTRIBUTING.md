# Contributing

New to Lexicon plugins? Read the [README](README.md) first — it covers the
execution model and the harness API. This file covers the process.

## Adding a plugin

```bash
mkdir -p plugins/my-plugin/__tests__
```

1. Write `plugins/my-plugin/config.json` — one `id` per plugin, one entry in
   `actions` per action
2. Write `plugins/my-plugin/<action-id>.js` for each action (filename must match
   the action id exactly)
3. Write `plugins/my-plugin/__tests__/<action-id>.test.js` — required, CI fails
   without it
4. Run `npm run verify`
5. Install it in a real Lexicon and run it against a library you don't mind
   changing
6. Open a PR

Copy `plugins/example-energy-rating/` as a starting point.

## What CI checks

`npm run verify` runs the same four gates CI does:

```bash
npm run lint               # Lexicon's parser restrictions
npm run validate           # config.json schema, file/action/test pairing
npm run check:permissions  # code vs. manifest, both directions
npm test                   # your tests
```

The permission check reports two kinds of problem:

- **errors** — your code uses something the manifest doesn't grant. This would
  fail at runtime for every user.
- **warnings** — your manifest grants something the code never uses. Not fatal,
  but a reviewer will ask you to remove it.

## Permissions

Plugins run inside other people's libraries. Ask for as little as possible.

**Permissions are not a sandbox.** Probing a real Lexicon showed that most
capabilities stay callable regardless of what `config.json` declares — an action
granted only `track.read` still sees working functions for `playlist.create`,
`_storage.save`, `_network.GET`, `_files.read` and `_ui.control`. Only certain
scope-gated read accessors are actually withheld, and a denied read returns
`null` rather than raising.

So the manifest is a **statement of intent to reviewers**, not an enforced
boundary. Review what the code *does*, not what it *declares*. `npm run
check:permissions` flags mismatches in both directions, but a reviewer reading
the diff is the real control.

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

## Reporting a harness bug

If the harness and real Lexicon disagree, that's a bug worth fixing for everyone.
Open an issue with:

- What the harness did
- What Lexicon actually did
- Your Lexicon version
- Ideally, output from `tools/conformance-probe/`

## Code of conduct

Be decent to each other. Plugins are a hobby for most people here.
