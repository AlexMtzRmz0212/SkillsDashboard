import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { registryKey, type ActionResult, type RegistryHit, type Skill } from '@shared/types'
import type { InstallerApi } from '../useInstaller'
import { Browse } from './Browse'
import { DeleteSkillDialog } from './DeleteSkillDialog'
import { Icon } from './Icon'
import { RegistryRow } from './RegistryRow'
import { Terminal } from './Terminal'

// Shown until (or instead of, when offline) the live suggestions from skills.sh arrive.
const FALLBACK_SUGGESTIONS = ['react', 'frontend design', 'testing', 'pdf', 'seo', 'github']
const SUGGESTION_COUNT = 6

type Sort = 'relevance' | 'installs'

/** Random picks from the trending board, so refreshing shows something different. */
function pick(pool: string[]): string[] {
  const left = [...pool]
  const out: string[] = []
  while (out.length < SUGGESTION_COUNT && left.length) out.push(left.splice(Math.floor(Math.random() * left.length), 1)[0])
  return out
}

interface Props {
  skills: Skill[]
  installer: InstallerApi
  onResult(r: ActionResult): void
  /** Where we are on skills.sh: [] = leaderboard, [owner], [owner, repo], [owner, repo, skill]. */
  path: string[]
  onPath(path: string[]): void
}

export function Discover({ skills, installer, onResult, path, onPath }: Props): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [deleting, setDeleting] = useState<Skill | null>(null)
  const [hits, setHits] = useState<RegistryHit[]>([])
  const [searched, setSearched] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('relevance')
  const [suggestions, setSuggestions] = useState(FALLBACK_SUGGESTIONS)
  const [suggesting, setSuggesting] = useState(false)
  const pool = useRef<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const seq = useRef(0)
  const searching = query.trim().length >= 2

  /** New suggestions from the trending board; the board is only refetched when none are cached. */
  const refreshSuggestions = useCallback(async (): Promise<void> => {
    if (pool.current.length < SUGGESTION_COUNT) {
      setSuggesting(true)
      const r = await window.api.browseRegistry([], 'trending', 0)
      setSuggesting(false)
      if (r.data?.level !== 'board') return
      pool.current = [...new Set(r.data.skills.map((s) => s.skillId))]
    }
    if (pool.current.length >= SUGGESTION_COUNT) setSuggestions(pick(pool.current))
  }, [])

  useEffect(() => {
    void refreshSuggestions()
  }, [refreshSuggestions])

  const sortedHits = useMemo(
    () => (sort === 'installs' ? [...hits].sort((a, b) => b.installs - a.installs) : hits),
    [hits, sort]
  )

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'f')) {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => setQuery(''), [path])

  // Search as you type, like skills.sh. Only the newest request may update the list.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      seq.current++
      setHits([])
      setSearched('')
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const mine = ++seq.current
    const timer = setTimeout(async () => {
      const r = await window.api.searchRegistry(q)
      if (mine !== seq.current) return
      setHits(r.skills)
      setSearched(q)
      setError(r.error ?? null)
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  // The ~/.agents/skills copy of a skills.sh skill, if installed. Skills with a recorded source
  // repo match on repo + name; only skills without one fall back to the folder name.
  const installedSkill = useMemo(() => {
    const agents = skills.filter((s) => s.source === 'agents')
    return (h: RegistryHit): Skill | undefined =>
      agents.find((s) =>
        s.registry ? registryKey(s.registry) === registryKey(h) : s.name.toLowerCase() === h.skillId.toLowerCase()
      )
  }, [skills])
  const isInstalled = useCallback((h: RegistryHit): boolean => installedSkill(h) !== undefined, [installedSkill])

  /** Move to a page of skills.sh; any search in progress is dropped. */
  const go = (next: string[]): void => {
    setQuery('')
    onPath(next)
  }

  const open = (h: RegistryHit): void => go([...h.source.split('/'), h.skillId])

  return (
    <section className="discover">
      <div className="discover-top">
        <div className="search">
          <Icon name="search" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search skills.sh (for example: react, pdf, seo)"
            spellCheck={false}
            aria-label="Search skills.sh"
          />
          {query ? (
            <button className="icon-btn small" onClick={() => setQuery('')} aria-label="Clear search">
              <Icon name="x" size={14} />
            </button>
          ) : (
            <kbd>Ctrl K</kbd>
          )}
        </div>
        <nav className="crumbs" aria-label="Location on skills.sh">
          {['skills', ...path].map((label, i) => {
            const last = i === path.length && !searching
            return (
              <span className="crumb-item" key={i}>
                {i > 0 && <span className="crumb-sep">/</span>}
                {last ? (
                  <span className="crumb current" aria-current="page">
                    {label}
                  </span>
                ) : (
                  <button className="crumb" onClick={() => go(path.slice(0, i))}>
                    {label}
                  </button>
                )}
              </span>
            )
          })}
          {searching && (
            <span className="crumb-meta">{loading ? 'Searching…' : `${hits.length} results for “${searched}”`}</span>
          )}
          {searching && (
            <div className="boards sort-tabs" role="tablist" aria-label="Sort results">
              {(['relevance', 'installs'] as Sort[]).map((s) => (
                <button
                  key={s}
                  role="tab"
                  aria-selected={sort === s}
                  className={`board-tab ${sort === s ? 'active' : ''}`}
                  onClick={() => setSort(s)}
                >
                  {s === 'relevance' ? 'Relevance' : 'Installs'}
                </button>
              ))}
            </div>
          )}
          <label
            className="claude-opt"
            title="Ticked: the skill is installed to ~/.agents/skills and also linked into ~/.claude/skills so Claude Code can use it. Untick to install to ~/.agents/skills only."
          >
            <input
              type="checkbox"
              checked={installer.withClaude}
              onChange={(e) => installer.setWithClaude(e.target.checked)}
            />
            Add to Claude Code
          </label>
        </nav>
      </div>

      {searching ? (
        <div className="rows discover-rows">
          {error && <div className="empty">{error}</div>}
          {!error && searched && !loading && hits.length === 0 && <div className="empty">No skills match.</div>}
          {sortedHits.map((h) => (
            <RegistryRow
              key={h.id}
              hit={h}
              installer={installer}
              installed={isInstalled(h)}
              onOpen={() => open(h)}
              onOpenRepo={() => go(h.source.split('/'))}
            />
          ))}
        </div>
      ) : (
        <>
          {path.length === 0 && (
            <div className="suggest suggest-top">
              <span className="suggest-label">Try</span>
              {suggestions.map((s) => (
                <button key={s} className="suggest-btn" onClick={() => setQuery(s)}>
                  {s}
                </button>
              ))}
              <button
                className="icon-btn small"
                onClick={() => void refreshSuggestions()}
                disabled={suggesting}
                title="Show other trending skills"
                aria-label="Refresh suggestions"
              >
                <span className={suggesting ? 'spin' : undefined}>
                  <Icon name="refresh" size={14} />
                </span>
              </button>
            </div>
          )}
          <Browse
            path={path}
            installer={installer}
            isInstalled={isInstalled}
            installedSkill={installedSkill}
            onDelete={setDeleting}
            go={go}
          />
        </>
      )}

      {deleting && <DeleteSkillDialog skill={deleting} onResult={onResult} onClose={() => setDeleting(null)} />}

      <Terminal
        term={installer.term}
        tick={installer.tick}
        running={installer.active?.name ?? null}
        onCancel={installer.cancel}
        onClear={installer.clear}
      />
    </section>
  )
}
