import { useCallback, useEffect, useRef, useState } from 'react'
import type { InstallEvent, RegistryHit } from '@shared/types'
import { newTerm, writeTerm, type Term } from './terminal'

export interface InstallerApi {
  term: Term
  /** Bumps whenever `term` changed, so memoised views know to redraw. */
  tick: number
  /** The skill being installed right now, if any. */
  active: RegistryHit | null
  /** Also link new installs into ~/.claude/skills. Starts on every time the app opens. */
  withClaude: boolean
  setWithClaude(v: boolean): void
  install(hit: RegistryHit): void
  cancel(): void
  clear(): void
}

/**
 * Owns the terminal output and the one running install. Lives in App so output survives
 * switching between My skills and Discover.
 */
export function useInstaller(onDone: (hit: RegistryHit, ok: boolean) => void): InstallerApi {
  const term = useRef<Term>(newTerm())
  const [tick, setTick] = useState(0)
  const [active, setActive] = useState<RegistryHit | null>(null)
  const [withClaude, setWithClaude] = useState(true)
  const withClaudeRef = useRef(withClaude)
  withClaudeRef.current = withClaude
  const current = useRef<{ id: string | null; hit: RegistryHit } | null>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const frame = useRef(0)

  const redraw = useCallback(() => {
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      setTick((n) => n + 1)
    })
  }, [])

  useEffect(() => {
    return window.api.onInstallEvent((e: InstallEvent) => {
      const cur = current.current
      if (!cur) return
      if (cur.id === null) cur.id = e.id // first event can arrive before the invoke resolves
      if (cur.id !== e.id) return
      if (e.type === 'data') {
        writeTerm(term.current, e.data)
        redraw()
        return
      }
      const ok = e.code === 0
      writeTerm(
        term.current,
        ok
          ? '\r\n\x1b[32m✓ Done\x1b[0m\r\n'
          : `\r\n\x1b[31m✗ Failed${e.code === null ? '' : ` (exit code ${e.code})`}\x1b[0m\r\n`
      )
      current.current = null
      setActive(null)
      redraw()
      onDoneRef.current(cur.hit, ok)
    })
  }, [redraw])

  const install = useCallback(
    (hit: RegistryHit) => {
      if (current.current) return
      current.current = { id: null, hit }
      setActive(hit)
      window.api.installSkill(hit.source, hit.skillId, withClaudeRef.current).then((r) => {
        if (r.ok) {
          if (current.current && current.current.id === null) current.current.id = r.id!
          return
        }
        writeTerm(term.current, `\x1b[31m${r.message ?? 'Could not start the install.'}\x1b[0m\r\n`)
        current.current = null
        setActive(null)
        redraw()
      })
    },
    [redraw]
  )

  const cancel = useCallback(() => {
    window.api.cancelInstall()
  }, [])

  const clear = useCallback(() => {
    term.current = newTerm()
    setTick((n) => n + 1)
  }, [])

  return { term: term.current, tick, active, withClaude, setWithClaude, install, cancel, clear }
}
