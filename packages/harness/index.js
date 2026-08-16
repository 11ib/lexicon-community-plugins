// Test harness for Lexicon DJ plugins.
//
//   import { runAction } from '@lexicon-plugins/harness'
//
//   const run = await runAction({
//     plugin: 'plugins/bpm-tools',
//     action: 'halve.double',
//     tracks: [{ id: 1, title: 'Track', bpm: 174 }],
//     selected: [1]
//   })
//
//   expect(run.trackById(1).bpm).toBe(87)
//   expect(run.report).toEqual(['Updated 1 track'])
//
// Permissions come from the plugin's real config.json, so a run fails here for
// the same reason it would fail in Lexicon.

export { runAction, loadPlugin } from './src/runner.js'
export { PermissionError } from './src/permissions.js'
export {
  makeTrack,
  makePlaylist,
  makeCustomTag,
  makeCustomTagCategory
} from './src/library.js'
export { RUNTIME_SPEC, TRACK_DEFAULTS, PLAYLIST_DEFAULTS, PLAYLIST_TYPE } from './src/runtime-spec.js'
