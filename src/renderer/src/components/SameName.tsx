import type { Skill } from '@shared/types'
import { SOURCE_LABEL } from '../lib'
import { Icon } from './Icon'

interface Props {
  skill: Skill
  all: Skill[]
  onSelect(id: string): void
}

function compare(a: Skill, b: Skill): { label: string; tone: 'ok' | 'warn' | 'muted' } {
  if (a.skillMdHash === b.skillMdHash)
    return a.filesHash === b.filesHash
      ? { label: 'Identical', tone: 'ok' }
      : { label: 'Same SKILL.md, different files', tone: 'muted' }
  const newer = new Date(b.updatedAt) > new Date(a.updatedAt)
  return { label: `Different SKILL.md · ${newer ? 'newer' : 'older'}`, tone: 'warn' }
}

/** Other locations that hold a skill with this name, and how each differs from this one. */
export function SameName({ skill, all, onSelect }: Props): React.JSX.Element | null {
  const others = skill.sameName.map((id) => all.find((s) => s.id === id)).filter((s): s is Skill => !!s)
  if (!others.length) return null

  return (
    <div className="same-name">
      <div className="same-name-title">
        <Icon name="copy" size={14} />
        Same name in {others.length} other {others.length === 1 ? 'location' : 'locations'}
      </div>
      {others.map((o) => {
        const c = compare(skill, o)
        return (
          <button key={o.id} className="same-name-row" onClick={() => onSelect(o.id)} title={o.realPath}>
            <span className={`dot dot-${o.source}`} />
            <span className="same-name-src">
              {SOURCE_LABEL[o.source]}
              {o.plugin && <span className="muted"> · {o.plugin.plugin}</span>}
            </span>
            <span className={`tag tag-${c.tone}`}>{c.label}</span>
            <span className="same-name-go">View →</span>
          </button>
        )
      })}
    </div>
  )
}
