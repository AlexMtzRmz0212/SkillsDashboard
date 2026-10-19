import { useEffect, useRef, useState } from 'react'
import type { GroupsApi } from '../useGroups'
import { Icon } from './Icon'

/** The selected skill's groups as removable chips, plus a menu to add it to more. */
export function GroupPicker({ skillId, groups }: { skillId: string; groups: GroupsApi }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const mine = groups.of(skillId)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const addNew = (): void => {
    const name = draft.trim()
    if (!name) return
    const existing = groups.groups.find((g) => g.name.toLowerCase() === name.toLowerCase())
    const id = existing?.id ?? groups.create(name)
    if (!mine.includes(id)) groups.toggle(skillId, id)
    setDraft('')
  }

  return (
    <div className="group-picker" ref={ref}>
      {groups.groups
        .filter((g) => mine.includes(g.id))
        .map((g) => (
          <span key={g.id} className="chip">
            <Icon name="tag" size={12} />
            {g.name}
            <button onClick={() => groups.toggle(skillId, g.id)} aria-label={`Remove from ${g.name}`}>
              <Icon name="x" size={11} />
            </button>
          </span>
        ))}
      <button className="chip chip-add" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Icon name="plus" size={12} />
        {mine.length ? 'Group' : 'Add to group'}
      </button>

      {open && (
        <div className="menu" role="menu">
          {groups.groups.map((g) => (
            <label key={g.id} className="menu-item">
              <input type="checkbox" checked={mine.includes(g.id)} onChange={() => groups.toggle(skillId, g.id)} />
              <span>{g.name}</span>
            </label>
          ))}
          {groups.groups.length > 0 && <div className="menu-sep" />}
          <input
            className="menu-input"
            autoFocus
            value={draft}
            maxLength={80}
            placeholder="New group…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addNew()
            }}
          />
        </div>
      )}
    </div>
  )
}
