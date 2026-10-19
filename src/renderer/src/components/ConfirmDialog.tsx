import { useEffect, useRef } from 'react'
import { Icon } from './Icon'

interface Props {
  title: string
  children: React.ReactNode
  confirmLabel: string
  busy?: boolean
  onConfirm(): void
  onCancel(): void
}

/** A destructive-action confirmation. Focus starts on Cancel and Esc dismisses it. */
export function ConfirmDialog({ title, children, confirmLabel, busy, onConfirm, onCancel }: Props): React.JSX.Element {
  const cancel = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancel.current?.focus()
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div className="modal" role="alertdialog" aria-modal="true" aria-label={title}>
        <h2>
          <Icon name="warn" />
          {title}
        </h2>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">
          <button ref={cancel} className="btn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button className="btn danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
