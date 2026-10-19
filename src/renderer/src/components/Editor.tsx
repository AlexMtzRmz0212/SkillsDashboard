import { useCallback, useEffect, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import type { ActionResult, Skill } from '@shared/types'
import { TEXT_EXT } from '../lib'
import { editorExtensions } from '../editorSetup'

interface Props {
  skill: Skill
  version: number
  onDirty(dirty: boolean): void
  onResult(r: ActionResult): void
}

export function Editor({ skill, version, onDirty, onResult }: Props): React.JSX.Element {
  const editable = skill.files.filter((f) => TEXT_EXT.test(f))
  const [file, setFile] = useState('SKILL.md')
  const [original, setOriginal] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const dirty = original !== null && text !== original

  useEffect(() => setFile('SKILL.md'), [skill.id])

  // Reload from disk when the file changes, unless there are unsaved edits.
  useEffect(() => {
    if (dirty) return
    let live = true
    window.api.readFile(skill.id, file).then((t) => {
      if (!live) return
      setOriginal(t)
      setText(t)
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skill.id, file, version])

  useEffect(() => onDirty(dirty), [dirty, onDirty])

  const save = useCallback(async () => {
    if (!dirty || saving) return
    setSaving(true)
    try {
      const r = await window.api.saveFile(skill.id, file, text)
      if (r.ok) setOriginal(text)
      onResult(r)
    } catch (e) {
      onResult({ ok: false, message: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }, [dirty, saving, skill.id, file, text, onResult])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save])

  const switchFile = (next: string): void => {
    if (dirty && !confirm(`Discard unsaved changes to ${file}?`)) return
    setOriginal(null)
    setFile(next)
  }

  return (
    <div className="editor">
      <div className="editor-bar">
        <select value={file} onChange={(e) => switchFile(e.target.value)} aria-label="File to edit">
          {editable.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <span className={`dirty ${dirty ? 'on' : ''}`}>{dirty ? 'Unsaved changes' : 'Saved'}</span>
        <div className="spacer" />
        <button className="btn ghost" disabled={!dirty} onClick={() => setText(original ?? '')}>
          Revert
        </button>
        <button className="btn primary" disabled={!dirty || saving} onClick={save}>
          {saving ? 'Saving…' : 'Save'} <kbd>Ctrl S</kbd>
        </button>
      </div>
      <div className="cm-wrap">
        {original === null ? (
          <div className="muted pad">Loading…</div>
        ) : (
          <CodeMirror
            value={text}
            onChange={setText}
            extensions={editorExtensions}
            theme="none"
            height="100%"
            basicSetup={{ foldGutter: false, syntaxHighlighting: false }}
          />
        )}
      </div>
    </div>
  )
}
