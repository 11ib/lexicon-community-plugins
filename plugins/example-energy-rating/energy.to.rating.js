// Converts Lexicon's energy value (1-10) into a 0-5 star rating.

const energyPerStar = Number(_settings['Energy Per Star'])

if (!Number.isFinite(energyPerStar) || energyPerStar <= 0) {
  throw new Error('"Energy Per Star" must be a positive number')
}

let updated = 0
let skipped = 0

for (const track of _vars.tracksSelected) {
  if (!track.energy) {
    skipped += 1
    continue
  }

  let stars = Math.round(track.energy / energyPerStar)

  if (stars > 5) {
    stars = 5
  }

  if (stars < 0) {
    stars = 0
  }

  if (track.rating !== stars) {
    track.rating = stars
    updated += 1
  }
}

_helpers.Log('Energy per star: ' + energyPerStar)
_helpers.Report('Updated ' + updated + ' track(s)')

if (skipped > 0) {
  _helpers.Report('Skipped ' + skipped + ' track(s) with no energy value')
}
