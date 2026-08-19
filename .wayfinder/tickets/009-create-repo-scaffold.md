---
id: "009"
title: "创建 Ferret 仓库与项目脚手架"
type: task
status: open
blocked_by: []
---

## Question

Create the Ferret project repository with the decided scaffold and visual identity tokens.

Steps:
1. Initialize git repo at `~/Documents/workspace/Ferret/`
2. Scaffold Electron + React + TypeScript project (using the approach decided in ticket 001)
3. Apply visual identity tokens (from ticket 005)
4. Set up basic project structure:
   - `src/main/` — Electron main process
   - `src/renderer/` — React UI
   - `src/shared/` — Shared types and interfaces
   - `src/drivers/` — Database driver abstraction + PostgreSQL implementation
5. Configure build for macOS (DMG output)
6. Create `.gitignore`, `README.md`, `LICENSE`
7. User creates repo on github.com/ftfw0621 manually
8. Add remote: `git remote add origin git@github-personal:ftfw0621/Ferret.git`
9. Push initial commit

This is a **Task** — no decisions to make, just execution based on prior decisions.
