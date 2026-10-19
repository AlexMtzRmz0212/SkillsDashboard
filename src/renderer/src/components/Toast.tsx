import { useEffect, useState } from 'react'
import { Icon } from './Icon'

export interface ToastItem {
  id: number
  ok: boolean
  message: string
  output?: string
  hint?: string
}

function ToastView({ t, onClose }: { t: ToastItem; onClose(): void }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!t.ok || t.hint || open) return
    const timer = setTimeout(onClose, 5000)
    return () => clearTimeout(timer)
  }, [t, open, onClose])

  return (
    <div className={`toast ${t.ok ? 'ok' : 'err'}`} role="status">
      <span className="toast-icon">
        <Icon name={t.ok ? 'check' : 'warn'} />
      </span>
      <div className="toast-body">
        <div className="toast-msg">{t.message}</div>
        {t.hint && <div className="toast-hint">{t.hint}</div>}
        {t.output && (
          <button className="link-btn" onClick={() => setOpen(!open)}>
            {open ? 'Hide output' : 'Show output'}
          </button>
        )}
        {open && t.output && <pre className="toast-out">{t.output}</pre>}
      </div>
      <button className="icon-btn small" onClick={onClose} aria-label="Dismiss">
        <Icon name="x" size={14} />
      </button>
    </div>
  )
}

export function Toasts({ items, onClose }: { items: ToastItem[]; onClose(id: number): void }): React.JSX.Element {
  return (
    <div className="toasts">
      {items.map((t) => (
        <ToastView key={t.id} t={t} onClose={() => onClose(t.id)} />
      ))}
    </div>
  )
}
