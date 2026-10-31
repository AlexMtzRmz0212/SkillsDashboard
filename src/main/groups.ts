import { promises as fs } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { GroupsState } from '@shared/types'

// Kept in the app's own data folder so skill folders are never touched.
const file = (): string => join(app.getPath('userData'), 'groups.json')

const empty = (): GroupsState => ({ groups: [], members: {} })

function clean(raw: unknown): GroupsState {
  const out = empty()
  if (!raw || typeof raw !== 'object') return out
  const r = raw as Partial<GroupsState>
  if (Array.isArray(r.groups))
    out.groups = r.groups
      .filter((g) => g && typeof g.id === 'string' && typeof g.name === 'string')
      .map((g) => ({ id: g.id, name: g.name.trim().slice(0, 80) }))
  const ids = new Set(out.groups.map((g) => g.id))
  if (r.members && typeof r.members === 'object')
    for (const [skillId, groupIds] of Object.entries(r.members)) {
      if (!Array.isArray(groupIds)) continue
      const valid = [...new Set(groupIds.filter((g) => typeof g === 'string' && ids.has(g)))]
      if (valid.length) out.members[skillId] = valid
    }
  return out
}

export async function getGroups(): Promise<GroupsState> {
  try {
    return clean(JSON.parse(await fs.readFile(file(), 'utf8')))
  } catch {
    return empty()
  }
}

// Every change is saved straight away, so saves can overlap. They share one temp file, so run
// them one after another or the second rename finds the file already moved.
let queue: Promise<void> = Promise.resolve()

export function saveGroups(state: GroupsState): Promise<void> {
  const json = JSON.stringify(clean(state), null, 2)
  const run = queue.then(async () => {
    // Write then rename so a crash mid-save can't leave a half-written file.
    const tmp = file() + '.tmp'
    await fs.mkdir(app.getPath('userData'), { recursive: true })
    await fs.writeFile(tmp, json, 'utf8')
    await fs.rename(tmp, file())
  })
  queue = run.catch(() => undefined)
  return run
}
