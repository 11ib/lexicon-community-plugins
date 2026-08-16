// Fetches a plugin ZIP into memory and checks it against the index.
//
// Plugin ZIPs are kilobytes, so buffering is simpler than streaming to a temp
// file and lets the sha256 be verified before anything touches the Plugins
// folder. MAX_BYTES is a guard against a redirect landing somewhere unexpected.

import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { CliError } from './errors.js'

export const MAX_BYTES = 50 * 1024 * 1024

export function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

export async function downloadZip(url, expectedSha256, options = {}) {
  const fetchImpl = options.fetch ?? fetch
  const maxBytes = options.maxBytes ?? MAX_BYTES

  let buffer

  if (/^https?:\/\//i.test(url)) {
    let response

    try {
      response = await fetchImpl(url, { redirect: 'follow' })
    } catch (err) {
      throw new CliError(`download failed for ${url} — ${err.message}`)
    }

    if (!response.ok) {
      throw new CliError(`download failed — ${response.status} ${response.statusText} for ${url}`)
    }

    const declared = Number(response.headers.get('content-length'))

    if (Number.isFinite(declared) && declared > maxBytes) {
      throw new CliError(`refusing to download ${declared} bytes from ${url} — over the ${maxBytes} byte limit`)
    }

    buffer = Buffer.from(await response.arrayBuffer())
  } else {
    try {
      buffer = await readFile(url)
    } catch (err) {
      throw new CliError(`could not read plugin archive at ${url} — ${err.message}`)
    }
  }

  if (buffer.length > maxBytes) {
    throw new CliError(`plugin archive from ${url} is ${buffer.length} bytes — over the ${maxBytes} byte limit`)
  }

  const actual = sha256(buffer)

  if (actual !== expectedSha256.toLowerCase()) {
    throw new CliError(
      `checksum mismatch for ${url}`,
      `index says ${expectedSha256}, download is ${actual} — nothing was installed`
    )
  }

  return buffer
}
