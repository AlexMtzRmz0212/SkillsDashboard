import type { InstallsState, Skill, SkillSource } from '@shared/types'
import { SOURCES, SOURCE_LABEL, SOURCE_PATH } from '../lib'
import type { GroupsApi } from '../useGroups'
import { GroupNav } from './GroupNav'
import { Icon } from './Icon'
import { InstallsControl } from './Installs'

export type SourceFilter = SkillSource | 'all'
export type View = 'library' | 'discover'
export interface Flags {
  notLinked: boolean
  warnings: boolean
  sameName: boolean
}

interface Props {
  skills: Skill[]
  view: View
  onView(v: View): void
  installing: boolean
  /** Open an installed skill: its skills.sh page if it has one, otherwise My skills. */
  onOpenInstalled(skill: Skill): void
  source: SourceFilter
  flags: Flags
  loading: boolean
  groups: GroupsApi
  group: string | null
  onGroup(id: string | null): void
  onSource(s: SourceFilter): void
  onFlags(f: Flags): void
  onRefresh(): void
  installs: InstallsState
  fetchingInstalls: boolean
  onRefreshInstalls(): void
}

export function Sidebar({
  skills,
  view,
  onView,
  installing,
  onOpenInstalled,
  source,
  flags,
  loading,
  groups,
  group,
  onGroup,
  onSource,
  onFlags,
  onRefresh,
  installs,
  fetchingInstalls,
  onRefreshInstalls
}: Props): React.JSX.Element {
  const count = (s: SourceFilter): number => (s === 'all' ? skills.length : skills.filter((k) => k.source === s).length)
  const notLinked = skills.filter((s) => s.linkState === 'not-linked').length
  const warned = skills.filter((s) => s.warnings.length > 0).length
  const shared = skills.filter((s) => s.sameName.length > 0).length
  const installed = skills
    .filter((s) => s.source === 'agents')
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <span>Skills</span>
        <button className="icon-btn" onClick={onRefresh} title="Rescan" aria-label="Rescan">
          <span className={loading ? 'spin' : ''}>
            <Icon name="refresh" />
          </span>
        </button>
      </div>

      <div className="views" role="tablist" aria-label="View">
        <button
          role="tab"
          aria-selected={view === 'library'}
          className={`view-tab ${view === 'library' ? 'active' : ''}`}
          onClick={() => onView('library')}
        >
          <Icon name="package" size={14} />
          My skills
        </button>
        <button
          role="tab"
          aria-selected={view === 'discover'}
          className={`view-tab ${view === 'discover' ? 'active' : ''}`}
          onClick={() => onView('discover')}
        >
          <Icon name="compass" size={14} />
          Discover
          {installing && <span className="view-busy" title="Installing…" />}
        </button>
      </div>

      {view === 'discover' ? (
        <div className="nav">
          <p className="discover-note">Search the skills.sh directory and install a skill with one click.</p>
          <div className="nav-label">Installed · {installed.length}</div>
          {installed.map((s) => (
            <button
              key={s.id}
              className="nav-item installed-item"
              onClick={() => onOpenInstalled(s)}
              title={s.registry ? `Open ${s.registry.source}/${s.registry.skillId} on skills.sh` : 'Not from skills.sh: open in My skills'}
            >
              <span className="dot dot-agents" />
              <span className="nav-text">{s.name}</span>
              {s.linkState === 'linked' && (
                <span className="tag tag-ok" title="Linked to Claude Code">
                  Claude
                </span>
              )}
            </button>
          ))}
          {installed.length === 0 && <p className="discover-note">Nothing in ~/.agents/skills yet.</p>}
        </div>
      ) : (
        <nav className="nav">
          <div className="nav-label">Sources</div>
          <button className={`nav-item ${source === 'all' ? 'active' : ''}`} onClick={() => onSource('all')}>
            <span className="dot dot-all" />
            <span className="nav-text">All skills</span>
            <span className="count">{count('all')}</span>
          </button>
          {SOURCES.map((s) => (
            <button
              key={s}
              className={`nav-item ${source === s ? 'active' : ''}`}
              onClick={() => onSource(s)}
              title={SOURCE_PATH[s]}
            >
              <span className={`dot dot-${s}`} />
              <span className="nav-text">{SOURCE_LABEL[s]}</span>
              <span className="count">{count(s)}</span>
            </button>
          ))}

          <GroupNav skills={skills} groups={groups} active={group} onActive={onGroup} />

          <div className="nav-label">Filters</div>
          <label className="nav-check">
            <input
              type="checkbox"
              checked={flags.notLinked}
              onChange={(e) => onFlags({ ...flags, notLinked: e.target.checked })}
            />
            <span className="nav-text">Not linked to Claude</span>
            <span className="count">{notLinked}</span>
          </label>
          <label className="nav-check">
            <input
              type="checkbox"
              checked={flags.warnings}
              onChange={(e) => onFlags({ ...flags, warnings: e.target.checked })}
            />
            <span className="nav-text">Has warnings</span>
            <span className="count">{warned}</span>
          </label>
          <label className="nav-check">
            <input
              type="checkbox"
              checked={flags.sameName}
              onChange={(e) => onFlags({ ...flags, sameName: e.target.checked })}
            />
            <span className="nav-text">Same name elsewhere</span>
            <span className="count">{shared}</span>
          </label>
        </nav>
      )}

      {view === 'library' && (
        <InstallsControl installs={installs} busy={fetchingInstalls} onRefresh={onRefreshInstalls} />
      )}
      <div className="sidebar-foot">
        Account skills are the copies Claude syncs to this PC. Edit them on claude.ai.
      </div>
    </aside>
  )
}
