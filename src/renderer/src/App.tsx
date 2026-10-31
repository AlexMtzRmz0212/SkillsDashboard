import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ActionResult, InstallsState, ScanResult } from '@shared/types'
import { Discover } from './components/Discover'
import { Sidebar, type Flags, type SourceFilter, type View } from './components/Sidebar'
import { UNGROUPED } from './components/GroupNav'
import { SkillList, type SortKey } from './components/SkillList'
import { installsOf } from './components/Installs'
import { SkillDetail } from './components/SkillDetail'
import { Toasts, type ToastItem } from './components/Toast'
import { matches } from './lib'
import { useGroups } from './useGroups'
import { useInstaller } from './useInstaller'

const PACK_HINT = 'Upload it at claude.ai → Settings → Capabilities → Skills → Upload skill, then toggle it on.'
const DETAIL_HIDDEN_KEY = 'skills-dashboard:detail-hidden'

const LIST_WIDTH_KEY = 'skills-dashboard:list-width'

function readDetailHidden(): boolean {
  try {
    return localStorage.getItem(DETAIL_HIDDEN_KEY) === '1'
  } catch {
    return false
  }
}

/** Dragged width of the skill list (the detail panel takes the rest); null = the default. */
function readListWidth(): number | null {
  try {
    const n = Number(localStorage.getItem(LIST_WIDTH_KEY))
    return Number.isFinite(n) && n >= 200 ? n : null
  } catch {
    return null
  }
}

export default function App(): React.JSX.Element {
  const [data, setData] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [version, setVersion] = useState(0)
  const [view, setView] = useState<View>('library')
  const [discoverPath, setDiscoverPath] = useState<string[]>([])
  const [source, setSource] = useState<SourceFilter>('all')
  const [flags, setFlags] = useState<Flags>({ notLinked: false, warnings: false, sameName: false })
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<string | null>(null)
  const groups = useGroups()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [sort, setSort] = useState<SortKey>('name')
  const [installs, setInstalls] = useState<InstallsState>({ fetchedAt: null, counts: {} })
  const [fetching, setFetching] = useState(false)
  const [detailHidden, setDetailHidden] = useState(readDetailHidden)
  const [listWidth, setListWidth] = useState(readListWidth)
  const dirty = useRef(false)

  const showDetail = useCallback((show: boolean) => {
    // Hiding the panel throws away an edit in progress, so ask first.
    if (!show && dirty.current && !confirm('Discard unsaved changes?')) return
    if (!show) dirty.current = false
    setDetailHidden(!show)
    try {
      localStorage.setItem(DETAIL_HIDDEN_KEY, show ? '0' : '1')
    } catch {
      // Not remembered across restarts, but the toggle still works.
    }
  }, [])

  const resizeList = useCallback((px: number | null, save: boolean) => {
    setListWidth(px)
    if (!save) return
    try {
      if (px === null) localStorage.removeItem(LIST_WIDTH_KEY)
      else localStorage.setItem(LIST_WIDTH_KEY, String(Math.round(px)))
    } catch {
      // Not remembered across restarts.
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await window.api.scan())
      setVersion((v) => v + 1)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    window.api.getInstalls().then(setInstalls)
    return window.api.onChanged(load)
  }, [load])

  const visible = useMemo(() => {
    if (!data) return []
    const list = data.skills.filter(
      (s) =>
        (source === 'all' || s.source === source) &&
        (!flags.notLinked || s.linkState === 'not-linked') &&
        (!flags.warnings || s.warnings.length > 0) &&
        (!flags.sameName || s.sameName.length > 0) &&
        (group === null ||
          (group === UNGROUPED ? groups.of(s.id).length === 0 : groups.of(s.id).includes(group))) &&
        matches(s, query)
    )
    if (sort === 'installs') {
      // Most installed first; skills without a count keep name order after them.
      const n = (s: (typeof list)[number]): number => installsOf(s, installs) ?? -1
      list.sort((a, b) => n(b) - n(a) || a.name.localeCompare(b.name))
    }
    return list
  }, [data, source, flags, query, group, groups, sort, installs])

  // Keep a selection whenever the list has something in it.
  useEffect(() => {
    if (visible.length && !visible.some((s) => s.id === selectedId)) setSelectedId(visible[0].id)
  }, [visible, selectedId])

  const select = useCallback((id: string) => {
    if (dirty.current && !confirm('Discard unsaved changes?')) return
    dirty.current = false
    setSelectedId(id)
  }, [])

  /** Clicking a skill in the list brings the panel back if it was hidden. */
  const open = useCallback(
    (id: string) => {
      select(id)
      showDetail(true)
    },
    [select, showDetail]
  )

  const onDirty = useCallback((d: boolean) => {
    dirty.current = d
  }, [])

  const onResult = useCallback((r: ActionResult) => {
    const hint = r.ok && /\.zip\b/i.test(r.message) ? PACK_HINT : undefined
    setToasts((t) => [...t, { ...r, id: Date.now() + Math.random(), hint }])
  }, [])

  const refreshInstalls = useCallback(async () => {
    setFetching(true)
    try {
      const next = await window.api.refreshInstalls()
      setInstalls(next)
      if (next.error) onResult({ ok: false, message: next.error })
    } finally {
      setFetching(false)
    }
  }, [onResult])

  const installer = useInstaller(
    useCallback(
      (hit, ok) => {
        onResult({
          ok,
          message: ok ? `Installed ${hit.name} into ~/.agents/skills` : `Couldn't install ${hit.name}`
        })
        if (ok) load()
      },
      [load, onResult]
    )
  )

  const selected = data?.skills.find((s) => s.id === selectedId) ?? null

  return (
    <div
      className={`app ${view === 'library' && detailHidden ? 'detail-hidden' : ''}`}
      style={listWidth !== null ? ({ '--list-w': `${listWidth}px` } as React.CSSProperties) : undefined}
    >
      <Sidebar
        skills={data?.skills ?? []}
        view={view}
        onView={setView}
        installing={installer.active !== null}
        onOpenInstalled={(s) => {
          if (s.registry) {
            setDiscoverPath([...s.registry.source.split('/'), s.registry.skillId])
          } else {
            // No skills.sh page for it (made locally): show it in My skills instead.
            setView('library')
            setSource('all')
            setQuery('')
            setGroup(null)
            setFlags({ notLinked: false, warnings: false, sameName: false })
            select(s.id)
          }
        }}
        source={source}
        flags={flags}
        loading={loading}
        groups={groups}
        group={group}
        onGroup={setGroup}
        onSource={setSource}
        onFlags={setFlags}
        onRefresh={load}
        installs={installs}
        fetchingInstalls={fetching}
        onRefreshInstalls={refreshInstalls}
      />
      {view === 'discover' ? (
        <Discover
          skills={data?.skills ?? []}
          installer={installer}
          onResult={onResult}
          path={discoverPath}
          onPath={setDiscoverPath}
        />
      ) : (
        <>
          <SkillList
            skills={visible}
            selectedId={selectedId}
            query={query}
            showSource={source === 'all'}
            installs={installs}
            sort={sort}
            onSort={setSort}
            onQuery={setQuery}
            onSelect={select}
            onOpen={open}
            detailHidden={detailHidden}
            onToggleDetail={() => showDetail(detailHidden)}
            onResize={resizeList}
          />
          {detailHidden ? null : error ? (
            <section className="detail empty-detail">
              <p>Couldn't scan skills: {error}</p>
            </section>
          ) : selected && data ? (
            <SkillDetail
              key={selected.id}
              skill={selected}
              tools={data.tools}
              groups={groups}
              all={data.skills}
              installs={installs}
              onSelect={select}
              version={version}
              onDirty={onDirty}
              onResult={onResult}
              onHide={() => showDetail(false)}
            />
          ) : (
            <section className="detail empty-detail">
              <p>{data ? 'Select a skill.' : 'Scanning…'}</p>
            </section>
          )}
        </>
      )}
      <Toasts items={toasts} onClose={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </div>
  )
}
