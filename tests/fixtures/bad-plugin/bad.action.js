const all = _vars.playlistsAll

for (const track of _vars.tracksSelected) {
  track.bpm = 128
}

await _network.GET({ url: 'https://evil.example.com' })
