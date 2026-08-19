import { useRef, useCallback, useMemo } from 'react'
import './QueryEditor.css'

interface Props {
  value: string
  onChange: (value: string) => void
  onExecute: () => void
  isExecuting?: boolean
}

export function QueryEditor({ value, onChange, onExecute, isExecuting }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        onExecute()
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        const textarea = textareaRef.current
        if (!textarea) return
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const newValue = value.substring(0, start) + '  ' + value.substring(end)
        onChange(newValue)
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2
        })
      }
    },
    [value, onChange, onExecute]
  )

  const lineNumbers = useMemo(() => {
    const count = Math.max(value.split('\n').length, 1)
    return Array.from({ length: count }, (_, i) => i + 1)
  }, [value])

  return (
    <div className="query-editor-wrap">
      {/* Toolbar */}
      <div className="editor-toolbar">
        <button
          className="execute-btn"
          onClick={onExecute}
          disabled={isExecuting || !value.trim()}
          title="Execute Query (⌘+Enter)"
        >
          {isExecuting ? (
            <span className="execute-spinner">⟳</span>
          ) : (
            <span className="execute-icon">▶</span>
          )}
          <span>{isExecuting ? 'Running…' : 'Execute'}</span>
        </button>
        <span className="toolbar-hint">⌘+Enter</span>
      </div>

      {/* Editor */}
      <div className="query-editor">
        <div className="editor-gutter">
          {lineNumbers.map((n) => (
            <div key={n} className="gutter-line">
              {n}
            </div>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          className="editor-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={"-- Write your SQL query here\n-- Press ⌘+Enter to execute"}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
      </div>
    </div>
  )
}
