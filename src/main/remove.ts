import { promises as fs } from 'fs'
import { basename, dirname, join } from 'path'
import type { Skill } from '@shared/types'
import { ROOTS } from './paths'

const norm = (p: string): string => p.replace(/[\/]+$/, '').toLowerCase()

async function isLink(p: string): Promise<boolean> {
  try {
    return (await fs.lstat(p)).isSymbolicLink()
  } catch {
    return false
  }
}

/** Remove a symlink or junction itself, never what it points at. */
async function removeLink(p: string): Promise<void> {
  try {
    await fs.unlink(p)
  } catch {
    await fs.rmdir(p)
  }
}

/** Drop the skill from the `skills` CLI's lock file so it doesn't claim to be installed. */
async function forgetInLockFile(name: string): Promise<void> {
  const file = join(dirname(ROOTS.agents), '.skill-lock.json')
  try {
    const lock = JSON.parse(await fs.readFile(file, 'utf8')) as { skills?: Record<string, unknown> }
    if (!lock.skills || !(name in lock.skills)) return
    delete lock.skills[name]
    await fs.writeFile(file, JSON.stringify(lock, null, 2), 'utf8')
  } catch {
    // No lock file, or one we can't read: nothing to tidy.
  }
}

export interface RemoveOutcome {
  /** The ~/.claude/skills link that pointed at the removed agents skill, if there was one. */
  linkRemoved: boolean
}

/**
 * Delete a skill from ~/.agents/skills or ~/.claude/skills. The folder goes through `trash`
 * (the Recycle Bin), so it can be restored. A skill that is itself a link is unlinked and
 * its target left alone. Removing an agents skill also removes the Claude link to it.
 */
export async function removeSkill(skill: Skill, trash: (path: string) => Promise<void>): Promise<RemoveOutcome> {
  const root = skill.source === 'agents' ? ROOTS.agents : skill.source === 'claude' ? ROOTS.claude : null
  if (!root || !skill.editable) throw new Error('Only skills in ~/.claude/skills and ~/.agents/skills can be deleted.')
  const name = basename(skill.path)
  if (norm(dirname(skill.path)) !== norm(root) || name === 'synced' || name.startsWith('.'))
    throw new Error('That folder is not a skill folder directly inside the skills directory.')

  if (await isLink(skill.path)) await removeLink(skill.path)
  else await trash(skill.path)

  let linkRemoved = false
  if (skill.source === 'agents') {
    const link = join(ROOTS.claude, name)
    if (await isLink(link)) {
      // Only a link that pointed at this skill; anything else with that name isn't ours to remove.
      const target = await fs.realpath(link).catch(() => null)
      if (target === null || norm(target) === norm(skill.realPath)) {
        await removeLink(link)
        linkRemoved = true
      }
    }
    await forgetInLockFile(name)
  }
  return { linkRemoved }
}
