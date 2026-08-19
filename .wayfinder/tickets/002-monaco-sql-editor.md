---
id: "002"
title: "Monaco Editor SQL 集成方案"
type: research
status: closed
blocked_by: []
---

## Question

How to integrate Monaco Editor into an Electron + React app for SQL editing?

Investigate:
- **monaco-editor** npm package integration with React (via `@monaco-editor/react` or direct)
- SQL language support: built-in SQL mode capabilities and limitations
- Custom SQL dialect support (PostgreSQL-specific keywords, functions, types)
- Syntax highlighting quality for SQL out of the box
- Auto-completion provider API: how to inject table names, column names, and function signatures at runtime
- Multiple editor instances (tabs) performance
- Theme customization: mapping Mole's color palette to Monaco's token colors
- Keyboard shortcuts: execute query (Cmd+Enter), format SQL, etc.
- Monaco in Electron: any renderer process considerations, worker setup
- Alternative: **CodeMirror 6** — when would it be better than Monaco for this use case?

## Resolution

**@monaco-editor/react + custom Monarch tokenizer for PostgreSQL.**

- Single editor instance with **model swapping** (`saveViewState`/`restoreViewState`) for tabs — one editor per tab causes ~20ms/keypress overhead
- Custom Monarch tokenizer (~150 lines) for PG-specific: RETURNING, ILIKE, LATERAL, `::`, dollar-quoted strings, positional params ($1)
- `registerCompletionItemProvider` for runtime table/column/function completion via IPC to schema cache
- Custom theme via `defineTheme`: purple keywords (#BD93F9), green strings (#A5D6A7), amber numbers (#FFD75F), gray comments (#737373), dark bg (#1E1E2E)
- Shortcuts: Cmd+Enter execute, Cmd+Shift+Enter execute selection, Cmd+Shift+F format (via `sql-formatter`)
- Electron worker: `loader.config({ monaco })` to avoid CDN, Vite `base: './'` for file:// protocol
- CodeMirror 6 would win on bundle (50KB vs 5MB) but Monaco wins on VS Code UX for a desktop editor-centric app
- **Packages**: `@monaco-editor/react`, `monaco-editor`, `sql-formatter`

Full research: `.wayfinder/research/002-monaco-sql.md`
