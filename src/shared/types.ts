export type SkillSource = 'account' | 'claude' | 'agents' | 'plugin'

export type LinkState = 'linked' | 'not-linked' | 'conflict' | 'real'

export interface Skill {
  /** Stable id: `<source>:<name>` (plugin skills add marketplace/plugin). */
  id: string
  name: string
  description: string
  source: SkillSource
  /** Folder as found (may be a junction). */
  path: string
  /** Folder with junctions resolved. */
  realPath: string
  skillMdPath: string
  /** Paths relative to realPath, forward slashes. */
  files: string[]
  editable: boolean
  /** Agents skills: how ~/.claude/skills/<name> relates to it. Claude skills that are junctions report 'linked'. */
  linkState?: LinkState
  /** claude.ai manifest `source` (anthropic, anthropic-example, plugin, ...). */
  accountSource?: string
  plugin?: { marketplace: string; plugin: string }
  updatedAt: string
  warnings: string[]
  /** Hash of SKILL.md (line endings normalized), for comparing copies. */
  skillMdHash: string
  /** Hash of the file list, for comparing copies. */
  filesHash: string
  /** Ids of other skills with the same name in other locations. */
  sameName: string[]
  /** Where the skill was installed from, per the skills lock files; used for skills.sh counts. */
  registry?: RegistryRef
}

export interface RegistryRef {
  /** GitHub owner/repo. */
  source: string
  skillId: string
}

export const registryKey = (r: RegistryRef): string => `${r.source}/${r.skillId}`.toLowerCase()

/** Cached skills.sh install counts by registryKey; null = not listed there. */
export interface InstallsState {
  fetchedAt: string | null
  counts: Record<string, number | null>
  error?: string
}

export interface ToolAvailability {
  link: boolean
  pack: boolean
}

export interface ScanResult {
  skills: Skill[]
  tools: ToolAvailability
  roots: Record<SkillSource, string>
}

export interface ActionResult {
  ok: boolean
  message: string
  output?: string
}

export interface Group {
  id: string
  name: string
}

/** User-made groups. A skill (by id) can belong to any number of them. */
export interface GroupsState {
  groups: Group[]
  members: Record<string, string[]>
}

/** One result from skills.sh search. */
export interface RegistryHit {
  /** `owner/repo/skillId` */
  id: string
  /** GitHub owner/repo. */
  source: string
  skillId: string
  name: string
  installs: number
}

export interface SearchResult {
  skills: RegistryHit[]
  error?: string
}

/** Pass as the skill to install every skill in a repo. */
export const ALL_SKILLS = '*'

/**
 * The install command. `universal` is the agent whose folder is ~/.agents/skills; adding
 * `claude-code` also symlinks the skill into ~/.claude/skills.
 */
export const installCommand = (source: string, skillId: string, withClaude: boolean): string =>
  `npx --yes skills add ${source} -s ${skillId === ALL_SKILLS ? '"*"' : skillId} -g -a universal${withClaude ? ' claude-code' : ''} -y`

export type Board = 'all-time' | 'trending' | 'hot'

export interface RepoRow {
  name: string
  /** For example "21 skills: frontend-design, skill-creator +19 more". */
  summary: string
  installs: number
}

export interface SkillRow {
  skillId: string
  installs: number
}

/** What skills.sh shows at each level of owner / repo / skill. */
export type BrowseData =
  | { level: 'board'; skills: RegistryHit[]; hasMore: boolean }
  | { level: 'owner'; repos: RepoRow[] }
  | { level: 'repo'; skills: SkillRow[] }
  | { level: 'skill'; topic?: string; summary: { bullet: boolean; text: string }[] }

export interface BrowseResult {
  data?: BrowseData
  error?: string
}

export interface InstallStart {
  ok: boolean
  /** Id of the running install; events for it carry the same id. */
  id?: string
  message?: string
}

export type InstallEvent =
  | { type: 'data'; id: string; data: string }
  | { type: 'exit'; id: string; code: number | null }

export interface SkillsApi {
  scan(): Promise<ScanResult>
  getGroups(): Promise<GroupsState>
  saveGroups(state: GroupsState): Promise<void>
  getInstalls(): Promise<InstallsState>
  refreshInstalls(): Promise<InstallsState>
  readFile(skillId: string, relPath: string): Promise<string>
  saveFile(skillId: string, relPath: string, content: string): Promise<ActionResult>
  link(skillId: string): Promise<ActionResult>
  deleteSkill(skillId: string): Promise<ActionResult>
  pack(skillId: string): Promise<ActionResult>
  openFolder(skillId: string): Promise<void>
  openSkillMd(skillId: string): Promise<void>
  showInExplorer(skillId: string): Promise<void>
  openExternal(url: string): Promise<void>
  searchRegistry(query: string): Promise<SearchResult>
  browseRegistry(path: string[], board: Board, page: number): Promise<BrowseResult>
  installSkill(source: string, skillId: string, withClaude: boolean): Promise<InstallStart>
  cancelInstall(): Promise<void>
  onInstallEvent(cb: (e: InstallEvent) => void): () => void
  onChanged(cb: () => void): () => void
}
