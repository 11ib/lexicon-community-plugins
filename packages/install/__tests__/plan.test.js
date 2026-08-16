import { describe, it, expect } from 'vitest'
import { planInstall, planUpdate } from '../src/install.js'

const entry = { id: 'tester.demo', folder: 'demo', version: '1.1.0' }

describe('planInstall', () => {
  it('installs when nothing is there', () => {
    expect(planInstall(entry, null)).toMatchObject({ action: 'install' })
  })

  it('updates an older install', () => {
    expect(planInstall(entry, { version: '1.0.0' })).toMatchObject({ action: 'update', reason: '1.0.0 → 1.1.0' })
  })

  it('skips an identical version', () => {
    expect(planInstall(entry, { version: '1.1.0' })).toMatchObject({ action: 'skip' })
  })

  it('refuses to downgrade without --force', () => {
    expect(planInstall(entry, { version: '2.0.0' })).toMatchObject({ action: 'skip' })
    expect(planInstall(entry, { version: '2.0.0' }, { force: true })).toMatchObject({ action: 'reinstall' })
  })

  // An explicit `install <id>` is a request, so an unknown local version gets
  // reinstalled rather than skipped.
  it('reinstalls when the installed version is unknown', () => {
    expect(planInstall(entry, { version: null })).toMatchObject({ action: 'reinstall' })
  })
})

describe('planUpdate', () => {
  it('skips what is not installed', () => {
    expect(planUpdate(entry, null)).toMatchObject({ action: 'skip', reason: 'not installed' })
  })

  it('updates an older install', () => {
    expect(planUpdate(entry, { version: '1.0.0' })).toMatchObject({ action: 'update' })
  })

  it('skips an up-to-date install', () => {
    expect(planUpdate(entry, { version: '1.1.0' })).toMatchObject({ action: 'skip', reason: 'up to date (1.1.0)' })
  })

  // The opposite call from planInstall, and the reason unversioned plugins
  // warn in validate-configs: a sweep must not churn what it cannot compare.
  it('leaves an unversioned install alone and says why', () => {
    const plan = planUpdate(entry, { version: null })

    expect(plan.action).toBe('skip')
    expect(plan.reason).toMatch(/--force/)
    expect(planUpdate(entry, { version: null }, { force: true })).toMatchObject({ action: 'update' })
  })
})
