import { registryKey, type InstallsState, type Skill } from '@shared/types'
import { relativeTime } from '../lib'
import { Icon } from './Icon'

/** Same shorthand the `skills` CLI uses: 27.3K, 1.1M. */
export function formatInstalls(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}

/** undefined = no known source or not fetched yet; null = not listed on skills.sh. */
export function installsOf(skill: Skill, installs: InstallsState): number | null | undefined {
  return skill.registry ? installs.counts[registryKey(skill.registry)] : undefined
}

/** Compact count for list rows. */
export function InstallsCount({ skill, installs }: { skill: Skill; installs: InstallsState }): React.JSX.Element | null {
  const n = installsOf(skill, installs)
  if (typeof n !== 'number') return null
  return (
    <span className="installs" title={`${n.toLocaleString()} installs on skills.sh`}>
      <Icon name="download" size={11} />
      {formatInstalls(n)}
    </span>
  )
}

/** Detail pane badge: count with a link to the skill's skills.sh page, and its source repo. */
export function InstallsBadge({ skill, installs }: { skill: Skill; installs: InstallsState }): React.JSX.Element | null {
  if (!skill.registry) return null
  const { source, skillId } = skill.registry
  const n = installsOf(skill, installs)
  const open = (): Promise<void> => window.api.openExternal(`https://skills.sh/${source}/${skillId}`)
  return (
    <>
      {typeof n === 'number' ? (
        <button className="tag tag-installs" onClick={open} title="Open on skills.sh">
          <Icon name="download" size={12} />
          {n.toLocaleString()} installs on skills.sh
        </button>
      ) : n === null ? (
        <span className="tag tag-muted">Not listed on skills.sh</span>
      ) : (
        <span className="tag tag-muted" title="Use Refresh under Install counts in the sidebar">
          skills.sh count not fetched yet
        </span>
      )}
      <span className="tag tag-muted" title="Source repository, from the skills lock file">
        {source}
      </span>
    </>
  )
}

/** Sidebar control: when counts were fetched, and a button to fetch them again. */
export function InstallsControl({
  installs,
  busy,
  onRefresh
}: {
  installs: InstallsState
  busy: boolean
  onRefresh(): void
}): React.JSX.Element {
  return (
    <div className="installs-control">
      <div>
        <div className="installs-title">skills.sh installs</div>
        <div className="installs-when">
          {busy ? 'Fetching…' : installs.fetchedAt ? `Updated ${relativeTime(installs.fetchedAt)}` : 'Not fetched yet'}
        </div>
      </div>
      <button className="btn small" onClick={onRefresh} disabled={busy}>
        <span className={busy ? 'spin' : ''}>
          <Icon name="refresh" size={14} />
        </span>
        {installs.fetchedAt ? 'Refresh' : 'Fetch'}
      </button>
    </div>
  )
}
