# @lexicon-community/install

Installs [Lexicon DJ](https://www.lexicondj.com) community plugins from the
command line, instead of downloading a ZIP and dragging it into a folder.

```bash
npx @lexicon-community/install install lexicon-community.example-energy-rating
npx @lexicon-community/install install --all
npx @lexicon-community/install update
npx @lexicon-community/install list
```

Restart Lexicon afterwards — it reads the Plugins folder at startup.

## What it does

Reads `index.json` from the latest release of
[lexicon-community-plugins](https://github.com/11ib/lexicon-community-plugins),
downloads the plugin's ZIP, checks it against the `sha256` in the index,
unpacks it into a staging folder, and only then swaps it into place. A failed
download, a checksum mismatch or a malformed archive leaves whatever was
already installed untouched.

Plugins go to `Documents/Lexicon/Plugins` — `%USERPROFILE%\Documents\...` on
Windows, `$HOME/Documents/...` elsewhere. If your Documents folder is
redirected (OneDrive, for instance), pass `--dir`.

## Commands

| Command | |
| --- | --- |
| `install <plugin>...` | install, or update if an older version is on disk |
| `install --all` | every plugin in the index |
| `update [<plugin>...]` | update what is installed; no arguments sweeps everything |
| `list` | the index, and what is installed from it |

A plugin can be named by its full id (`lexicon-community.example-energy-rating`),
its folder (`example-energy-rating`), or the part after the last dot, as long as
that is unambiguous.

## Options

| Flag | |
| --- | --- |
| `--dir <path>` | Plugins folder to install into. Also `LEXICON_PLUGINS_DIR` |
| `--index <url\|path>` | registry to read. A local path works, and its relative `zipUrl`s resolve next to it — useful for testing a release before publishing |
| `--force` | reinstall even when the installed version looks current, and allow downgrades |
| `--json` | machine-readable output |

## Versions

Update detection compares the `version` in the index against the `version` in
the installed plugin's `config.json`. A plugin with no version — anything
written before the registry existed — is left alone by `update`, which reports
it rather than reinstalling on every run. `install --force` replaces it.

## Installed state

There is no lockfile. The Plugins folder is the state: every plugin there has a
`config.json` with an id, so a plugin you unzipped by hand is seen exactly like
one this CLI installed, and deleting a folder is a complete uninstall.
