import { createHash } from 'crypto'
import { promises as fs, existsSync } from 'fs'
import { join, relative, sep, basename } from 'path'
import matter from 'gray-matter'
import type { LinkState, ScanResult, Skill } from '@shared/types'
import { LINK_SCRIPT, PACK_SCRIPT, ROOTS } from './paths'
import { readSources } from './sources'

const SKIP_DIRS = new Set(['.git', 'node_modules', '__pycache__'])
const MAX_FILES = 500
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** Last scan, so actions can look skills up by id without rescanning. */
let lastSkills = new Map<string, Skill>()

const allSkills = (): Skill[] => [...lastSkills.values()]

export function getSkill(id: string): Skill {
  const s = lastSkills.get(id)
  if (!s) throw new Error(`Unknown skill: ${id}`)
  return s
}

const hash = (s: string): string => createHash('sha1').update(s).digest('hex')

const norm = (p: string): string => p.replace(/[\\/]+$/, '').toLowerCase()

async function realpath(p: string): Promise<string> {
  try {
    return await fs.realpath(p)
  } catch {
    return p
  }
}

async function listDirs(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    // Junctions show up as symbolic links, so accept those too.
    return entries.filter((e) => e.isDirectory() || e.isSymbolicLink()).map((e) => e.name)
  } catch {
    return []
  }
}

async function listFiles(root: string): Promise<string[]> {
  const out: string[] = []
  async function walk(dir: string): Promise<void> {
    if (out.length >= MAX_FILES) return
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    entries.sort((a, b) => a.name.localeCompare(b.name))
    for (const e of entries) {
      if (out.length >= MAX_FILES) return
      const full = join(dir, e.name)
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) await walk(full)
      } else if (e.isFile()) {
        out.push(relative(root, full).split(sep).join('/'))
      }
    }
  }
  await walk(root)
  return out
}

interface Parsed {
  name?: string
  description?: string
  warnings: string[]
}

function looseFrontmatter(text: string): Record<string, string> {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  const out: Record<string, string> = {}
  for (const line of m ? m[1].split(/\r?\n/) : []) {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line)
    if (kv) out[kv[1]] = kv[2].replace(/^(["'])(.*)\1$/, '$2')
  }
  return out
}

/** The checks claude.ai applies when a skill zip is uploaded. */
export function validateFrontmatter(text: string, folderName: string): Parsed {
  const warnings: string[] = []
  let data: Record<string, unknown> = {}
  try {
    // Empty options skip gray-matter's cache, which keeps the first error-free result per text.
    data = matter(text, {}).data
  } catch {
    // Claude reads `key: value` lines even when they aren't valid YAML (an unquoted
    // ": " in a description is the usual cause), so fall back to that.
    data = looseFrontmatter(text)
    warnings.push('Frontmatter is not valid YAML; quote values that contain ": ".')
  }
  const name = typeof data.name === 'string' ? data.name : undefined
  const description = typeof data.description === 'string' ? data.description : undefined
  if (!name) warnings.push('Missing `name` in frontmatter.')
  else {
    if (!NAME_RE.test(name)) warnings.push('`name` should be lowercase letters, digits and hyphens.')
    if (name.length > 64) warnings.push('`name` is longer than 64 characters.')
    if (name !== folderName) warnings.push(`\`name\` (${name}) does not match the folder (${folderName}).`)
  }
  if (!description) warnings.push('Missing `description` in frontmatter.')
  else if (description.length > 1024)
    warnings.push(`\`description\` is ${description.length} characters; claude.ai allows 1024.`)
  return { name, description, warnings }
}

type SkillBase = Pick<Skill, 'id' | 'source' | 'editable' | 'accountSource' | 'plugin'>

async function readSkill(dir: string, base: SkillBase): Promise<Skill | null> {
  const folderName = basename(dir)
  let text: string
  let mtime: Date
  try {
    text = await fs.readFile(join(dir, 'SKILL.md'), 'utf8')
    mtime = (await fs.stat(join(dir, 'SKILL.md'))).mtime
  } catch {
    return null
  }
  const realPath = await realpath(dir)
  const parsed = validateFrontmatter(text, folderName)
  const files = await listFiles(realPath)
  return {
    ...base,
    name: parsed.name ?? folderName,
    description: parsed.description ?? '',
    path: dir,
    realPath,
    skillMdPath: join(realPath, 'SKILL.md'),
    files,
    updatedAt: mtime.toISOString(),
    warnings: parsed.warnings,
    skillMdHash: hash(text.replace(/\r\n/g, '\n')),
    filesHash: hash(files.join('\n')),
    sameName: []
  }
}

interface ManifestEntry {
  skillId?: string
  name?: string
  description?: string
  source?: string
  updatedAt?: string
}

async function scanAccount(): Promise<Skill[]> {
  const out: Skill[] = []
  for (const bucket of await listDirs(ROOTS.account)) {
    const dir = join(ROOTS.account, bucket)
    let manifest: { skills?: ManifestEntry[] }
    try {
      manifest = JSON.parse(await fs.readFile(join(dir, 'manifest.json'), 'utf8'))
    } catch {
      continue
    }
    for (const entry of manifest.skills ?? []) {
      // Built-in skills sit in a folder named by skillId; your own ones by name.
      const folder = [entry.name, entry.skillId].find((f) => f && existsSync(join(dir, f, 'SKILL.md')))
      if (!folder) continue
      const skill = await readSkill(join(dir, folder), {
        id: `account:${folder}`,
        source: 'account',
        editable: false,
        accountSource: entry.source
      })
      if (!skill) continue
      if (entry.name) skill.name = entry.name
      if (entry.description) skill.description = entry.description
      if (entry.updatedAt) skill.updatedAt = entry.updatedAt
      // claude.ai already accepted these, so upload warnings are noise here.
      skill.warnings = []
      out.push(skill)
    }
  }
  return out
}

/** Same classification as Get-SkillState in link-skills.ps1. */
async function claudeLinkState(name: string, agentReal: string): Promise<LinkState> {
  const target = join(ROOTS.claude, name)
  let st
  try {
    st = await fs.lstat(target)
  } catch {
    return 'not-linked'
  }
  if (!st.isSymbolicLink()) return 'real'
  return norm(await realpath(target)) === norm(agentReal) ? 'linked' : 'conflict'
}

async function scanAgents(): Promise<Skill[]> {
  const out: Skill[] = []
  for (const name of await listDirs(ROOTS.agents)) {
    const skill = await readSkill(join(ROOTS.agents, name), {
      id: `agents:${name}`,
      source: 'agents',
      editable: true
    })
    if (!skill) continue
    skill.linkState = await claudeLinkState(name, skill.realPath)
    out.push(skill)
  }
  return out
}

async function scanClaude(agents: Skill[]): Promise<Skill[]> {
  const agentReals = new Set(agents.map((a) => norm(a.realPath)))
  const out: Skill[] = []
  for (const name of await listDirs(ROOTS.claude)) {
    // synced = account skills; dot folders (e.g. .trash from the sync) aren't skills.
    if (name === 'synced' || name.startsWith('.')) continue
    const dir = join(ROOTS.claude, name)
    // Junctions into ~/.agents/skills are shown once, on the agents skill.
    if (agentReals.has(norm(await realpath(dir)))) continue
    const skill = await readSkill(dir, { id: `claude:${name}`, source: 'claude', editable: true })
    if (!skill) continue
    if (norm(skill.realPath) !== norm(dir)) skill.linkState = 'linked'
    out.push(skill)
  }
  return out
}

async function scanPlugins(): Promise<Skill[]> {
  const out: Skill[] = []
  // Layouts seen: <marketplace>/plugins/<plugin>/skills/<skill>
  //               <marketplace>/external_plugins/<plugin>/skills/<skill>
  async function visit(dir: string, depth: number, marketplace: string): Promise<void> {
    if (depth > 4) return
    for (const child of await listDirs(dir)) {
      if (SKIP_DIRS.has(child) || child.startsWith('.')) continue
      const full = join(dir, child)
      if (child === 'skills') {
        const plugin = basename(dir)
        for (const name of await listDirs(full)) {
          const skill = await readSkill(join(full, name), {
            id: `plugin:${marketplace}/${plugin}/${name}`,
            source: 'plugin',
            editable: false,
            plugin: { marketplace, plugin }
          })
          if (skill) out.push(skill)
        }
      } else {
        await visit(full, depth + 1, marketplace)
      }
    }
  }
  for (const marketplace of await listDirs(ROOTS.plugin)) {
    await visit(join(ROOTS.plugin, marketplace), 1, marketplace)
  }
  return out
}

/** Link skills that share a name across locations (junction copies are already merged). */
function markSameName(skills: Skill[]): void {
  const byName = new Map<string, Skill[]>()
  for (const s of skills) {
    const key = s.name.toLowerCase()
    byName.set(key, [...(byName.get(key) ?? []), s])
  }
  for (const group of byName.values())
    if (group.length > 1) for (const s of group) s.sameName = group.filter((o) => o !== s).map((o) => o.id)
}

let latest: Promise<ScanResult> | null = null

export function scan(): Promise<ScanResult> {
  latest = runScan()
  return latest
}

/** Skills from the newest scan, waiting for one that's still running. */
export async function currentSkills(): Promise<Skill[]> {
  await (latest ?? scan())
  return allSkills()
}

async function runScan(): Promise<ScanResult> {
  const agents = await scanAgents()
  const [account, claude, plugins] = await Promise.all([scanAccount(), scanClaude(agents), scanPlugins()])
  const skills = [...account, ...claude, ...agents, ...plugins].sort((a, b) =>
    a.name.localeCompare(b.name)
  )
  markSameName(skills)
  const sources = await readSources()
  for (const s of skills) {
    const folder = basename(s.path)
    const source = sources.get(folder)
    // Claude Code copies of an agents skill share its lock entry.
    if (source && (s.source === 'agents' || s.source === 'claude')) s.registry = { source, skillId: folder }
  }
  lastSkills = new Map(skills.map((s) => [s.id, s]))
  return {
    skills,
    tools: { link: existsSync(LINK_SCRIPT), pack: existsSync(PACK_SCRIPT) },
    roots: ROOTS
  }
}
