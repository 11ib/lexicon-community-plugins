import { describe, it, expect } from 'vitest'
import { compareVersions, parseVersion } from '../src/versions.js'

describe('parseVersion', () => {
  it('accepts a leading v', () => {
    expect(parseVersion('v1.2.3')).toMatchObject({ major: 1, minor: 2, patch: 3, prerelease: null })
  })

  it('rejects anything that is not three numbers', () => {
    for (const value of ['1.2', '1.2.3.4', 'latest', '', null, undefined, 3]) {
      expect(parseVersion(value)).toBeNull()
    }
  })
})

describe('compareVersions', () => {
  it('orders by major, minor, then patch', () => {
    expect(compareVersions('1.0.0', '2.0.0')).toBe(-1)
    expect(compareVersions('1.2.0', '1.10.0')).toBe(-1)
    expect(compareVersions('1.0.9', '1.0.10')).toBe(-1)
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1)
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
  })

  it('sorts a prerelease before its release', () => {
    expect(compareVersions('1.0.0-beta', '1.0.0')).toBe(-1)
    expect(compareVersions('1.0.0', '1.0.0-beta')).toBe(1)
    expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBe(-1)
  })

  // The whole point: "cannot tell" is a distinct answer from "older", so the
  // installer can refuse to guess instead of reinstalling on every run.
  it('returns null when either side is missing or unparseable', () => {
    expect(compareVersions(null, '1.0.0')).toBeNull()
    expect(compareVersions('1.0.0', undefined)).toBeNull()
    expect(compareVersions('dev', '1.0.0')).toBeNull()
  })
})
