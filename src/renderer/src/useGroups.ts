import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Group, GroupsState } from '@shared/types'

export interface GroupsApi {
  groups: Group[]
  /** Group ids a skill belongs to. */
  of(skillId: string): string[]
  create(name: string): string
  rename(id: string, name: string): void
  remove(id: string): void
  toggle(skillId: string, groupId: string): void
}

/** Groups live in the main process (groups.json); every change is saved straight away. */
export function useGroups(): GroupsApi {
  const [state, setState] = useState<GroupsState>({ groups: [], members: {} })
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    window.api.getGroups().then((s) => {
      setState(s)
      setLoaded(true)
    })
  }, [])

  useEffect(() => {
    if (loaded) window.api.saveGroups(state)
  }, [state, loaded])

  const of = useCallback((skillId: string) => state.members[skillId] ?? [], [state])

  const create = useCallback((name: string) => {
    const id = crypto.randomUUID()
    setState((s) => ({ ...s, groups: [...s.groups, { id, name: name.trim() }] }))
    return id
  }, [])

  const rename = useCallback((id: string, name: string) => {
    setState((s) => ({ ...s, groups: s.groups.map((g) => (g.id === id ? { ...g, name: name.trim() } : g)) }))
  }, [])

  const remove = useCallback((id: string) => {
    setState((s) => {
      const members: GroupsState['members'] = {}
      for (const [skill, ids] of Object.entries(s.members)) {
        const rest = ids.filter((g) => g !== id)
        if (rest.length) members[skill] = rest
      }
      return { groups: s.groups.filter((g) => g.id !== id), members }
    })
  }, [])

  const toggle = useCallback((skillId: string, groupId: string) => {
    setState((s) => {
      const cur = s.members[skillId] ?? []
      const next = cur.includes(groupId) ? cur.filter((g) => g !== groupId) : [...cur, groupId]
      const members = { ...s.members }
      if (next.length) members[skillId] = next
      else delete members[skillId]
      return { ...s, members }
    })
  }, [])

  return useMemo(
    () => ({ groups: state.groups, of, create, rename, remove, toggle }),
    [state.groups, of, create, rename, remove, toggle]
  )
}
