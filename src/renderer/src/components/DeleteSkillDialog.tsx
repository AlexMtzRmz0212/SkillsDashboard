import { useState } from 'react'
import type { ActionResult, Skill } from '@shared/types'
import { ConfirmDialog } from './ConfirmDialog'

interface Props {
  skill: Skill
  onResult(r: ActionResult): void
  /** Called once the delete finished (ok or not) and the dialog should close. */
  onClose(deleted: boolean): void
}

/** Confirms, then moves a skill to the Recycle Bin. Shared by the detail pane and Discover. */
export function DeleteSkillDialog({ skill, onResult, onClose }: Props): React.JSX.Element {
  const [deleting, setDeleting] = useState(false)

  const remove = async (): Promise<void> => {
    setDeleting(true)
    let r: ActionResult
    try {
      r = await window.api.deleteSkill(skill.id)
    } catch (e) {
      r = { ok: false, message: (e as Error).message }
    }
    onResult(r)
    setDeleting(false)
    onClose(r.ok)
  }

  return (
    <ConfirmDialog
      title={`Delete “${skill.name}”?`}
      confirmLabel="Delete skill"
      busy={deleting}
      onConfirm={remove}
      onCancel={() => onClose(false)}
    >
      <p>This removes the skill from this PC. Claude and your other agents stop seeing it right away.</p>
      <ul>
        <li>
          Folder: <code>{skill.path}</code> ({skill.files.length} {skill.files.length === 1 ? 'file' : 'files'})
        </li>
        {skill.source === 'agents' && skill.linkState === 'linked' && (
          <li>Its link in ~/.claude/skills is removed too.</li>
        )}
        {skill.source === 'claude' && skill.realPath !== skill.path && (
          <li>
            This is a link: only the link goes. <code>{skill.realPath}</code> is left alone.
          </li>
        )}
        {skill.sameName.length > 0 && <li>Copies of this skill in other locations are not touched.</li>}
      </ul>
      <p>The folder goes to the Recycle Bin, so you can restore it from there.</p>
    </ConfirmDialog>
  )
}
