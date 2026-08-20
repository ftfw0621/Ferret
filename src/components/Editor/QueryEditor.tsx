import { useRef, useCallback, useEffect } from 'react'
import Editor, { type OnMount, loader } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'

// Use local monaco-editor (no CDN)
import * as monaco from 'monaco-editor'
loader.config({ monaco })

interface Props {
  value: string
  onChange: (value: string) => void
  onExecute: (sql: string) => void
  onExplain?: (sql: string) => void
  onCancel?: () => void
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
    { token: 'identifier', foreground: 'e8e0d8' },
  ],
  colors: {
    'editor.background': '#191614',
    'editor.foreground': '#e8e0d8',
    'editor.lineHighlightBackground': '#211e1c',
    'editor.selectionBackground': '#c0705048',
    'editor.inactiveSelectionBackground': '#c0705028',
    'editorCursor.foreground': '#c07050',
    'editorLineNumber.foreground': '#585048',
    'editorLineNumber.activeForeground': '#a89e96',
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

export function QueryEditor({ value, onChange, onExecute, onExplain, onCancel, isExecuting }: Props) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const onExecuteRef = useRef(onExecute)
  onExecuteRef.current = onExecute

  /** Return selected text, or the single statement at the cursor. */
  const getExecutableSQL = useCallback((): string => {
    const editor = editorRef.current
    if (!editor) return value

    // If text is selected, use the selection
    const selection = editor.getSelection()
    if (selection && !selection.isEmpty()) {
      return editor.getModel()?.getValueInRange(selection) ?? value
    }

    // No selection: find the ;-delimited statement at the cursor
    const model = editor.getModel()
    const position = editor.getPosition()
    if (!model || !position) return value

    const fullText = model.getValue()
    const offset = model.getOffsetAt(position)

    // Find statement boundaries around cursor
    const before = fullText.lastIndexOf(';', offset - 1)
    const start = before >= 0 ? before + 1 : 0
    const after = fullText.indexOf(';', offset)
    const end = after >= 0 ? after : fullText.length

    const stmt = fullText.substring(start, end).trim()
    return stmt || value
  }, [value])

  const handleMount: OnMount = useCallback((editor, monacoInstance) => {
    editorRef.current = editor

    // Define ferret theme
    monacoInstance.editor.defineTheme('ferret', FERRET_THEME)
    monacoInstance.editor.setTheme('ferret')

    // ⌘+Enter to execute (uses ref to always have latest onExecute)
    editor.addAction({
      id: 'ferret-execute',
      label: 'Execute Query',
      keybindings: [
        monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter,
      ],
      run: () => {
        const sql = getExecutableSQL()
        if (sql.trim()) onExecuteRef.current(sql)
      },
    })

    // Focus the editor
    editor.focus()
  }, [getExecutableSQL])

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
        {isExecuting ? (
          <button
            className="execute-btn cancel"
            onClick={onCancel}
            title="Cancel Query (Esc)"
          >
            <span className="execute-icon">■</span>
            <span>Cancel</span>
          </button>
        ) : (
          <button
            className="execute-btn"
            onClick={() => { const sql = getExecutableSQL(); if (sql.trim()) onExecute(sql) }}
            disabled={!value.trim()}
            title="Execute Query (⌘+Enter)"
          >
            <span className="execute-icon">▶</span>
            <span>Execute</span>
          </button>
        )}
        {!isExecuting && onExplain && (
          <button
            className="explain-btn"
            onClick={() => { const sql = getExecutableSQL(); if (sql.trim()) onExplain(sql) }}
            disabled={!value.trim()}
            title="Explain Analyze"
          >
            <span className="explain-icon">⊞</span>
            <span>Explain</span>
          </button>
        )}
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
