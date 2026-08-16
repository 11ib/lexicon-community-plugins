// Test fixtures: real ZIPs, a real index.json, and a real HTTP server. The
// installer's whole job is handling bytes it did not create, so nothing here
// is mocked below the network boundary.

import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import yazl from 'yazl'

export function tempDir(prefix = 'lexicon-install-test-') {
  return mkdtempSync(join(tmpdir(), prefix))
}

// files: { 'config.json': '...', 'nested/file.js': '...' }
// entries: raw [name, contents, options] triples, for the hostile cases.
export function makeZip(files = {}, entries = []) {
  return new Promise((resolve, reject) => {
    const zip = new yazl.ZipFile()

    for (const [name, contents] of Object.entries(files)) {
      zip.addBuffer(Buffer.from(contents), name)
    }

    for (const [name, contents, options] of entries) {
      zip.addBuffer(Buffer.from(contents), name, options)
    }

    const chunks = []

    zip.outputStream.on('data', (chunk) => chunks.push(chunk))
    zip.outputStream.on('error', reject)
    zip.outputStream.on('end', () => resolve(Buffer.concat(chunks)))

    zip.end()
  })
}

// yazl refuses to write a traversal path, which is exactly the archive the
// extractor has to survive. Build it with a same-length placeholder name and
// patch the bytes — the name appears in the local header and again in the
// central directory, so every occurrence is replaced.
export async function makeZipWithRawName(placeholder, rawName, contents = 'pwned') {
  if (placeholder.length !== rawName.length) {
    throw new Error(`placeholder "${placeholder}" and raw name "${rawName}" must be the same length`)
  }

  const zip = await makeZip({ [placeholder]: contents })
  const from = Buffer.from(placeholder, 'utf8')
  const to = Buffer.from(rawName, 'utf8')

  let at = zip.indexOf(from)

  while (at !== -1) {
    to.copy(zip, at)
    at = zip.indexOf(from, at + to.length)
  }

  return zip
}

export function pluginConfig(overrides = {}) {
  return {
    id: 'tester.demo',
    version: '1.0.0',
    keywords: ['demo'],
    author: { name: 'Tester', email: 'tester@example.com' },
    actions: [
      {
        id: 'demo.action',
        name: 'Demo Action',
        description: 'Does a demonstrable thing to the selected tracks.',
        config: {
          permissions: {
            track: { read: ['selected'], modify: ['selected'], modifyFields: ['rating'] }
          }
        }
      }
    ],
    ...overrides
  }
}

export async function pluginZip(config) {
  return makeZip({
    'config.json': JSON.stringify(config, null, 2),
    'demo.action.js': '_helpers.Report("ok")\n'
  })
}

export function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

// Serves index.json plus one ZIP per plugin. Returns { url, indexUrl, close,
// setZip } so a test can swap in corrupt bytes after the index was built.
export async function startRegistry(plugins) {
  const zips = new Map()
  const entries = []

  for (const plugin of plugins) {
    const config = plugin.config
    const folder = plugin.folder
    const zipName = `${folder}.zip`
    const buffer = plugin.buffer ?? (await pluginZip(config))

    zips.set(zipName, buffer)

    entries.push({
      id: config.id,
      folder: folder,
      name: folder,
      description: config.actions[0].description,
      version: config.version ?? null,
      keywords: config.keywords ?? [],
      author: config.author,
      actions: config.actions.map((action) => ({ id: action.id, name: action.name, description: action.description })),
      permissions: plugin.permissions ?? ['track: read selected, modify selected (rating)'],
      zipUrl: `ZIP_BASE/${zipName}`,
      zipName: zipName,
      size: buffer.length,
      sha256: plugin.sha256 ?? sha256(buffer)
    })
  }

  let index = { schemaVersion: 1, generatedAt: '2026-01-01T00:00:00.000Z', plugins: entries }

  const server = createServer((req, res) => {
    const path = req.url.split('?')[0]

    if (path === '/index.json') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(index))
      return
    }

    const zip = zips.get(path.replace(/^\//, ''))

    if (!zip) {
      res.writeHead(404)
      res.end('not found')
      return
    }

    res.writeHead(200, { 'content-type': 'application/zip', 'content-length': String(zip.length) })
    res.end(zip)
  })

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))

  const base = `http://127.0.0.1:${server.address().port}`

  for (const entry of index.plugins) {
    entry.zipUrl = entry.zipUrl.replace('ZIP_BASE', base)
  }

  return {
    url: base,
    indexUrl: `${base}/index.json`,
    index: index,
    setZip: (name, buffer) => zips.set(name, buffer),
    setIndex: (next) => {
      index = next
    },
    close: () => new Promise((resolve) => server.close(resolve))
  }
}
