import { net } from 'electron'

/**
 * fetch for skills.sh requests. Uses Chromium's network stack instead of Node's bundled fetch,
 * which follows the system proxy and certificates and doesn't trip over IPv6 or VPN setups.
 * Errors carry the underlying reason, since Node's own message is just "fetch failed".
 */
export async function httpFetch(url: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await net.fetch(url, init)
  } catch (e) {
    const err = e as Error & { cause?: { code?: string; message?: string } }
    if (err.name === 'TimeoutError') throw err // browse.ts words this one itself
    throw new Error(err.cause?.code ?? err.cause?.message ?? err.message)
  }
}
