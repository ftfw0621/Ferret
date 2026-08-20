# 🦦 Ferret

A beautiful macOS database client — PostgreSQL first, multi-DB ready.

Built with **Tauri** (Rust backend) + **React** (TypeScript frontend).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Rust + Tauri 2 |
| DB Driver | tokio-postgres + deadpool |
| Credentials | macOS Keychain (keyring crate) |
| Frontend | React 19 + TypeScript + Vite |
| Build | cargo + Vite → DMG |

## Development

```bash
# Install Rust (if needed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install tauri-cli

# Install frontend deps
npm install

# Run in dev mode
cargo tauri dev

# Run Rust tests
cd src-tauri && cargo test

# Build for macOS
cargo tauri build
```

## Project Structure

```
├── src-tauri/           # Rust backend
│   └── src/
│       ├── lib.rs       # App setup + command registration
│       ├── commands.rs  # Tauri IPC command handlers
│       └── db/
│           ├── types.rs           # Shared types (ConnectionConfig, QueryResult, etc.)
│           ├── postgres.rs        # PostgreSQL driver + connection string parser
│           └── connection_store.rs # Persistence (JSON + Keychain)
├── src/                 # React frontend
│   ├── lib/tauri.ts     # Typed Tauri invoke wrapper
│   ├── hooks/           # React state hooks
│   ├── components/      # UI components
│   └── assets/          # CSS design tokens
└── index.html
```

## License

MIT
