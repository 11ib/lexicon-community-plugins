// Just enough semver to answer "is the index newer than what is on disk".
//
// Anything unparseable — including the missing version on plugins written
// before the registry existed — compares as null, and callers treat that as
// "cannot tell", not as "older". Silently reinstalling on every `update` run
// because a plugin has no version would be worse than saying so.

const VERSION = /^\s*v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?\s*$/

export function parseVersion(value) {
  if (typeof value !== 'string') {
    return null
  }

  const match = VERSION.exec(value)

  if (!match) {
    return null
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null
  }
}

// -1 a<b, 0 equal, 1 a>b, null if either side is unparseable.
export function compareVersions(a, b) {
  const left = parseVersion(a)
  const right = parseVersion(b)

  if (!left || !right) {
    return null
  }

  for (const part of ['major', 'minor', 'patch']) {
    if (left[part] !== right[part]) {
      return left[part] < right[part] ? -1 : 1
    }
  }

  if (left.prerelease === right.prerelease) {
    return 0
  }

  // 1.0.0-beta precedes 1.0.0.
  if (left.prerelease === null) {
    return 1
  }
  if (right.prerelease === null) {
    return -1
  }

  return left.prerelease < right.prerelease ? -1 : 1
}
