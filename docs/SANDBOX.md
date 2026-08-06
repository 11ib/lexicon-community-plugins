# The Lexicon plugin sandbox

What you can and can't write inside a Lexicon plugin action.

Some of this is in the [official docs](https://www.lexicondj.com/docs/developers/plugin).
The rest was found by running probe plugins against a real Lexicon install and
reading what broke — those entries are marked **(probed)** with the actual error
message Lexicon produced.

Everything here is enforced by `npm run lint`, and the rules themselves are
tested in [`tests/sandbox-rules.test.js`](../tests/sandbox-rules.test.js).

---

## The execution model

An action file is **not a module**. It's a bare async function body. Lexicon
injects the globals and runs it — there's no wrapper to write, nothing to
export, and top-level `await` is legal.

```js
// This is a complete, valid action file.
for (const track of _vars.tracksSelected) {
  track.rating = 5
}

_helpers.Report('Done')
```

You change the library by **mutating the objects you were handed**. There is no
save call. Lexicon diffs the objects after your script returns and persists what
changed — subject to your `modifyFields` permission, which is where it gets
dangerous (see below).

---

## Syntax restrictions

### Documented

| Don't | Do | Why |
| --- | --- | --- |
| `if (x) doThing()` | `if (x) {\n  doThing()\n}` | Parser rejects brace-less bodies |
| `do { ... } while (x)` | `while (x) { ... }` | `do-while` is not supported |
| `for (...) { ... };` | `for (...) { ... }` | Trailing semicolon after a block is an "unexpected token" |
| `{ name }` | `{ name: name }` | Object shorthand is not supported |

### Undocumented (probed)

**Optional chaining `?.` does not parse.**

```
Execution failed: Unexpected token after inlineIf: ?: ? "71"
```

The ternary `?:` works fine — it's specifically `?.` that breaks. This is the
one most likely to bite you, because it's everywhere in modern JavaScript.

```js
// Breaks the whole action
const id = playlist?.parent?.id

// Works
let id = null

if (playlist && playlist.parent) {
  id = playlist.parent.id
}
```

**`Object.prototype` access is blocked.**

```
Execution failed: Static method or property access not permitted: Object.prototype
```

```js
// Breaks
const has = Object.prototype.hasOwnProperty.call(obj, key)

// Works
const has = Object.keys(obj).includes(key)
```

**A `catch` binding inside a nested function doesn't work.**

```
Execution failed: err is not defined
```

A top-level `try/catch` works correctly. Inside a function declaration, arrow
function, or function expression, the catch parameter isn't bound.

```js
// Breaks — err is not defined at runtime
function risky() {
  try {
    return doThing()
  } catch (err) {
    return err.message
  }
}

// Works — keep try/catch at the top level
let result = null

try {
  result = doThing()
} catch (err) {
  _helpers.Log(err.message)
}
```

### Environment

No `require()`, no `import`, no `window`, no `document`. Use `_network.GET` /
`_network.POST` instead of `fetch`. Don't construct functions dynamically —
`eval` and `new Function` are both blocked by lint, and reviewers reject
generated or minified code regardless.

---

## The silent failure you need to know about

**Writes to fields outside `modifyFields` are silently discarded.**

This is the single most important thing on this page. An action declaring
`modifyFields: ["extra1"]` that writes both `extra1` and `extra2` will:

- not throw on either assignment
- read both values back correctly in memory
- report success to the user
- have Lexicon log `Saved changes to 8 tracks(s)`

...and only `extra1` reaches the database. Assigning a property that isn't part
of the track schema at all is dropped the same way.

There is **no runtime signal**. Your plugin appears to work and silently does
half its job.

This is why the harness enforces `modifyFields` strictly — a test throws
`PermissionError` where Lexicon would just shrug. `npm run check:permissions`
catches it statically too, before the code ever runs.

Practical rule: every field you assign must be in `modifyFields`, and every
entry in `modifyFields` should be a field you actually assign. CI warns on the
second half.

---

## Verified runtime behaviour

All **(probed)** against a real library of 66,422 tracks.

| Behaviour | Value |
| --- | --- |
| `_library.track.getNextAllBatch()` page size | exactly **1000**, ids ascending |
| ...returns | a Promise — `await` it |
| ...end signal | an empty array |
| `_storage.save` / `_storage.load` | **synchronous** — they do not return promises |
| `_storage.load(unsetKey)` | `null` |
| Storage type fidelity | string, number, boolean, `null`, array, nested object all survive |
| Storage and `Date` | **does not survive** — saved as an ISO string, reads back as a string |

```js
// Wrong — throws in Lexicon, the value is a string by now
_storage.save('lastRun', new Date())
const when = _storage.load('lastRun')
when.getTime()

// Right
const when = new Date(_storage.load('lastRun'))
```

### Track objects

Tracks handed to a plugin carry four fields that aren't in the Local API's
`Track` schema: `releaseDate`, `hasCuepoints`, `hasTempomarkers`,
`cloudFileState`. Full default shape lives in
[`runtime-spec.js`](../packages/harness/src/runtime-spec.js).

### Playlists

`playlist.getTrackIds()` is the fast path; `playlist.getTracks()` returns full
track objects and is slower. Both are async. A playlist object does **not**
expose `trackIds` until you call `getTrackIds()`.

---

## Still unverified

The harness marks these `source: 'guess'` in
[`runtime-spec.js`](../packages/harness/src/runtime-spec.js). If you can settle
one, that's a valuable PR:

- What happens when an action touches a capability it wasn't granted — throw,
  silent `undefined`, or no enforcement at all? The harness currently assumes it
  throws.
- What `_settings[key]` returns for a key not declared in `config.json`.
- Whether `_vars.playlistsAll` is flat or nested.
- Which modern syntax beyond `?.` the parser rejects (`??`, spread,
  destructuring, template literals).

[`tools/conformance-probe/`](../tools/conformance-probe/) is the plugin that
answers these. See its README for how to run it.

---

## Reporting a difference

If the harness and real Lexicon disagree, that's a bug worth fixing for
everyone. Open an issue with what each did, your Lexicon version, and ideally
the probe output.
