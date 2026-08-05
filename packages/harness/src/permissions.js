// Permission enforcement, driven by the action's real config.json.
//
// The point: a plugin that passes its tests should not then hit a permission
// wall on a user's machine. So the harness refuses the same things Lexicon
// refuses, using the same manifest.

export class PermissionError extends Error {
  constructor(capability, needed) {
    super(`Permission denied: ${capability}. Add ${needed} to this action's config.json permissions.`)
    this.name = 'PermissionError'
    this.capability = capability
    this.needed = needed
  }
}

export function createPermissionChecker(permissions = {}, options = {}) {
  const strict = options.strict !== false
  const denials = []

  const track = permissions.track ?? {}
  const playlist = permissions.playlist ?? {}
  const customTag = permissions.customTag ?? {}
  const files = permissions.files ?? {}
  const network = permissions.network ?? {}

  function scope(value, name) {
    return Array.isArray(value) && value.includes(name)
  }

  function deny(capability, needed) {
    denials.push({ capability: capability, needed: needed })

    if (strict) {
      throw new PermissionError(capability, needed)
    }
  }

  function require(granted, capability, needed) {
    if (!granted) {
      deny(capability, needed)
      return false
    }

    return true
  }

  // Domain matching for _network. A whitelist entry matches the host itself
  // and any subdomain of it, which is how a reviewer would read it.
  function hostAllowed(url, list) {
    let host

    try {
      host = new URL(url).hostname.toLowerCase()
    } catch {
      return false
    }

    return (list ?? []).some((entry) => {
      const allowed = String(entry)
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '')

      return host === allowed || host.endsWith(`.${allowed}`)
    })
  }

  return {
    denials: denials,

    trackRead(kind) {
      return require(scope(track.read, kind), `track.read (${kind})`, `track.read: ["${kind}"]`)
    },

    trackReadAny() {
      return require(
        scope(track.read, 'all') || scope(track.read, 'selected'),
        'track.read',
        'track.read'
      )
    },

    trackModify(kind, field) {
      if (!require(scope(track.modify, kind), `track.modify (${kind})`, `track.modify: ["${kind}"]`)) {
        return false
      }

      const fields = track.modifyFields ?? []

      if (!fields.includes(field)) {
        deny(
          `track.modifyFields (${field})`,
          `"${field}" in track.modifyFields (currently [${fields.join(', ')}])`
        )
        return false
      }

      return true
    },

    trackCreate() {
      return require(track.create === true, 'track.create', 'track.create: true')
    },

    trackDelete() {
      return require(track.delete === true, 'track.delete', 'track.delete: true')
    },

    playlistRead(kind) {
      return require(scope(playlist.read, kind), `playlist.read (${kind})`, `playlist.read: ["${kind}"]`)
    },

    playlistModify(kind, field) {
      if (!require(scope(playlist.modify, kind), `playlist.modify (${kind})`, `playlist.modify: ["${kind}"]`)) {
        return false
      }

      const fields = playlist.modifyFields ?? []
      const declared = field === 'trackIds' ? 'tracks' : field

      if (!fields.includes(declared)) {
        deny(
          `playlist.modifyFields (${declared})`,
          `"${declared}" in playlist.modifyFields (currently [${fields.join(', ')}])`
        )
        return false
      }

      return true
    },

    playlistCreate() {
      return require(playlist.create === true, 'playlist.create', 'playlist.create: true')
    },

    playlistDelete() {
      return require(playlist.delete === true, 'playlist.delete', 'playlist.delete: true')
    },

    customTagRead() {
      return require(Array.isArray(customTag.read) && customTag.read.length > 0, 'customTag.read', 'customTag.read: ["all"]')
    },

    customTagModify() {
      return require(Array.isArray(customTag.modify) && customTag.modify.length > 0, 'customTag.modify', 'customTag.modify: ["all"]')
    },

    customTagCreate() {
      return require(customTag.create === true, 'customTag.create', 'customTag.create: true')
    },

    customTagDelete() {
      return require(customTag.delete === true, 'customTag.delete', 'customTag.delete: true')
    },

    storage() {
      return require(permissions.storage === true, 'storage', 'storage: true')
    },

    control() {
      return require(permissions.control === true, 'control', 'control: true')
    },

    filesWrite() {
      return require(files.write === true, 'files.write', 'files.write: true')
    },

    filesRead() {
      return require(files.read === true, 'files.read', 'files.read: true')
    },

    filesList() {
      return require(files.list === true, 'files.list', 'files.list: true')
    },

    networkGet(url) {
      if (!require(Array.isArray(network.GET) && network.GET.length > 0, 'network.GET', 'network.GET: ["domain.com"]')) {
        return false
      }

      if (!hostAllowed(url, network.GET)) {
        deny(`network.GET (${url})`, `the host of ${url} in network.GET (currently [${network.GET.join(', ')}])`)
        return false
      }

      return true
    },

    networkPost(url) {
      if (!require(Array.isArray(network.POST) && network.POST.length > 0, 'network.POST', 'network.POST: ["domain.com"]')) {
        return false
      }

      if (!hostAllowed(url, network.POST)) {
        deny(`network.POST (${url})`, `the host of ${url} in network.POST (currently [${network.POST.join(', ')}])`)
        return false
      }

      return true
    }
  }
}
