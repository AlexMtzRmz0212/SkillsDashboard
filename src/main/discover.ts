import { spawn, type ChildProcess } from 'child_process'
import { ALL_SKILLS, installCommand, type InstallEvent, type InstallStart, type RegistryHit, type SearchResult } from '@shared/types'

// Same undocumented endpoint `npx skills find` uses (see installs.ts).
const SEARCH = 'https://skills.sh/api/search'

// The values end up on a shell command line, so only plain repo and skill names get through.
const SOURCE_RE = /^[\w.-]+\/[\w.-]+$/
const SKILL_RE = /^[\w.-]+$/

export async function searchRegistry(query: string): Promise<SearchResult> {
  const q = query.trim()
  if (q.length < 2) return { skills: [] }
  try {
    const res = await fetch(`${SEARCH}?q=${encodeURIComponent(q)}&limit=40`, {
      signal: AbortSignal.timeout(15000)
    })
    const body = (await res.json()) as { skills?: Partial<RegistryHit>[]; error?: string }
    if (!res.ok) return { skills: [], error: body.error ?? `skills.sh answered ${res.status}` }
    const skills = (body.skills ?? [])
      .filter((s) => s.source && s.skillId)
      .map((s) => ({
        id: s.id ?? `${s.source}/${s.skillId}`,
        source: s.source!,
        skillId: s.skillId!,
        name: s.name ?? s.skillId!,
        installs: typeof s.installs === 'number' ? s.installs : 0
      }))
    return { skills }
  } catch (e) {
    return { skills: [], error: `Couldn't reach skills.sh: ${(e as Error).message}` }
  }
}

let running: { id: string; child: ChildProcess } | null = null

/**
 * Installs one skill into ~/.agents/skills (`-g` is the user-level scope). With `withClaude` the
 * CLI also symlinks it into ~/.claude/skills, which the dashboard shows as "Linked to Claude".
 */
export function installSkill(
  source: string,
  skillId: string,
  withClaude: boolean,
  emit: (e: InstallEvent) => void
): InstallStart {
  if (running) return { ok: false, message: 'Another install is still running.' }
  if (!SOURCE_RE.test(source) || !(skillId === ALL_SKILLS || SKILL_RE.test(skillId)))
    return { ok: false, message: 'That skill name has characters the installer will not accept.' }

  const id = `${Date.now()}`
  // npx is a .cmd file on Windows, which Node only runs through a shell. source and skillId
  // were validated above, so the string needs no escaping.
  const command = installCommand(source, skillId, withClaude)
  const child = spawn(command, { shell: true, windowsHide: true, env: { ...process.env, FORCE_COLOR: '1' } })
  running = { id, child }

  const send = (data: string): void => emit({ type: 'data', id, data })
  send(`\x1b[2m$ ${command}\x1b[0m\r\n`)
  child.stdout?.on('data', (d: Buffer) => send(d.toString('utf8')))
  child.stderr?.on('data', (d: Buffer) => send(d.toString('utf8')))

  let done = false
  const finish = (code: number | null): void => {
    if (done) return
    done = true
    running = null
    emit({ type: 'exit', id, code })
  }
  child.on('error', (e) => {
    send(`\x1b[31m${e.message}\x1b[0m\r\n`)
    finish(-1)
  })
  child.on('close', (code) => finish(code))
  return { ok: true, id }
}

export function cancelInstall(): void {
  const pid = running?.child.pid
  if (!pid) return
  // The shell and npx each spawn children; kill the whole tree.
  spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true })
}
