// Renames every playlist so it ends with its track count, e.g. "Techno (42)".
// Folders and smartlists are left alone.

const SUFFIX_PATTERN = / \(\d+\)$/

let renamed = 0

for (const playlist of _vars.playlistsAll) {
  if (playlist.type !== '2') {
    continue
  }

  const trackIds = await playlist.getTrackIds()
  const baseName = playlist.name.replace(SUFFIX_PATTERN, '')
  const nextName = baseName + ' (' + trackIds.length + ')'

  if (playlist.name !== nextName) {
    playlist.name = nextName
    renamed += 1
  }
}

_helpers.Report('Renamed ' + renamed + ' playlist(s)')
