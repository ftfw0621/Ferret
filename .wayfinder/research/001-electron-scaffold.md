# 001 — Electron Scaffold Research for Ferret

**Date:** 2026-08-19  
**Status:** Recommendation ready  
**Context:** Ferret is a macOS database client. Desktop app, single platform (macOS), React + TypeScript.

---

## Executive Summary

**Recommendation: electron-vite + electron-builder**

Use **electron-vite** (`npm create @quick-start/electron`) as the build toolchain and **electron-builder** for packaging/distribution. This gives the fastest dev experience (Vite HMR, sub-second rebuilds) with the most battle-tested packaging pipeline for macOS DMG, code signing, and notarization.

---

## 1. Toolchain Comparison

### Option A: electron-vite (Recommended)

**What it is:** A purpose-built Vite-based build tool for Electron by alex8088. Not a boilerplate — it is a proper CLI and build tool (`electron-vite` command) that understands the three Electron entry points (main, preload, renderer) natively.

| Aspect | Detail |
|--------|--------|
| NPM package | `electron-vite` |
| Scaffold | `npm create @quick-start/electron@latest` |
| Bundler | Vite (currently supports Vite 6+) |
| Main/preload/renderer | First-class separate configs in one `electron.vite.config.ts` |
| HMR | Full Vite HMR in renderer; fast restart for main process |
| React support | Built-in template (`react-ts`) |
| TypeScript | Out of the box, strict mode configurable |
| Packaging | Pairs with electron-builder (included in scaffold) |
| Unique feature | V8 bytecode compilation for source protection |
| Community | Active, well-maintained, good docs at electron-vite.org |

**Why it wins:** It treats the Electron three-process split as a first-class concept. One config file, three build targets, each with the right Node/browser resolution. No fighting Vite to understand `nodeIntegration` vs `contextIsolation`. The scaffold is clean and minimal — no boilerplate cruft.

### Option B: Electron Forge + Vite Plugin

**What it is:** The official Electron toolchain maintained by the Electron team. Forge v7.11.2 includes `@electron-forge/plugin-vite`.

| Aspect | Detail |
|--------|--------|
| NPM package | `@electron-forge/cli` |
| Scaffold | `npm init electron-app@latest ferret -- --template=vite-typescript` |
| Bundler | Vite via `@electron-forge/plugin-vite` (currently Vite 7; Vite 8 not yet supported) |
| Packaging | Built-in makers (DMG, ZIP, etc.) using @electron/packager |
| Signing | @electron/osx-sign and @electron/notarize baked in |
| HMR | Yes, via Vite plugin |

**Why not first choice:**
- The Vite plugin is explicitly marked **experimental** with "no API stability guarantees; minor versions may include breaking changes."
- Lags behind Vite releases (still on Vite 7 while Vite 8 is out).
- The scaffold adds more config ceremony than electron-vite.
- React template requires extra manual setup compared to electron-vite's `react-ts` template.
- Forge's packaging makers are less flexible than electron-builder for macOS-specific needs (custom DMG backgrounds, installer UX).

**When to pick Forge:** If you want the "official" label and plan to contribute upstream, or need ASAR integrity features that ship through Forge first.

### Option C: electron-builder with Custom Setup

**What it is:** Use Vite directly with manual Electron configuration, then electron-builder for packaging.

| Aspect | Detail |
|--------|--------|
| NPM package | `electron-builder` |
| Downloads | ~3.5M weekly (most popular by raw numbers) |
| Bundler | Bring your own (Vite, Webpack, esbuild) |
| Packaging | Most feature-rich: DMG, NSIS, AppImage, Snap, PKG, etc. |

**Why not first choice:** You have to wire up the main/preload/renderer build pipeline yourself. electron-vite already does this and uses electron-builder for packaging, so you get both.

### Verdict

```
electron-vite (build) + electron-builder (package) > Electron Forge > manual setup
```

electron-vite handles the build pipeline; electron-builder handles packaging. This is what the electron-vite scaffold sets up by default.

---

## 2. Bundler: Vite

**Vite is the clear winner in 2026.** Webpack is legacy for new Electron projects.

| Factor | Vite | Webpack |
|--------|------|---------|
| Dev server startup | < 300ms | 5-15s typical |
| HMR speed | Near-instant (ESM native) | Seconds (full rebundle) |
| Config complexity | Minimal | Verbose |
| Ecosystem 2026 | Dominant, Vite 8 released | Maintenance mode |
| Electron support | electron-vite, Forge plugin | CRA (deprecated), manual |

No reason to consider Webpack for a greenfield project in 2026.

---

## 3. React Version

**Use React 19.2.x** (latest stable as of August 2026).

- React 19 works without issues in Electron's Chromium-based renderer (Electron 42 ships Chromium ~134).
- React 19's new features (Actions, `use()`, server components) are renderer-process safe. Server components are irrelevant in Electron context but do not interfere.
- The electron-vite `react-ts` template ships with React 19 and `@vitejs/plugin-react`.
- No compatibility concerns: Electron's Chromium is always newer than any browser React targets.

---

## 4. TypeScript Configuration

### Recommended `tsconfig.json` structure

electron-vite scaffolds three separate TypeScript configs aligned with each process:

```
tsconfig.json              # Base config, references the others
tsconfig.node.json         # Main process + preload (Node.js target)
tsconfig.web.json          # Renderer process (browser/DOM target)
```

### Strict mode settings

Enable full strict mode. A database client handles user data — type safety is non-negotiable.

```jsonc
// tsconfig.json (base)
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "skipLibCheck": true
  }
}
```

### ESLint + Prettier

```jsonc
// Recommended packages
{
  "devDependencies": {
    "eslint": "^9",
    "eslint-config-prettier": "latest",
    "prettier": "^3",
    "@typescript-eslint/eslint-plugin": "latest",
    "@typescript-eslint/parser": "latest",
    "eslint-plugin-react-hooks": "latest",
    "eslint-plugin-react-refresh": "latest"
  }
}
```

Use ESLint flat config (`eslint.config.mjs`) — the legacy `.eslintrc` format is deprecated.

---

## 5. Main vs Renderer Process Separation

### Directory structure (electron-vite default)

```
ferret/
├── electron.vite.config.ts      # Unified build config
├── src/
│   ├── main/                    # Main process (Node.js)
│   │   ├── index.ts             # Entry: BrowserWindow, app lifecycle
│   │   ├── ipc/                 # IPC handler registrations
│   │   │   ├── database.ts      # Database connection handlers
│   │   │   └── file-system.ts   # File dialog, path handlers
│   │   └── services/            # Business logic (DB drivers, etc.)
│   ├── preload/                 # Preload scripts (bridge)
│   │   └── index.ts             # contextBridge.exposeInMainWorld
│   └── renderer/                # React app (browser context)
│       ├── src/
│       │   ├── App.tsx
│       │   ├── components/
│       │   ├── hooks/
│       │   └── pages/
│       └── index.html
├── resources/                   # App icons, static assets
└── package.json
```

### Key principles

1. **Main process** owns all privileged operations: file system, database connections, native menus, tray, auto-updater, shell integration.
2. **Preload** is a thin typed bridge — expose the minimum API surface through `contextBridge`.
3. **Renderer** is a pure React SPA that knows nothing about Node.js or Electron internals.
4. **Context isolation** is always ON (Electron default since v12). Never set `contextIsolation: false`.
5. **Node integration** is always OFF in the renderer. Never set `nodeIntegration: true`.

---

## 6. IPC Best Practices (Electron 2026)

### Architecture

```
Renderer (React)  <-->  Preload (bridge)  <-->  Main (Node.js)
   invoke()               ipcRenderer            ipcMain.handle()
```

### Type-safe IPC pattern

Define a shared channel contract:

```typescript
// src/shared/ipc-channels.ts
export const IPC = {
  DB_CONNECT: 'db:connect',
  DB_QUERY: 'db:query',
  DB_DISCONNECT: 'db:disconnect',
  FILE_OPEN: 'file:open',
  FILE_SAVE: 'file:save',
} as const;

export type IpcChannels = typeof IPC[keyof typeof IPC];
```

Preload exposes typed methods, not raw `ipcRenderer`:

```typescript
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc-channels';

const api = {
  db: {
    connect: (config: ConnectionConfig) =>
      ipcRenderer.invoke(IPC.DB_CONNECT, config),
    query: (sql: string, params?: unknown[]) =>
      ipcRenderer.invoke(IPC.DB_QUERY, sql, params),
    disconnect: () =>
      ipcRenderer.invoke(IPC.DB_DISCONNECT),
  },
  file: {
    open: () => ipcRenderer.invoke(IPC.FILE_OPEN),
    save: (content: string) => ipcRenderer.invoke(IPC.FILE_SAVE, content),
  },
} as const;

contextBridge.exposeInMainWorld('api', api);

// Type declaration for renderer
export type ElectronAPI = typeof api;
```

Type the `window` object in the renderer:

```typescript
// src/renderer/src/env.d.ts
import type { ElectronAPI } from '../../preload/index';

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
```

### Rules

1. **One method per operation.** Never expose `ipcRenderer.send` or `ipcRenderer.on` directly.
2. **Use `invoke`/`handle` for request-response** (returns a Promise). Use `send`/`on` only for fire-and-forget or main-to-renderer pushes.
3. **Validate inputs in the main process handler.** The preload bridge is a trust boundary.
4. **Keep payloads small.** The Structured Clone Algorithm deserializes on the renderer main thread — large JSON objects block the UI at 60fps.
5. **For streaming data** (query results), use `MessagePort` or chunked `send` with backpressure.

---

## 7. Dev Experience

### electron-vite provides

| Feature | How |
|---------|-----|
| Renderer HMR | Vite dev server, near-instant |
| Main process reload | Automatic restart on save (configurable) |
| Preload reload | Automatic re-inject on save |
| Source maps | Full support in dev, configurable for prod |
| DevTools | Chromium DevTools open by default in dev |
| Environment variables | `.env` files per process, `import.meta.env` |

### Additional DX setup to add

- **React DevTools**: Install via `electron-devtools-installer` or the standalone React DevTools app.
- **Vitest** for unit tests (same Vite config, fast).
- **Playwright** for E2E tests (electron-vite template includes setup).

---

## 8. Build and Packaging for macOS

### electron-builder configuration

electron-vite scaffolds with electron-builder pre-configured. Key macOS settings:

```jsonc
// electron-builder.yml (or in package.json under "build")
{
  "appId": "com.ferret.app",
  "productName": "Ferret",
  "mac": {
    "target": ["dmg", "zip"],
    "category": "public.app-category.developer-tools",
    "icon": "resources/icon.icns",
    "hardenedRuntime": true,
    "gatekeeperAssess": false,
    "entitlements": "build/entitlements.mac.plist",
    "entitlementsInherit": "build/entitlements.mac.plist",
    "notarize": true
  },
  "dmg": {
    "sign": false,
    "contents": [
      { "x": 130, "y": 220 },
      { "x": 410, "y": 220, "type": "link", "path": "/Applications" }
    ]
  }
}
```

### Code signing

- Requires an Apple Developer account ($99/year).
- Set environment variables for CI:
  - `CSC_LINK` — base64-encoded .p12 certificate
  - `CSC_KEY_PASSWORD` — certificate password
  - `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` — for notarization
- electron-builder handles signing and notarization automatically when these are set.
- **Do not sign the DMG itself** — sign only the .app bundle. DMG signing causes notarization failures.

### Auto-update

electron-builder integrates with `electron-updater` for Squirrel-based auto-updates. Configure a GitHub Releases or S3 publish target.

---

## Scaffold Commands

### Create the project

```bash
# Scaffold with electron-vite's React + TypeScript template
npm create @quick-start/electron@latest ferret -- --template react-ts

cd ferret
npm install
```

### Verify the scaffold works

```bash
# Start dev server (renderer HMR + main process watch)
npm run dev

# Build for production
npm run build

# Package as macOS DMG
npm run build:mac
# or if the script is named differently:
npx electron-builder --mac
```

### Add recommended extras

```bash
# Prettier
npm install -D prettier eslint-config-prettier

# Vitest for unit testing
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom

# Database drivers (pick per supported DB)
npm install better-sqlite3        # SQLite
npm install pg                    # PostgreSQL
npm install mysql2                # MySQL
npm install @libsql/client        # Turso/libSQL
```

---

## Version Matrix (August 2026)

| Dependency | Version | Notes |
|-----------|---------|-------|
| Electron | 42.x | Latest stable (v42.9.3, Aug 18 2026) |
| React | 19.2.x | Latest stable |
| TypeScript | 5.7+ | Latest stable |
| Vite | 6.x or 7.x | electron-vite tracks these |
| electron-vite | latest | Build tooling |
| electron-builder | latest | Packaging |
| Node.js | 20 LTS or 22 LTS | Electron 42 ships Node ~22 |

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| electron-vite is not "official" Electron tooling | It has become the de facto standard; Forge's Vite plugin being experimental makes it less stable in practice |
| electron-builder sometimes lags behind Electron releases | Pin Electron to a version electron-builder supports; check compatibility before major Electron upgrades |
| React 19 breaking changes from 18 | Minimal for a greenfield project; no migration needed |
| macOS Gatekeeper changes | Always test notarization on a clean macOS install before shipping |
| Native modules (better-sqlite3 etc.) need rebuild per Electron version | Use `electron-rebuild` (included in dev workflow) or `@electron/rebuild` |

---

## Decision

**Use electron-vite with the `react-ts` template, paired with electron-builder for macOS packaging.**

This gives Ferret:
- Sub-second HMR in development
- Clean three-process architecture out of the box
- TypeScript strict mode across all processes
- Battle-tested DMG packaging with code signing and notarization
- The smallest amount of scaffold configuration to maintain

Sources:
- [electron-vite.org — Getting Started](https://electron-vite.org/guide/)
- [Electron Forge — Vite Plugin](https://www.electronforge.io/config/plugins/vite)
- [Electron IPC Tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Electron Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [electron-builder Code Signing](https://www.electron.build/docs/features/code-signing/)
- [Electron Releases](https://releases.electronjs.org/)
- [npm trends: electron-builder vs electron-forge](https://npmtrends.com/electron-builder-vs-electron-forge-vs-electron-package)
