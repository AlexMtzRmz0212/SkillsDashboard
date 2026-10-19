import { useState } from 'react'
import type { Skill } from '@shared/types'
import type { GroupsApi } from '../useGroups'
import { Icon } from './Icon'

/** Filter value for skills that are in no group. */
export const UNGROUPED = '__ungrouped'

interface Props {
  skills: Skill[]
  groups: GroupsApi
  active: string | null
  onActive(id: string | null): void
}

/** Text field used both for naming a new group and renaming one. */
function NameInput({
  initial,
  onDone
}: {
  initial: string
  onDone(name: string | null): void
}): React.JSX.Element {
  const [value, setValue] = useState(initial)
  const finish = (): void => onDone(value.trim() ? value.trim() : null)
  return (
    <input
      className="group-input"
      autoFocus
      value={value}
      maxLength={80}
      placeholder="Group name"
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={finish}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish()
        if (e.key === 'Escape') onDone(null)
      }}
    />
  )
}

export function GroupNav({ skills, groups, active, onActive }: Props): React.JSX.Element {
  const [creating, setCreating] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)

  const count = (id: string): number => skills.filter((s) => groups.of(s.id).includes(id)).length
  const ungrouped = skills.filter((s) => groups.of(s.id).length === 0).length

  return (
    <>
      <div className="nav-label with-action">
        Groups
        <button className="icon-btn small" onClick={() => setCreating(true)} title="New group" aria-label="New group">
          <Icon name="plus" size={14} />
        </button>
      </div>

      {groups.groups.map((g) =>
        renaming === g.id ? (
          <NameInput
            key={g.id}
            initial={g.name}
            onDone={(name) => {
              if (name) groups.rename(g.id, name)
              setRenaming(null)
            }}
          />
        ) : (
          <div key={g.id} className={`nav-item group-item ${active === g.id ? 'active' : ''}`}>
            <button
              className="group-main"
              onClick={() => onActive(active === g.id ? null : g.id)}
              onDoubleClick={() => setRenaming(g.id)}
              title="Click to filter, double-click to rename"
            >
              <Icon name="tag" size={14} />
              <span className="nav-text">{g.name}</span>
              <span className="count">{count(g.id)}</span>
            </button>
            <span className="group-tools">
              <button className="icon-btn small" onClick={() => setRenaming(g.id)} aria-label={`Rename ${g.name}`}>
                <Icon name="pencil" size={13} />
              </button>
              <button
                className="icon-btn small"
                aria-label={`Delete ${g.name}`}
                onClick={() => {
                  if (!confirm(`Delete the group "${g.name}"? The skills themselves stay as they are.`)) return
                  if (active === g.id) onActive(null)
                  groups.remove(g.id)
                }}
              >
                <Icon name="x" size={13} />
              </button>
            </span>
          </div>
        )
      )}

      {creating && (
        <NameInput
          initial=""
          onDone={(name) => {
            if (name) onActive(groups.create(name))
            setCreating(false)
          }}
        />
      )}

      {groups.groups.length > 0 ? (
        <button
          className={`nav-item ${active === UNGROUPED ? 'active' : ''}`}
          onClick={() => onActive(active === UNGROUPED ? null : UNGROUPED)}
        >
          <span className="tag-icon-muted">
            <Icon name="tag" size={14} />
          </span>
          <span className="nav-text muted-text">Ungrouped</span>
          <span className="count">{ungrouped}</span>
        </button>
      ) : (
        !creating && (
          <button className="nav-empty" onClick={() => setCreating(true)}>
            Make a group to collect related skills.
          </button>
        )
      )}
    </>
  )
}
