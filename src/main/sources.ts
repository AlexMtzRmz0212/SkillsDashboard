import { promises as fs } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

// Written by `npx skills add` and similar installers.
const LOCK_FILES = [
  join(homedir(), '.agents', '.skill-lock.json'),
  join(homedir(), '.claude', 'skills', 'skills-lock.json')
]

/** Skill folder name → GitHub owner/repo it was installed from. */
export async function readSources(): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  for (const file of LOCK_FILES) {
    try {
      const lock = JSON.parse(await fs.readFile(file, 'utf8')) as {
        skills?: Record<string, { source?: string; sourceType?: string }>
      }
      for (const [name, entry] of Object.entries(lock.skills ?? {}))
        if (entry.source && (entry.sourceType ?? 'github') === 'github' && !out.has(name))
          out.set(name, entry.source)
    } catch {
      // A missing or unreadable lock file just means fewer skills get counts.
    }
  }
  return out
}
