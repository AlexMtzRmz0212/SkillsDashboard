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

export async function saveGroups(state: GroupsState): Promise<void> {
  // Write then rename so a crash mid-save can't leave a half-written file.
  const tmp = file() + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(clean(state), null, 2), 'utf8')
  await fs.rename(tmp, file())
}
