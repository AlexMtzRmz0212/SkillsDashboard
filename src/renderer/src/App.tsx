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
  const dirty = useRef(false)

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
    <div className="app">
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
          />
          {error ? (
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
