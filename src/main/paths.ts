import { homedir } from 'os'
import { join } from 'path'
import type { SkillSource } from '@shared/types'

const home = homedir()

export const ROOTS: Record<SkillSource, string> = {
  account: join(home, '.claude', 'skills', 'synced'),
  claude: join(home, '.claude', 'skills'),
  agents: join(home, '.agents', 'skills'),
  plugin: join(home, '.claude', 'plugins', 'marketplaces')
}

export const LINK_SCRIPT = join(ROOTS.claude, 'link', 'scripts', 'link-skills.ps1')
export const PACK_SCRIPT = join(ROOTS.claude, 'send-to-chat', 'scripts', 'pack-skill.ps1')
