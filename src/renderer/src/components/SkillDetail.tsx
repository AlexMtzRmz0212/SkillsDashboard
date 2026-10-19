import { useEffect, useState } from 'react'
import type { ActionResult, InstallsState, Skill, ToolAvailability } from '@shared/types'
import { ACCOUNT_ORIGIN, SOURCE_LABEL, relativeTime, splitFrontmatter } from '../lib'
import type { GroupsApi } from '../useGroups'
import { DeleteSkillDialog } from './DeleteSkillDialog'
import { Editor } from './Editor'
import { GroupPicker } from './GroupPicker'
import { FileTree } from './FileTree'
import { Icon } from './Icon'
import { InstallsBadge } from './Installs'
import { Markdown } from './Markdown'
import { SameName } from './SameName'

type Tab = 'preview' | 'files' | 'edit'

interface Props {
  skill: Skill
  tools: ToolAvailability
  groups: GroupsApi
  /** Every scanned skill, to show same-name copies. */
  all: Skill[]
  installs: InstallsState
  onSelect(id: string): void
  version: number
  onDirty(dirty: boolean): void
  onResult(r: ActionResult): void
}

const LINK_LABEL: Record<string, string> = {
  linked: 'Linked to Claude',
  'not-linked': 'Not linked to Claude',
  conflict: 'Name taken in ~/.claude/skills',
  real: 'Separate copy in ~/.claude/skills'
}

export function SkillDetail({ skill, tools, groups, all, installs, onSelect, version, onDirty, onResult }: Props): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('preview')
  const [text, setText] = useState<string | null>(null)
  const [busy, setBusy] = useState<'link' | 'pack' | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    let live = true
    window.api
      .readFile(skill.id, 'SKILL.md')
      .then((t) => live && setText(t))
      .catch((e) => live && setText(`(could not read SKILL.md: ${e.message})`))
    return () => {
      live = false
    }
  }, [skill.id, version])

  useEffect(() => {
    if (tab === 'edit' && !skill.editable) setTab('preview')
  }, [skill.id, skill.editable, tab])

  const run = async (kind: 'link' | 'pack'): Promise<void> => {
    setBusy(kind)
    try {
      onResult(await (kind === 'link' ? window.api.link(skill.id) : window.api.pack(skill.id)))
    } catch (e) {
      onResult({ ok: false, message: (e as Error).message })
    } finally {
      setBusy(null)
    }
  }

  const fm = text ? splitFrontmatter(text) : null
  const canDelete = skill.editable && (skill.source === 'claude' || skill.source === 'agents')
  const canPack = tools.pack && (skill.source === 'claude' || skill.source === 'agents')
  const canLink = tools.link && skill.source === 'agents' && skill.linkState === 'not-linked'
  const origin =
    skill.source === 'account'
      ? (ACCOUNT_ORIGIN[skill.accountSource ?? ''] ?? skill.accountSource)
      : skill.plugin
        ? `${skill.plugin.marketplace} / ${skill.plugin.plugin}`
        : null

  return (
    <section className="detail">
      <header className="detail-head">
        <div className="eyebrow">
          <span className={`dot dot-${skill.source}`} />
          {SOURCE_LABEL[skill.source]}
          {origin && <span className="eyebrow-sub">· {origin}</span>}
          <span className="eyebrow-sub">· updated {relativeTime(skill.updatedAt)}</span>
        </div>
        <h1>{skill.name}</h1>
        <div className="badges">
          {skill.linkState && (
            <span className={`tag ${skill.linkState === 'linked' ? 'tag-ok' : 'tag-muted'}`}>
              {LINK_LABEL[skill.linkState]}
            </span>
          )}
          {!skill.editable && (
            <span className="tag tag-muted">
              <Icon name="lock" size={12} /> Read-only
            </span>
          )}
          <span className="tag tag-muted">
            {skill.files.length} {skill.files.length === 1 ? 'file' : 'files'}
          </span>
          <InstallsBadge skill={skill} installs={installs} />
        </div>
        <GroupPicker skillId={skill.id} groups={groups} />
        <button className="path" onClick={() => window.api.showInExplorer(skill.id)} title="Show in Explorer">
          {skill.realPath}
        </button>

        <div className="actions">
          {canLink && (
            <button className="btn primary" disabled={!!busy} onClick={() => run('link')}>
              <Icon name="link" /> {busy === 'link' ? 'Linking…' : 'Link to Claude'}
            </button>
          )}
          {canPack && (
            <button className="btn" disabled={!!busy} onClick={() => run('pack')}>
              <Icon name="package" /> {busy === 'pack' ? 'Packing…' : 'Pack for claude.ai'}
            </button>
          )}
          <button className="btn" onClick={() => window.api.openFolder(skill.id)}>
            <Icon name="folder" /> Open folder
          </button>
          <button className="btn" onClick={() => window.api.openSkillMd(skill.id)}>
            <Icon name="external" /> Open SKILL.md
          </button>
          {canDelete && (
            <button className="btn danger-outline actions-end" disabled={!!busy} onClick={() => setConfirming(true)}>
              <Icon name="trash" /> Delete
            </button>
          )}
        </div>

        {skill.warnings.length > 0 && (
          <ul className="warnings">
            {skill.warnings.map((w) => (
              <li key={w}>
                <Icon name="warn" size={14} /> <span>{w.replace(/`/g, '')}</span>
              </li>
            ))}
          </ul>
        )}
        <SameName skill={skill} all={all} onSelect={onSelect} />
      </header>

      <div className="tabs" role="tablist">
        {(['preview', 'files', 'edit'] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`tab ${tab === t ? 'active' : ''}`}
            disabled={t === 'edit' && !skill.editable}
            title={
              t === 'edit' && !skill.editable
                ? skill.source === 'account'
                  ? 'Account skills are synced from claude.ai; edit them there.'
                  : 'Plugin skills are replaced when the marketplace updates.'
                : undefined
            }
            onClick={() => setTab(t)}
          >
            {t === 'preview' ? 'Preview' : t === 'files' ? 'Files' : 'Edit'}
          </button>
        ))}
      </div>

      <div className="tab-body">
        {tab === 'preview' &&
          (fm === null ? (
            <div className="muted pad">Loading…</div>
          ) : (
            <div className="preview">
              {fm.fields.length > 0 && (
                <dl className="fm">
                  {fm.fields.map(([k, v]) => (
                    <div key={k} className="fm-row">
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <Markdown text={fm.body} />
            </div>
          ))}
        {tab === 'files' && <FileTree skill={skill} version={version} />}
        {tab === 'edit' && skill.editable && (
          <Editor skill={skill} version={version} onDirty={onDirty} onResult={onResult} />
        )}
      </div>

      {confirming && (
        <DeleteSkillDialog
          skill={skill}
          onResult={onResult}
          onClose={(deleted) => {
            if (deleted) onDirty(false)
            setConfirming(false)
          }}
        />
      )}
    </section>
  )
}
