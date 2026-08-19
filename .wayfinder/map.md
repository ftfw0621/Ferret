# 🗺️ Ferret — Wayfinder Map

> **Label:** `wayfinder:map`

## Destination

A native macOS database client called **Ferret** (雪貂) — built with **Electron + TypeScript + React**, featuring **Monaco Editor** for SQL editing and a beautiful result table. V1 targets PostgreSQL; the architecture is designed so MySQL, SQLite, and others can plug in later. UI language is inspired by Mole's dark-theme aesthetic (Dracula-purple palette, dense terminal-native feel translated to a desktop app).

**V1 scope:** Connection management (save/edit/test multiple connections) → SQL editor with syntax highlighting → execute queries and display results in a polished table → schema browser (databases → schemas → tables → columns).

**Publishing:** GitHub at `ftfw0621/Ferret` via SSH alias `github-personal`. Repo created manually on github.com, then pushed via `git@github-personal:ftfw0621/Ferret.git`.

## Notes

- **Domain:** macOS desktop database client (Electron)
- **Tech stack:** Electron + TypeScript + React + Monaco Editor + node-postgres
- **Visual reference:** Mole's color system — Dracula purple `#BD93F9`, soft purple `#C79FD7`, amber `#FFD75F`, soft green `#A5D6A7`, red `#FF5F5F`, dark backgrounds, dense layout
- **Architecture for personal use now, community-grade quality.** No shortcuts on abstraction or code structure.
- **GitHub push:** SSH alias `github-personal` → ftfw0621 account. `gh` CLI is authed as Michael-crazyman — create repo on github.com manually first.

## Decisions so far

- [Electron + React 项目脚手架方案](tickets/001-electron-project-scaffold.md) — **electron-vite + electron-builder**，Vite bundler，React 19，TypeScript strict，`npm create @quick-start/electron`
- [Monaco Editor SQL 集成方案](tickets/002-monaco-sql-editor.md) — **@monaco-editor/react + custom Monarch tokenizer**，PG 语法高亮、补全 provider、自定义主题、单实例 model swapping
- [Electron 中 PostgreSQL 连接与查询](tickets/003-postgres-from-electron.md) — **pg in main process + safeStorage**，Pool max 3-5，pg-cursor 流式，contextBridge IPC，完整 schema introspection SQL
- [查询结果表格渲染方案](tickets/004-result-table-rendering.md) — **AG Grid Community (MIT)**，虚拟滚动、自定义 cell renderer、Dracula 主题映射，clipboard 需自定义 40 行
- [Ferret 视觉设计语言](tickets/005-visual-identity.md) — **明亮靛蓝紫暗色主题**，6 层背景 (#252546→#4a3a78)，JetBrains Mono + Inter，13px 密集基线，完整 Monaco token 配色

## Not yet specified

- **SSH tunnel support** — Remote databases often need SSH tunnels. How to integrate this depends on the connection management design.
- **Query auto-complete** — Table/column name suggestions from schema. Depends on how schema data is cached and how Monaco's completion provider is wired.
- **Query history & favorites** — Persist past queries, let user star/bookmark them. Depends on data persistence decisions.
- **Export results** — CSV/JSON/clipboard from result table. Depends on table component choice.
- **Tab management** — Multiple queries open simultaneously. Depends on app layout decisions.
- **App distribution** — DMG, Homebrew Cask, or just GitHub Releases? Depends on how far V1 polish goes.
- **Dark/light theme toggle** — Mole is dark-first, but should Ferret support light mode?
- **Keyboard shortcuts** — Power-user shortcuts for query execution, navigation, etc.
- **Connection groups/folders** — Organizing many saved connections.
- **Error handling UX** — Connection failures, query errors, timeouts — how to surface them.

## Out of scope

- **MySQL / SQLite drivers** — V1 is Postgres only. The abstraction layer supports extension, but actual driver implementations are post-V1.
- **Data editing** — No insert/update/delete from the table view in V1. Read-only query execution.
- **ER diagrams / visual schema** — Schema browser is tree-based, not graphical.
- **Query EXPLAIN visualization** — No query plan rendering in V1.
- **Collaboration features** — No shared queries, team connections, or multi-user state.
- **Plugin system** — No extensibility API in V1.
- **Cross-platform builds** — V1 targets macOS only, even though Electron can go cross-platform.
