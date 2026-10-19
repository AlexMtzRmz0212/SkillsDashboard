import { useEffect, useMemo, useState } from 'react'
import type { Skill } from '@shared/types'
import { Markdown } from './Markdown'
import { splitFrontmatter } from '../lib'

interface Node {
  name: string
  path: string
  children: Node[]
  isFile: boolean
}

function buildTree(files: string[]): Node[] {
  const root: Node = { name: '', path: '', children: [], isFile: false }
  for (const f of files) {
    let cur = root
    const parts = f.split('/')
    parts.forEach((part, i) => {
      const path = parts.slice(0, i + 1).join('/')
      let next = cur.children.find((c) => c.name === part)
      if (!next) {
        next = { name: part, path, children: [], isFile: i === parts.length - 1 }
        cur.children.push(next)
      }
      cur = next
    })
  }
  const sort = (nodes: Node[]): Node[] =>
    nodes
      .sort((a, b) => Number(a.isFile) - Number(b.isFile) || a.name.localeCompare(b.name))
      .map((n) => ({ ...n, children: sort(n.children) }))
  return sort(root.children)
}

function TreeNodes({
  nodes,
  depth,
  selected,
  onSelect
}: {
  nodes: Node[]
  depth: number
  selected: string
  onSelect(p: string): void
}): React.JSX.Element {
  return (
    <>
      {nodes.map((n) =>
        n.isFile ? (
          <button
            key={n.path}
            className={`tree-item ${selected === n.path ? 'active' : ''}`}
            style={{ paddingLeft: 10 + depth * 14 }}
            onClick={() => onSelect(n.path)}
            title={n.path}
          >
            {n.name}
          </button>
        ) : (
          <div key={n.path}>
            <div className="tree-dir" style={{ paddingLeft: 10 + depth * 14 }}>
              {n.name}/
            </div>
            <TreeNodes nodes={n.children} depth={depth + 1} selected={selected} onSelect={onSelect} />
          </div>
        )
      )}
    </>
  )
}

export function FileTree({ skill, version }: { skill: Skill; version: number }): React.JSX.Element {
  const tree = useMemo(() => buildTree(skill.files), [skill.files])
  const [selected, setSelected] = useState('SKILL.md')
  const [content, setContent] = useState<string | null>(null)

  useEffect(() => setSelected('SKILL.md'), [skill.id])

  useEffect(() => {
    let live = true
    setContent(null)
    window.api
      .readFile(skill.id, selected)
      .then((t) => live && setContent(t))
      .catch((e) => live && setContent(`(could not read: ${e.message})`))
    return () => {
      live = false
    }
  }, [skill.id, selected, version])

  const isMd = /\.md$/i.test(selected)

  return (
    <div className="files">
      <div className="tree">
        <TreeNodes nodes={tree} depth={0} selected={selected} onSelect={setSelected} />
        {skill.files.length >= 500 && <div className="tree-dir">… first 500 files</div>}
      </div>
      <div className="file-view">
        <div className="file-path">{selected}</div>
        {content === null ? (
          <div className="muted pad">Loading…</div>
        ) : isMd ? (
          <div className="pad">
            <Markdown text={splitFrontmatter(content).body} />
          </div>
        ) : (
          <pre className="code">{content}</pre>
        )}
      </div>
    </div>
  )
}
