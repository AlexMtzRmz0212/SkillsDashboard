import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function Markdown({ text }: { text: string }): React.JSX.Element {
  return (
    <div className="prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              onClick={(e) => {
                e.preventDefault()
                if (href && /^https:\/\//.test(href)) window.api.openExternal(href)
              }}
              title={href}
            >
              {children}
            </a>
          ),
          // Skill docs reference images by relative path; those can't load here.
          img: ({ alt }) => <span className="img-alt">[image: {alt || 'untitled'}]</span>
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
