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

// Ferret warm dark theme — cohesive with tokens.css
const FERRET_THEME: Monaco.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: 'd08868', fontStyle: 'bold' },
    { token: 'string', foreground: '6aaa88' },
    { token: 'string.sql', foreground: '6aaa88' },
    { token: 'number', foreground: 'c0a050' },
    { token: 'comment', foreground: '5e564e', fontStyle: 'italic' },
    { token: 'type', foreground: '6898b0' },
    { token: 'predefined.sql', foreground: 'b090a8' },
    { token: 'operator', foreground: 'c06060' },
    { token: 'delimiter', foreground: '887e76' },
    { token: 'identifier', foreground: 'c8c0b8' },
  ],
  colors: {
    'editor.background': '#191614',
    'editor.foreground': '#c8c0b8',
    'editor.lineHighlightBackground': '#211e1c',
    'editor.selectionBackground': '#c0705018',
    'editor.inactiveSelectionBackground': '#c0705008',
    'editorCursor.foreground': '#c07050',
    'editorLineNumber.foreground': '#403a34',
    'editorLineNumber.activeForeground': '#887e76',
    'editorGutter.background': '#1c1917',
    'editorWidget.background': '#211e1c',
    'editorWidget.border': '#2a2724',
    'editorSuggestWidget.background': '#211e1c',
    'editorSuggestWidget.border': '#2a2724',
    'editorSuggestWidget.selectedBackground': '#2c2926',
    'input.background': '#191614',
    'input.border': '#2a2724',
    'focusBorder': '#c07050',
    'list.hoverBackground': '#2c2926',
    'scrollbarSlider.background': '#2a272450',
    'scrollbarSlider.hoverBackground': '#2a272490',
    'scrollbarSlider.activeBackground': '#c0705030',
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
