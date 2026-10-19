import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ALL_SKILLS,
  installCommand,
  type Board,
  type BrowseData,
  type BrowseResult,
  type RegistryHit,
  type Skill
} from '@shared/types'
import type { InstallerApi } from '../useInstaller'
import { Icon } from './Icon'
import { formatInstalls } from './Installs'
import { InstallButton, RegistryRow } from './RegistryRow'

const BOARDS: { id: Board; label: string; hint: string }[] = [
  { id: 'all-time', label: 'All time', hint: 'Most installed ever' },
  { id: 'trending', label: 'Trending', hint: 'Most installed in the last 24 hours' },
  { id: 'hot', label: 'Hot', hint: 'Biggest jump in installs since yesterday' }
]

interface Props {
  /** [] = leaderboard, [owner], [owner, repo], [owner, repo, skill]. */
  path: string[]
  installer: InstallerApi
  isInstalled(hit: RegistryHit): boolean
  /** The installed copy, if any (what Delete removes). */
  installedSkill(hit: RegistryHit): Skill | undefined
  onDelete(skill: Skill): void
  go(path: string[]): void
}

/** Pages already fetched this session, so going back up the breadcrumb is instant. */
const cache = new Map<string, BrowseData>()

const hitOf = (source: string, skillId: string, installs = 0): RegistryHit => ({
  id: `${source}/${skillId}`,
  source,
  skillId,
  name: skillId,
  installs
})

export function Browse({ path, installer, isInstalled, installedSkill, onDelete, go }: Props): React.JSX.Element {
  const [board, setBoard] = useState<Board>('all-time')
  const key = path.length ? path.join('/') : `board:${board}`
  const [result, setResult] = useState<{ key: string; r: BrowseResult } | null>(null)
  const [more, setMore] = useState<{ key: string; skills: RegistryHit[]; page: number; hasMore: boolean } | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const seq = useRef(0)

  useEffect(() => {
    const hit = cache.get(key)
    if (hit) {
      setResult({ key, r: { data: hit } })
      return
    }
    const mine = ++seq.current
    window.api.browseRegistry(path, board, 0).then((r) => {
      if (mine !== seq.current) return
      if (r.data) cache.set(key, r.data)
      setResult({ key, r })
    })
    // path and board are folded into key
  }, [key, attempt])

  const loadMore = useCallback(async () => {
    const page = (more?.key === key ? more.page : 0) + 1
    setLoadingMore(true)
    const r = await window.api.browseRegistry([], board, page)
    setLoadingMore(false)
    const d = r.data
    if (d?.level !== 'board') return
    setMore((m) => ({
      key,
      skills: [...(m?.key === key ? m.skills : []), ...d.skills],
      page,
      hasMore: d.hasMore
    }))
  }, [key, board, more])

  const loading = result?.key !== key
  const data = result?.key === key ? result.r.data : undefined
  const error = result?.key === key ? result.r.error : undefined
  const skillsUrl = `https://skills.sh/${path.join('/')}`

  return (
    <div className="rows discover-rows">
      {path.length === 0 && (
        <div className="boards" role="tablist" aria-label="Leaderboard">
          {BOARDS.map((b) => (
            <button
              key={b.id}
              role="tab"
              aria-selected={board === b.id}
              className={`board-tab ${board === b.id ? 'active' : ''}`}
              title={b.hint}
              onClick={() => setBoard(b.id)}
            >
              {b.label}
            </button>
          ))}
        </div>
      )}

      {loading && <div className="empty">Loading…</div>}

      {error && (
        <div className="empty">
          <p>{error}</p>
          <div className="suggest">
            <button className="suggest-btn" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </button>
            {path.length > 0 && (
              <button className="suggest-btn" onClick={() => window.api.openExternal(skillsUrl)}>
                Open on skills.sh
              </button>
            )}
          </div>
        </div>
      )}

      {data?.level === 'board' && (
        <>
          {[...data.skills, ...(more?.key === key ? more.skills : [])].map((h) => (
            <RegistryRow
              key={h.id}
              hit={h}
              installer={installer}
              installed={isInstalled(h)}
              onOpen={() => go([...h.source.split('/'), h.skillId])}
              onOpenRepo={() => go(h.source.split('/'))}
            />
          ))}
          {(more?.key === key ? more.hasMore : data.hasMore) && (
            <div className="more">
              <button className="btn small" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Show more'}
              </button>
            </div>
          )}
        </>
      )}

      {data?.level === 'owner' && (
        <>
          <div className="level-meta">
            {data.repos.length} {data.repos.length === 1 ? 'repository' : 'repositories'}
          </div>
          {data.repos.map((r) => (
            <button key={r.name} className="hit repo-row" onClick={() => go([path[0], r.name])}>
              <div className="hit-main">
                <div className="row-top">
                  <span className="hit-name">{r.name}</span>
                </div>
                <div className="hit-sub repo-summary">{r.summary}</div>
              </div>
              {r.installs > 0 && (
                <span className="installs" title={`${r.installs.toLocaleString()} installs on skills.sh`}>
                  <Icon name="download" size={11} />
                  {formatInstalls(r.installs)}
                </span>
              )}
              <Icon name="chevron" size={14} />
            </button>
          ))}
        </>
      )}

      {data?.level === 'repo' && (
        <>
          <RepoHeader
            source={path.join('/')}
            skills={data.skills.map((s) => hitOf(path.join('/'), s.skillId, s.installs))}
            installer={installer}
            isInstalled={isInstalled}
          />
          {data.skills.map((s) => {
            const hit = hitOf(path.join('/'), s.skillId, s.installs)
            return (
              <RegistryRow
                key={hit.id}
                hit={hit}
                installer={installer}
                installed={isInstalled(hit)}
                onOpen={() => go([...path, s.skillId])}
              />
            )
          })}
        </>
      )}

      {data?.level === 'skill' && (
        <SkillPage
          path={path}
          data={data}
          installer={installer}
          installedSkill={installedSkill(hitOf(path.slice(0, -1).join('/'), path[path.length - 1]))}
          onDelete={onDelete}
          installs={installsFromRepo(path)}
        />
      )}
    </div>
  )
}

/** Repo level: how many skills, and one button that installs the lot (`skills add owner/repo`). */
function RepoHeader({
  source,
  skills,
  installer,
  isInstalled
}: {
  source: string
  skills: RegistryHit[]
  installer: InstallerApi
  isInstalled(hit: RegistryHit): boolean
}): React.JSX.Element {
  const n = skills.length
  const have = skills.filter(isInstalled).length
  const hit: RegistryHit = {
    id: `${source}/${ALL_SKILLS}`,
    source,
    skillId: ALL_SKILLS,
    name: `all ${n} skills from ${source}`,
    installs: 0
  }
  const isActive = installer.active?.id === hit.id
  const install = (): void => {
    // A few dozen skills is a lot to land in ~/.agents/skills by accident.
    if (n > 25 && !confirm(`Install all ${n} skills from ${source}?`)) return
    installer.install(hit)
  }
  return (
    <div className="repo-head">
      <div className="repo-head-text">
        <div className="repo-head-title">
          {n} {n === 1 ? 'skill' : 'skills'} in {source}
          {have > 0 && <span className="tag tag-ok">{have} installed</span>}
        </div>
        <code className="skill-cmd">{installCommand(source, ALL_SKILLS, installer.withClaude)}</code>
      </div>
      <button
        className="btn small primary"
        disabled={installer.active !== null}
        onClick={install}
        title="Install every skill in this repository"
      >
        {isActive ? (
          <>
            <span className="spin">
              <Icon name="refresh" size={14} />
            </span>
            Installing…
          </>
        ) : (
          <>
            <Icon name="download" size={14} />
            Install all {n}
          </>
        )}
      </button>
    </div>
  )
}

/** If the repo page was already visited, its row has this skill's install count. */
function installsFromRepo(path: string[]): number {
  const repo = cache.get(path.slice(0, 2).join('/'))
  return repo?.level === 'repo' ? (repo.skills.find((s) => s.skillId === path[2])?.installs ?? 0) : 0
}

function SkillPage({
  path,
  data,
  installer,
  installedSkill,
  onDelete,
  installs
}: {
  path: string[]
  data: Extract<BrowseData, { level: 'skill' }>
  installer: InstallerApi
  installedSkill: Skill | undefined
  onDelete(skill: Skill): void
  installs: number
}): React.JSX.Element {
  const installed = installedSkill !== undefined
  const source = path.slice(0, -1).join('/')
  const skillId = path[path.length - 1]
  const hit = hitOf(source, skillId, installs)
  const url = `https://skills.sh/${path.join('/')}`
  return (
    <article className="skill-page">
      <header className="skill-page-head">
        <div>
          <h2>{skillId}</h2>
          <div className="skill-page-tags">
            {data.topic && <span className="tag tag-muted">{data.topic}</span>}
            {installed && (
              <span className="tag tag-ok">
                <Icon name="check" size={11} />
                Installed
              </span>
            )}
            {installs > 0 && (
              <span className="installs" title={`${installs.toLocaleString()} installs on skills.sh`}>
                <Icon name="download" size={11} />
                {formatInstalls(installs)}
              </span>
            )}
          </div>
        </div>
        <div className="skill-page-actions">
          <InstallButton hit={hit} installer={installer} installed={installed} />
          {installedSkill && (
            <button
              className="btn small danger-outline"
              disabled={installer.active !== null}
              onClick={() => onDelete(installedSkill)}
              title="Move this skill to the Recycle Bin"
            >
              <Icon name="trash" size={14} />
              Delete
            </button>
          )}
        </div>
      </header>

      <code className="skill-cmd">{installCommand(source, skillId, installer.withClaude)}</code>

      {data.summary.length > 0 && (
        <>
          <h3>Summary</h3>
          <div className="skill-summary">
            {data.summary.map((s, i) =>
              s.bullet ? (
                <div className="bullet" key={i}>
                  {s.text}
                </div>
              ) : (
                <p key={i}>{s.text}</p>
              )
            )}
          </div>
        </>
      )}

      <button className="link-btn" onClick={() => window.api.openExternal(url)}>
        Read the full SKILL.md and security audits on skills.sh
        <Icon name="external" size={12} />
      </button>
    </article>
  )
}
