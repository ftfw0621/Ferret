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

// Ferret dark theme matching Mole Mac deep navy palette
const FERRET_THEME: Monaco.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: '6ab8d4', fontStyle: 'bold' },
    { token: 'string', foreground: '4aaa8a' },
    { token: 'string.sql', foreground: '4aaa8a' },
    { token: 'number', foreground: 'd4a44a' },
    { token: 'comment', foreground: '4e5e78', fontStyle: 'italic' },
    { token: 'type', foreground: '8aaace' },
    { token: 'predefined.sql', foreground: 'c8a0d8' },
    { token: 'operator', foreground: 'd45a5a' },
    { token: 'delimiter', foreground: '7888a0' },
    { token: 'identifier', foreground: 'dce4f0' },
  ],
  colors: {
    'editor.background': '#0e1828',
    'editor.foreground': '#dce4f0',
    'editor.lineHighlightBackground': '#162040',
    'editor.selectionBackground': '#4a9ab830',
    'editor.inactiveSelectionBackground': '#4a9ab815',
    'editorCursor.foreground': '#4a9ab8',
    'editorLineNumber.foreground': '#364058',
    'editorLineNumber.activeForeground': '#7888a0',
    'editorGutter.background': '#111c34',
    'editorWidget.background': '#162040',
    'editorWidget.border': '#243050',
    'editorSuggestWidget.background': '#162040',
    'editorSuggestWidget.border': '#243050',
    'editorSuggestWidget.selectedBackground': '#243050',
    'input.background': '#0e1828',
    'input.border': '#243050',
    'focusBorder': '#4a9ab8',
    'list.hoverBackground': '#243050',
    'scrollbarSlider.background': '#24305080',
    'scrollbarSlider.hoverBackground': '#243050c0',
    'scrollbarSlider.activeBackground': '#4a9ab860',
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
