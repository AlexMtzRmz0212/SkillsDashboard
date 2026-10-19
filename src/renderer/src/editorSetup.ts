import { markdown } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import type { MarkdownConfig } from '@lezer/markdown'

/** Treat a leading `---` … `---` block as frontmatter instead of a setext heading. */
const Frontmatter: MarkdownConfig = {
  defineNodes: [{ name: 'Frontmatter', block: true, style: tags.meta }],
  parseBlock: [
    {
      name: 'Frontmatter',
      before: 'HorizontalRule',
      parse(cx, line) {
        if (cx.lineStart !== 0 || line.text.trimEnd() !== '---') return false
        const start = cx.lineStart
        while (cx.nextLine()) {
          if (line.text.trimEnd() === '---') {
            cx.nextLine()
            break
          }
        }
        cx.addElement(cx.elt('Frontmatter', start, cx.prevLineEnd()))
        return true
      }
    }
  ]
}

// Colors come from the app's CSS tokens so the editor follows light/dark.
const style = HighlightStyle.define([
  { tag: tags.meta, color: 'var(--text-3)' },
  { tag: tags.heading, color: 'var(--text)', fontWeight: '700' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.link, color: 'var(--accent)' },
  { tag: tags.url, color: 'var(--accent)' },
  { tag: tags.monospace, color: 'var(--src-agents)' },
  { tag: tags.quote, color: 'var(--text-2)', fontStyle: 'italic' },
  { tag: tags.processingInstruction, color: 'var(--text-3)' },
  { tag: tags.contentSeparator, color: 'var(--text-3)' }
])

export const editorExtensions = [
  markdown({ extensions: [Frontmatter] }),
  syntaxHighlighting(style),
  EditorView.lineWrapping,
  EditorView.theme({
    '&': { backgroundColor: 'var(--surface)', color: 'var(--text)' },
    '.cm-gutters': { backgroundColor: 'var(--panel)', color: 'var(--text-3)', borderRight: '1px solid var(--line)' },
    '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--accent) 6%, transparent)' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--text)' },
    '.cm-content': { padding: '12px 0', caretColor: 'var(--accent)' },
    '.cm-line': { padding: '0 16px' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
      backgroundColor: 'color-mix(in srgb, var(--accent) 22%, transparent) !important'
    },
    '.cm-cursor': { borderLeftColor: 'var(--accent)' }
  })
]
