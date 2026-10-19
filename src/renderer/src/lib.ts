import type { Skill, SkillSource } from '@shared/types'

export const SOURCE_LABEL: Record<SkillSource, string> = {
  account: 'claude.ai account',
  claude: 'Claude Code',
  agents: 'Agents',
  plugin: 'Plugins'
}

export const SOURCE_SHORT: Record<SkillSource, string> = {
  account: 'claude.ai',
  claude: '.claude',
  agents: '.agents',
  plugin: 'plugin'
}

export const SOURCE_PATH: Record<SkillSource, string> = {
  account: '~/.claude/skills/synced',
  claude: '~/.claude/skills',
  agents: '~/.agents/skills',
  plugin: '~/.claude/plugins/marketplaces'
}

export const SOURCES: SkillSource[] = ['account', 'claude', 'agents', 'plugin']

/** claude.ai manifest `source` values. Your own uploads are backed by a plugin. */
export const ACCOUNT_ORIGIN: Record<string, string> = {
  anthropic: 'Anthropic',
  'anthropic-example': 'Anthropic example',
  plugin: 'Your skill'
}

export interface Frontmatter {
  fields: [string, string][]
  body: string
}

/**
 * Split YAML frontmatter from a SKILL.md for display. Handles the flat
 * `key: value` and folded/literal (`>` / `|`) shapes skills use; anything
 * fancier is shown as the raw text.
 */
export function splitFrontmatter(text: string): Frontmatter {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)
  if (!m) return { fields: [], body: text }
  const fields: [string, string][] = []
  const lines = m[1].split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(lines[i])
    if (!kv) continue
    let value = kv[2]
    if (/^[>|][+-]?$/.test(value) || value === '') {
      const block: string[] = []
      while (i + 1 < lines.length && /^(\s+|- )/.test(lines[i + 1])) block.push(lines[++i].trim())
      if (block.length && block.every((l) => l.startsWith('- ')))
        value = block.map((l) => l.slice(2).replace(/^(["'])(.*)\1$/, '$2')).join(', ')
      else value = block.join(value.startsWith('|') ? '\n' : ' ')
    }
    value = value.replace(/^"(.*)"$/s, '$1').replace(/^'(.*)'$/s, '$1').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    fields.push([kv[1], value])
  }
  return { fields, body: text.slice(m[0].length) }
}

export function matches(skill: Skill, q: string): boolean {
  if (!q) return true
  const hay = `${skill.name} ${skill.description} ${skill.plugin?.plugin ?? ''}`.toLowerCase()
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((t) => hay.includes(t))
}

export function relativeTime(iso: string): string {
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (days < 1) return 'today'
  if (days < 2) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export const TEXT_EXT = /\.(md|txt|json|ya?ml|toml|js|mjs|cjs|ts|tsx|jsx|py|ps1|sh|bash|css|html?|xml|csv|ini|cfg)$/i
