import { promises as fs } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { registryKey, type InstallsState, type RegistryRef } from '@shared/types'
import { currentSkills } from './scanner'

// The endpoint the `skills` CLI uses for `npx skills find`. It's undocumented, so
// counts are cached and only fetched when the user asks.
const SEARCH = 'https://skills.sh/api/search'

const cacheFile = (): string => join(app.getPath('userData'), 'installs.json')

export async function getInstalls(): Promise<InstallsState> {
  try {
    const raw = JSON.parse(await fs.readFile(cacheFile(), 'utf8')) as InstallsState
    return { fetchedAt: raw.fetchedAt ?? null, counts: raw.counts ?? {} }
  } catch {
    return { fetchedAt: null, counts: {} }
  }
}

interface SearchHit {
  source: string
  skillId: string
  installs?: number
}

async function search(q: string): Promise<SearchHit[]> {
  const res = await fetch(`${SEARCH}?q=${encodeURIComponent(q)}&limit=100`, {
    signal: AbortSignal.timeout(15000)
  })
  if (!res.ok) throw new Error(`skills.sh answered ${res.status}`)
  const body = (await res.json()) as { skills?: SearchHit[] }
  return body.skills ?? []
}

/** Run tasks a few at a time so skills.sh isn't hit with a burst. */
async function pool<T>(items: T[], size: number, run: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items]
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      while (queue.length) await run(queue.shift()!)
    })
  )
}

export async function refreshInstalls(): Promise<InstallsState> {
  const refs = new Map<string, RegistryRef>()
  for (const s of await currentSkills()) if (s.registry) refs.set(registryKey(s.registry), s.registry)
  const counts: Record<string, number | null> = {}
  const record = (hits: SearchHit[]): void => {
    for (const h of hits) {
      const key = registryKey(h)
      if (refs.has(key) && typeof h.installs === 'number') counts[key] = h.installs
    }
  }

  try {
    // One query per repo returns most of its skills; look up the rest by name.
    const repos = [...new Set([...refs.values()].map((r) => r.source))]
    await pool(repos, 3, async (repo) => record(await search(repo)))
    const missing = [...refs.entries()].filter(([key]) => !(key in counts))
    await pool(missing, 3, async ([, ref]) => record(await search(ref.skillId)))
  } catch (e) {
    return { ...(await getInstalls()), error: `Couldn't reach skills.sh: ${(e as Error).message}` }
  }

  for (const key of refs.keys()) if (!(key in counts)) counts[key] = null
  const state: InstallsState = { fetchedAt: new Date().toISOString(), counts }
  await fs.writeFile(cacheFile(), JSON.stringify(state, null, 2), 'utf8')
  return state
}
