# The plugin registry index

A JSON document describing every plugin in this repo, published as a release
asset on every tagged release:

**https://github.com/11ib/lexicon-community-plugins/releases/latest/download/index.json**

It exists so that installing a plugin does not require downloading a ZIP by
hand and dragging it into a folder. `@lexicon-plugins/install` consumes it
today; it is also everything an in-app plugin browser would need, which is why
this document is a spec rather than a note.

## Consuming it

Four steps, no server and no account:

1. `GET index.json`. Cache it on `ETag`; it changes only when a release is cut.
2. Show the user `name`, `description`, `keywords`, `version`, and
   `permissions` — the last one is a plain-language summary of everything the
   plugin can reach, generated from its manifest rather than written by hand.
3. On install: `GET zipUrl`, check the bytes against `sha256`, unpack into
   `Documents/Lexicon/Plugins/<folder>`, reload.
4. For an update badge: compare `version` against the `version` field in the
   installed plugin's `config.json`.

Step 3's checksum is the load-bearing part. `zipUrl` on a released index is
pinned to that release's tag, never to `latest`, so the hash always describes
exactly the bytes the URL serves.

## Format

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-08-16T17:53:33.613Z",
  "repository": "https://github.com/11ib/lexicon-community-plugins",
  "plugins": [
    {
      "id": "lexicon-community.example-energy-rating",
      "folder": "example-energy-rating",
      "name": "example-energy-rating",
      "description": "Converts each selected track's energy value into a 0-5 star rating.",
      "version": "1.0.0",
      "keywords": ["energy", "rating", "stars", "playlist", "example"],
      "author": { "name": "Lexicon Community", "email": "…" },
      "actions": [
        {
          "id": "energy.to.rating",
          "name": "Energy To Star Rating",
          "description": "Converts each selected track's energy value into a 0-5 star rating."
        }
      ],
      "permissions": [
        "track: read selected, modify selected (rating)",
        "playlist: read all, modify all (name)"
      ],
      "zipUrl": "https://github.com/…/releases/download/v0.1.0/example-energy-rating.zip",
      "zipName": "example-energy-rating.zip",
      "size": 1603,
      "sha256": "65fe60a9…"
    }
  ]
}
```

### Top level

| Field | |
| --- | --- |
| `schemaVersion` | Integer. Currently `1`. See the compatibility rules below |
| `generatedAt` | ISO 8601, when the index was built |
| `repository` | Where the plugins come from |
| `plugins` | Array, sorted by folder name |

### Per plugin

| Field | | |
| --- | --- | --- |
| `id` | string | Lexicon's plugin id, from `config.json`. Unique across the index; CI rejects duplicates |
| `folder` | string | Directory name to unpack into. Never contains a path separator |
| `name` | string | Display name. Falls back to the folder name |
| `description` | string | Falls back to the first action's description |
| `version` | string \| **null** | Semver. `null` for plugins written before versioning — treat as "cannot compare", not as "old" |
| `keywords` | string[] | May be empty. For search |
| `author` | object | `name`, plus `email` and/or `discordUsername` |
| `actions` | object[] | `id`, `name`, `description` per action. What the plugin actually does |
| `permissions` | string[] | Display strings, unioned across all actions. May be empty |
| `zipUrl` | string | Direct download. Pinned to the release tag |
| `zipName` | string | Asset filename |
| `size` | number | Bytes |
| `sha256` | string | Lowercase hex, 64 chars, of the ZIP at `zipUrl` |

Every ZIP has `config.json` at its root — no wrapping directory — which is what
Lexicon expects in the Plugins folder. `__tests__` folders are stripped at build
time, so nothing ships that a user should not have.

## Compatibility

`schemaVersion` is the contract. Within a major version, changes are additive
only: new optional fields may appear, existing fields never change meaning or
type and are never removed. A consumer should ignore fields it does not know
and **refuse an index whose `schemaVersion` is higher than it understands**,
rather than guessing.

`version: null` is the one field that needs a deliberate decision rather than a
default. `@lexicon-plugins/install` treats it as un-comparable: `update` skips
those plugins and says why, instead of reinstalling them on every run.

## Trust model

Everything in the index comes from a merged pull request. Every PR runs four
gates in CI before it can land:

| Gate | Catches |
| --- | --- |
| Sandbox lint | Syntax Lexicon's parser rejects — the plugin would not load at all |
| Manifest validation | Malformed `config.json`, missing action files, missing tests |
| Permission check | Code using a capability its manifest never asked for, and manifests asking for more than the code uses |
| Harness tests | Actual behaviour, against a fake library |

The `permissions` array is generated from the validated manifests, so it cannot
drift from what the plugin is actually allowed to do. Network access is
restricted to explicitly listed domains — wildcards are rejected — and reviewed
by hand on every PR.

This is community code with a review gate, not audited code. A client
displaying it should say so. If stronger guarantees are wanted, signing the
index (and pinning a public key in the client) is the natural next step; ask.

## Notes for a client that is not a CLI

- **Multiple registries.** Nothing in this format is specific to this repo.
  A client is better off taking a *list* of index URLs in its settings, with
  this one as a default entry, than hardcoding a single source.
- **CORS.** The release-asset URL redirects to `objects.githubusercontent.com`.
  If the fetch happens somewhere subject to CORS, that redirect should be
  checked before committing to it — a GitHub Pages copy at a stable URL can be
  published alongside, and Pages sends permissive CORS headers.
- **Reference implementation.** `packages/install/src/` is about 400 lines end
  to end. `registry.js` fetches and validates the index, `download.js` verifies
  the checksum, `extract.js` unpacks with the archive-entry checks that any
  client accepting ZIPs from the internet needs (no absolute paths, no
  traversal, no symlinks), and `install.js` stages the extraction and swaps it
  into place so a failed install cannot leave a half-written plugin folder.
