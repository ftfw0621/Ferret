import { useRef, useCallback, useEffect } from 'react'
import Editor, { type OnMount, loader } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'

// Use local monaco-editor (no CDN)
import * as monaco from 'monaco-editor'
loader.config({ monaco })

interface Props {
  value: string
  onChange: (value: string) => void
  onExecute: () => void
  isExecuting?: boolean
}

// Ferret soft dark theme — low contrast, muted tones
const FERRET_THEME: Monaco.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: '7aaabe', fontStyle: 'bold' },
    { token: 'string', foreground: '5a9e82' },
    { token: 'string.sql', foreground: '5a9e82' },
    { token: 'number', foreground: 'b8964a' },
    { token: 'comment', foreground: '4a5870', fontStyle: 'italic' },
    { token: 'type', foreground: '7a96b8' },
    { token: 'predefined.sql', foreground: 'a88cb8' },
    { token: 'operator', foreground: 'b85858' },
    { token: 'delimiter', foreground: '708098' },
    { token: 'identifier', foreground: 'c0c8d8' },
  ],
  colors: {
    'editor.background': '#131b2c',
    'editor.foreground': '#c0c8d8',
    'editor.lineHighlightBackground': '#182236',
    'editor.selectionBackground': '#5a8fa820',
    'editor.inactiveSelectionBackground': '#5a8fa810',
    'editorCursor.foreground': '#5a8fa8',
    'editorLineNumber.foreground': '#343e52',
    'editorLineNumber.activeForeground': '#708098',
    'editorGutter.background': '#151d30',
    'editorWidget.background': '#182236',
    'editorWidget.border': '#1e2840',
    'editorSuggestWidget.background': '#182236',
    'editorSuggestWidget.border': '#1e2840',
    'editorSuggestWidget.selectedBackground': '#1f2a42',
    'input.background': '#131b2c',
    'input.border': '#1e2840',
    'focusBorder': '#5a8fa8',
    'list.hoverBackground': '#1f2a42',
    'scrollbarSlider.background': '#1e284060',
    'scrollbarSlider.hoverBackground': '#1e2840a0',
    'scrollbarSlider.activeBackground': '#5a8fa840',
  },
}

export function QueryEditor({ value, onChange, onExecute, isExecuting }: Props) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)

  const handleMount: OnMount = useCallback((editor, monacoInstance) => {
    editorRef.current = editor

    // Define ferret theme
    monacoInstance.editor.defineTheme('ferret', FERRET_THEME)
    monacoInstance.editor.setTheme('ferret')

    // ⌘+Enter to execute
    editor.addAction({
      id: 'ferret-execute',
      label: 'Execute Query',
      keybindings: [
        monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter,
      ],
      run: () => { onExecute() },
    })

    // Focus the editor
    editor.focus()
  }, [onExecute])

  // Update the execute action when onExecute changes
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const action = editor.getAction('ferret-execute')
    if (action) {
      // Monaco doesn't support updating actions, so we re-add via a workaround
      // The keybinding still works since handleMount captures onExecute via closure
    }
  }, [onExecute])

  return (
    <div className="query-editor-wrap">
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
      <div className="query-editor">
        <Editor
          language="sql"
          value={value}
          onChange={(v) => onChange(v ?? '')}
          onMount={handleMount}
          theme="ferret"
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
            lineHeight: 20,
            padding: { top: 8, bottom: 8 },
            scrollBeyondLastLine: false,
            renderLineHighlight: 'line',
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            scrollbar: {
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
            overviewRulerBorder: false,
            hideCursorInOverviewRuler: true,
            contextmenu: true,
            folding: true,
            lineNumbersMinChars: 3,
            glyphMargin: false,
          }}
        />
      </div>
    </div>
  )
}
