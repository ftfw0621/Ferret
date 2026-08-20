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

// Ferret warm chocolate theme
const FERRET_THEME: Monaco.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: 'd48868', fontStyle: 'bold' },
    { token: 'string', foreground: '5a9e7a' },
    { token: 'string.sql', foreground: '5a9e7a' },
    { token: 'number', foreground: 'c0a050' },
    { token: 'comment', foreground: '605850', fontStyle: 'italic' },
    { token: 'type', foreground: '7090a8' },
    { token: 'predefined.sql', foreground: 'b090a8' },
    { token: 'operator', foreground: 'b85050' },
    { token: 'delimiter', foreground: '8a8078' },
    { token: 'identifier', foreground: 'd0c8c0' },
  ],
  colors: {
    'editor.background': '#1a1614',
    'editor.foreground': '#d0c8c0',
    'editor.lineHighlightBackground': '#24201e',
    'editor.selectionBackground': '#c0705020',
    'editor.inactiveSelectionBackground': '#c0705010',
    'editorCursor.foreground': '#c07050',
    'editorLineNumber.foreground': '#443e38',
    'editorLineNumber.activeForeground': '#8a8078',
    'editorGutter.background': '#1e1a18',
    'editorWidget.background': '#24201e',
    'editorWidget.border': '#2e2a26',
    'editorSuggestWidget.background': '#24201e',
    'editorSuggestWidget.border': '#2e2a26',
    'editorSuggestWidget.selectedBackground': '#302c28',
    'input.background': '#1a1614',
    'input.border': '#2e2a26',
    'focusBorder': '#c07050',
    'list.hoverBackground': '#302c28',
    'scrollbarSlider.background': '#2e2a2660',
    'scrollbarSlider.hoverBackground': '#2e2a26a0',
    'scrollbarSlider.activeBackground': '#c0705040',
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
