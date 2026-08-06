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

**Optional chaining `?.` and nullish coalescing `??` do not parse.**

```
Execution failed: Unexpected token after inlineIf: ?: ? "71"
Execution failed: Unexpected token after inlineIf: ?: ? "0"
```

The ternary `?:` works fine — the parser breaks on anything else following a
`?`. These two are the most likely to bite you, because they're everywhere in
modern JavaScript.

```js
// Breaks the whole action
const id = playlist?.parent?.id
const name = playlist.name ?? 'Untitled'

// Works
let id = null

if (playlist && playlist.parent) {
  id = playlist.parent.id
}

let name = playlist.name

if (name === null || name === undefined) {
  name = 'Untitled'
}
```

**Destructuring does not parse.**

```
Execution failed: Unexpected token after prop: {: const { alpha } = source
```

```js
// Breaks
const { alpha } = source
const [first] = items

// Works
const alpha = source.alpha
const first = items[0]
```

Template literals and spread **do** work — both verified in isolation.

**Default parameter values do not parse.**

```
Execution failed: Unexpected token after prop: w: function withDefault(value = "0")
```

```js
// Breaks
function suffix(name, separator = ' - ') {
  return name + separator
}

// Works
function suffix(name, separator) {
  if (separator === undefined) {
    separator = ' - '
  }

  return name + separator
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

## Manifest restrictions

**Action `name` accepts only letters, numbers, dots, spaces, dash and
underscore.** (probed)

A single stray character takes down the **entire plugin** — every action in it —
at load time:

```
Some plugin(s) failed to load.
DEVELOPMENT conformance-probe: invalid config: action "name" property may only
contain characters a-z, numbers, dots, spaces, dash and underscore.
```

The message doesn't say which action is at fault, so on a plugin with a dozen
actions you're bisecting by hand. Characters that look harmless but break it:

| Rejected | Example |
| --- | --- |
| `:` colon | `Probe 1: Environment` |
| `/` slash | `Syntax try/catch` |
| `()` parentheses | `Rename Playlists (fast)` |
| `&` ampersand | `Drum & Bass Tagger` |
| emoji | `Tag Tracks 🚀` |

`npm run validate` enforces this, so CI catches it before you spend a restart
cycle on it.

Note this applies to the action `name` (what the user sees in the menu), not the
action `id` — ids with dots like `energy.to.rating` are fine.

**`author` must carry a contact route.** (probed)

The docs list `discordUsername` and `email` as optional. They are not — a plugin
with neither fails to load:

```
invalid config: plugin property "author.discordUsername" or "author.email" is required
```

```json
{
  "author": {
    "name": "Your Name",
    "email": "you@example.com"
  }
}
```

Either field satisfies it. `npm run validate` enforces this.

---

## Where the official docs are wrong

**`_vars.customTagsCategories` does not exist.** The real key is
**`_vars.customTagCategories`** — no `s` after `customTag`.

The documented spelling returns `undefined`, and the next property access kills
the action with a bare `Cannot get property 'length' of undefined` that points
nowhere useful. Confirmed by enumerating the live object:

```js
Object.keys(_vars)
// ['tracksSelected', 'tracksAllAmount', 'playlistsAll',
//  'playlistsSelected', 'customTags', 'customTagCategories']
```

**A custom tag's text is `label`, not `name`.** The real shape:

```js
{ id: 4, categoryId: 1, label: 'Bass', position: 1, shortcut: 2 }
```

The harness throws a named error for both mistakes rather than handing back
`undefined` the way Lexicon does.

---

## Some failures halt your script silently

Worse than an error: certain guard violations **terminate the action where it
stands**. Not an exception — execution simply stops.

- nothing is written to the plugin log
- no error is shown to the user
- a surrounding `try/catch` does **not** run
- Lexicon reports the run as completed, with a normal `Execution took Nms`

**Confirmed cause: assigning to an injected global.** A probe stopped dead on
`_settings['AString'] = 'x'` — the stage marker before it was written, the one
after it never was, and the surrounding `try/catch` never ran.

```js
// Halts here. Silently. Nothing after this line executes.
_settings['Some Setting'] = 'override'
_vars.tracksSelected = []
```

Mutating a track or playlist you were *handed* is fine — that's the normal way
to persist changes. It's assigning to the globals themselves that kills it.
`npm run lint` rejects this.

Also observed for a denied capability access and at least one blocked static
built-in, both still being narrowed down.

```js
// If playlistsAll is not granted, execution stops HERE.
// The catch never runs. The report never happens. Nothing is logged.
try {
  const all = _vars.playlistsAll
} catch (err) {
  _helpers.Log('this line is unreachable')
}

_helpers.Report('so is this one')
```

**You cannot defend against this at runtime.** The only defence is not writing
the offending code — which is what `npm run lint` and `npm run check:permissions`
are for. A plugin that asks for the wrong permissions doesn't fail loudly on a
user's machine; it quietly does part of its job and stops.

### Debugging a probe that vanishes

If an action completes with no error and no visible effect, it halted. To find
where, write a stage marker after every step:

```js
const results = { lastCompleted: 'none' }

function save() {
  _files.write('debug.json', JSON.stringify(results, null, 2))
}

save()

const all = _vars.playlistsAll
results.lastCompleted = 'read playlistsAll'
save()
```

The last value in the file is the step before the one that killed it. Every
probe in [`tools/conformance-probe/`](../tools/conformance-probe/) uses this
pattern.

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

The harness marks these `source: 'guess'` or `'probe-pending'` in
[`runtime-spec.js`](../packages/harness/src/runtime-spec.js). If you can settle
one, that's a valuable PR:

- **What a denied capability actually does.** Halt is strongly suspected, but
  the probe that would prove it kept halting for an unrelated reason. The
  harness currently throws, which is stricter than the app either way.
- **Which static built-in is blocked**, beyond `Object.prototype`.
- **Whether repeated `catch (err)` blocks collide.** Two probes halted inside
  their first of many sibling `try/catch` blocks, all reusing the same
  parameter name — suggesting the sandbox flattens block scope. If true,
  ordinary defensive JavaScript is unwritable here.
- The shape of a custom tag category object.

[`tools/conformance-probe/`](../tools/conformance-probe/) is the plugin that
answers these. See its README for how to run it.

---

## Reporting a difference

If the harness and real Lexicon disagree, that's a bug worth fixing for
everyone. Open an issue with what each did, your Lexicon version, and ideally
the probe output.
