import { memo, useEffect, useRef } from 'react'
import type { Cell, Term } from '../terminal'
import { Icon } from './Icon'

/** Consecutive cells with the same style become one span. */
function runs(line: Cell[]): { text: string; cls: string }[] {
  const out: { text: string; cls: string }[] = []
  for (const { ch, style } of line) {
    const cls = [
      style.fg !== undefined && `fg${style.fg}`,
      style.bg !== undefined && `bg${style.bg}`,
      style.bold && 'b',
      style.dim && 'd'
    ]
      .filter(Boolean)
      .join(' ')
    const last = out[out.length - 1]
    if (last && last.cls === cls) last.text += ch
    else out.push({ text: ch, cls })
  }
  return out
}

interface Props {
  term: Term
  tick: number
  running: string | null
  onCancel(): void
  onClear(): void
}

export const Terminal = memo(function Terminal({ term, tick, running, onCancel, onClear }: Props): React.JSX.Element {
  const body = useRef<HTMLDivElement>(null)
  const stick = useRef(true)

  // Follow the output unless the user scrolled up to read.
  useEffect(() => {
    const el = body.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [tick])

  const empty = term.lines.length === 1 && term.lines[0].length === 0

  return (
    <div className="term">
      <div className="term-head">
        <Icon name="terminal" size={14} />
        <span className="term-title">Terminal</span>
        {running && (
          <span className="term-running">
            <span className="spin">
              <Icon name="refresh" size={12} />
            </span>
            Installing {running}
          </span>
        )}
        <span className="term-spacer" />
        {running ? (
          <button className="btn small term-btn" onClick={onCancel}>
            <Icon name="x" size={12} />
            Stop
          </button>
        ) : (
          <button className="btn small term-btn" onClick={onClear} disabled={empty}>
            Clear
          </button>
        )}
      </div>
      <div
        className="term-body"
        ref={body}
        onScroll={(e) => {
          const el = e.currentTarget
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
        }}
      >
        {empty ? (
          <div className="term-hint">Install output shows up here.</div>
        ) : (
          term.lines.map((line, i) => (
            <div className="term-line" key={i}>
              {runs(line).map((r, j) => (
                <span key={j} className={r.cls || undefined}>
                  {r.text}
                </span>
              ))}
              {line.length === 0 && ' '}
            </div>
          ))
        )}
      </div>
    </div>
  )
})
