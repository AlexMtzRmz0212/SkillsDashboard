import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import { basename, join, resolve, sep } from 'path'
import { shell } from 'electron'
import type { ActionResult } from '@shared/types'
import { LINK_SCRIPT, PACK_SCRIPT, ROOTS } from './paths'
import { getSkill } from './scanner'

function runPowerShell(script: string, args: string[]): Promise<{ code: number; output: string }> {
  return new Promise((done) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ...args],
      { windowsHide: true }
    )
    let output = ''
    child.stdout.on('data', (d) => (output += d))
    child.stderr.on('data', (d) => (output += d))
    child.on('error', (e) => done({ code: -1, output: e.message }))
    child.on('close', (code) => done({ code: code ?? -1, output: output.trim() }))
  })
}

const under = (p: string, root: string): boolean => p.toLowerCase().startsWith(root.toLowerCase() + sep)

/** Resolve a path inside a skill and refuse anything that escapes it. */
function insideSkill(realRoot: string, relPath: string): string {
  const full = resolve(realRoot, relPath)
  if (!under(full, realRoot)) throw new Error('Path is outside the skill folder.')
  return full
}

function isEditableRoot(realPath: string): boolean {
  return (under(realPath, ROOTS.claude) && !under(realPath, ROOTS.account)) || under(realPath, ROOTS.agents)
}

export async function readFile(id: string, relPath: string): Promise<string> {
  const skill = getSkill(id)
  const full = insideSkill(skill.realPath, relPath)
  const { size } = await fs.stat(full)
  if (size > 2 * 1024 * 1024) return `(${(size / 1048576).toFixed(1)} MB — too large to preview)`
  const buf = await fs.readFile(full)
  if (buf.subarray(0, 8000).includes(0)) return '(binary file)'
  return buf.toString('utf8')
}

export async function saveFile(id: string, relPath: string, content: string): Promise<ActionResult> {
  const skill = getSkill(id)
  if (!skill.editable || !isEditableRoot(skill.realPath))
    return { ok: false, message: 'This skill is read-only here.' }
  await fs.writeFile(insideSkill(skill.realPath, relPath), content, 'utf8')
  return { ok: true, message: `Saved ${relPath}` }
}

export async function link(id: string): Promise<ActionResult> {
  const skill = getSkill(id)
  if (skill.source !== 'agents') return { ok: false, message: 'Only ~/.agents skills can be linked.' }
  const folder = basename(skill.path)
  const { code, output } = await runPowerShell(LINK_SCRIPT, ['-Name', folder])
  return {
    ok: code === 0,
    message: code === 0 ? `Linked ${folder} into ~/.claude/skills` : 'Link failed',
    output
  }
}

export async function pack(id: string): Promise<ActionResult> {
  const skill = getSkill(id)
  if (skill.source !== 'agents' && skill.source !== 'claude')
    return { ok: false, message: 'Only ~/.claude and ~/.agents skills can be packed.' }
  const { code, output } = await runPowerShell(PACK_SCRIPT, ['-Name', basename(skill.path), '-Reveal'])
  const result = output.split(/\r?\n/).find((l) => l.startsWith('RESULT:'))
  return {
    ok: code === 0 && !!result,
    message: result ? result.replace(/^RESULT:\s*/, '') : 'Packing failed',
    output
  }
}

export async function openFolder(id: string): Promise<void> {
  await shell.openPath(getSkill(id).realPath)
}

export async function openSkillMd(id: string): Promise<void> {
  await shell.openPath(getSkill(id).skillMdPath)
}

export async function showInExplorer(id: string): Promise<void> {
  shell.showItemInFolder(join(getSkill(id).realPath, 'SKILL.md'))
}

export async function openExternal(url: string): Promise<void> {
  if (/^https:\/\//.test(url)) await shell.openExternal(url)
}
