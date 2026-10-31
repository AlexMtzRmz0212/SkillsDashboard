import { useEffect, useRef } from 'react'
import type { InstallsState, Skill } from '@shared/types'
import { SOURCE_LABEL, SOURCE_SHORT } from '../lib'
import { Icon } from './Icon'
import { InstallsCount } from './Installs'

export type SortKey = 'name' | 'installs'

interface Props {
  skills: Skill[]
  selectedId: string | null
  query: string
  /** Tag each row with its source (used in the All view, where copies of a skill sit side by side). */
  showSource: boolean
  installs: InstallsState
  sort: SortKey
  onSort(s: SortKey): void
  onQuery(q: string): void
  onSelect(id: string): void
  /** A click on a row (not the arrow keys): selects it and shows the detail panel again. */
  onOpen(id: string): void
  detailHidden: boolean
  onToggleDetail(): void
  /** Dragged list width in px (null = back to the default); `save` is true when the drag ends. */
  onResize(px: number | null, save: boolean): void
}

const MIN_LIST = 260
const MIN_DETAIL = 380

export function SkillList({
  skills,
  selectedId,
  query,
  showSource,
  installs,
  sort,
  onSort,
  onQuery,
  onSelect,
  onOpen,
  detailHidden,
  onToggleDetail,
  onResize
}: Props): React.JSX.Element {
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLElement>(null)

  const drag = (e: React.PointerEvent<HTMLDivElement>): void => {
    const left = listRef.current?.getBoundingClientRect().left ?? 0
    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)
    const width = (ev: PointerEvent): number =>
      Math.max(MIN_LIST, Math.min(ev.clientX - left, window.innerWidth - left - MIN_DETAIL))
    const move = (ev: PointerEvent): void => onResize(width(ev), false)
    const up = (ev: PointerEvent): void => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', up)
      handle.removeEventListener('pointercancel', up)
      onResize(width(ev), true)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', up)
    handle.addEventListener('pointercancel', up)
  }

  // Ctrl+K / Ctrl+F focus search; arrow keys move the selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'f')) {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
        return
      }
      const target = e.target as HTMLElement
      if (target.closest('.cm-editor') || (target.tagName === 'INPUT' && target !== searchRef.current)) return
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      if (!skills.length) return
      e.preventDefault()
      const i = skills.findIndex((s) => s.id === selectedId)
      const next = e.key === 'ArrowDown' ? Math.min(skills.length - 1, i + 1) : Math.max(0, i - 1)
      onSelect(skills[next].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [skills, selectedId, onSelect])

  useEffect(() => {
    document.querySelector('.row.selected')?.scrollIntoView({ block: 'nearest' })
  }, [selectedId])

  return (
    <section className="list" ref={listRef}>
      {!detailHidden && (
        <div
          className="resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize skill panel"
          title="Drag to resize, double-click to reset"
          onPointerDown={drag}
          onDoubleClick={() => onResize(null, true)}
        />
      )}
      <div className="search">
        <Icon name="search" />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search names and descriptions"
          spellCheck={false}
          aria-label="Search skills"
        />
        {query ? (
          <button className="icon-btn small" onClick={() => onQuery('')} aria-label="Clear search">
            <Icon name="x" size={14} />
          </button>
        ) : (
          <kbd>Ctrl K</kbd>
        )}
      </div>
      <div className="list-meta">
        <span>
          {skills.length} {skills.length === 1 ? 'skill' : 'skills'}
        </span>
        <div className="list-meta-end">
          <label className="sort">
            Sort
            <select value={sort} onChange={(e) => onSort(e.target.value as SortKey)} aria-label="Sort skills">
              <option value="name">Name</option>
              <option value="installs">Installs</option>
            </select>
          </label>
          <button
            className="icon-btn small"
            onClick={onToggleDetail}
            title={detailHidden ? 'Show panel' : 'Hide panel'}
            aria-label={detailHidden ? 'Show skill panel' : 'Hide skill panel'}
            aria-pressed={!detailHidden}
          >
            <Icon name="panel" size={15} />
          </button>
        </div>
      </div>
      <div className="rows" role="listbox" aria-label="Skills">
        {skills.map((s) => (
          <button
            key={s.id}
            role="option"
            aria-selected={s.id === selectedId}
            className={`row ${s.id === selectedId ? 'selected' : ''}`}
            onClick={() => onOpen(s.id)}
          >
            <div className="row-top">
              <span className={`dot dot-${s.source}`} title={SOURCE_LABEL[s.source]} />
              <span className="row-name">{s.name}</span>
              <InstallsCount skill={s} installs={installs} />
              {s.warnings.length > 0 && (
                <span className="row-warn" title={s.warnings.join('\n')}>
                  <Icon name="warn" size={13} />
                </span>
              )}
              {s.linkState === 'not-linked' && <span className="tag tag-muted">not linked</span>}
              {s.sameName.length > 0 && (
                <span className="tag tag-copies" title={`Same name in ${s.sameName.length + 1} locations`}>
                  <Icon name="copy" size={11} />
                  {s.sameName.length + 1}
                </span>
              )}
              {s.plugin && <span className="tag tag-muted">{s.plugin.plugin}</span>}
              {showSource && !s.plugin && <span className="tag tag-src">{SOURCE_SHORT[s.source]}</span>}
              {s.accountSource === 'plugin' && <span className="tag tag-accent">yours</span>}
            </div>
            <div className="row-desc">{s.description || <em>No description</em>}</div>
          </button>
        ))}
        {skills.length === 0 && <div className="empty">No skills match.</div>}
      </div>
    </section>
  )
}
