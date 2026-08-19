---
id: "001"
title: "Electron + React 项目脚手架方案"
type: research
status: closed
blocked_by: []
---

## Question

What is the best Electron + React + TypeScript project scaffold for a new desktop app in 2026?

Evaluate:
- **Electron Forge** vs **Electron Vite** vs **electron-builder** with custom setup
- Which bundler: Vite (preferred for speed) vs Webpack
- React version: React 19+ with Server Components relevance in Electron context
- TypeScript strict mode, ESLint, Prettier configuration
- Main process vs renderer process separation patterns
- IPC (Inter-Process Communication) best practices for Electron 2026
- Hot reload / dev experience quality
- Build & packaging for macOS (DMG, notarization)

The answer should be a concrete recommendation with reasoning, ready to scaffold from.

## Resolution

**Recommendation: electron-vite + electron-builder**

- **electron-vite** over Electron Forge (whose Vite plugin is still "experimental" at v7.11.2) or manual setup
- **Vite** bundler — sub-second HMR, no contest vs Webpack in 2026
- **React 19.2.x** — latest stable, fully compatible with Electron 42's Chromium
- **TypeScript strict** with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- **Process separation**: enforced `src/main/`, `src/preload/`, `src/renderer/` split. Context isolation ON, node integration OFF
- **IPC**: Type-safe `invoke`/`handle` through shared channel contract. Preload exposes typed methods via `contextBridge`
- **macOS packaging**: electron-builder handles DMG, code signing, notarization. Sign the `.app` bundle only, not the DMG
- **Scaffold**: `npm create @quick-start/electron@latest ferret -- --template react-ts`

Full research: `.wayfinder/research/001-electron-scaffold.md`
