# 🦦 Ferret

A beautiful macOS database client — PostgreSQL first, multi-DB ready.

Built with Electron + TypeScript + React, featuring Monaco Editor for SQL editing and AG Grid for result display.

## Features (V1 — In Development)

- [ ] Connection management (save, edit, test multiple connections)
- [ ] SQL editor with syntax highlighting (Monaco Editor)
- [ ] Query execution with beautiful result tables (AG Grid)
- [ ] Schema browser (databases → schemas → tables → columns)
- [ ] PostgreSQL support via node-postgres

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Electron + electron-vite |
| UI | React 19 + TypeScript |
| SQL Editor | Monaco Editor |
| Result Table | AG Grid Community |
| DB Driver | node-postgres (pg) |
| Build | Vite + electron-builder |

## Development

```bash
# Install dependencies
npm install

# Start dev mode
npm run dev

# Build for macOS
npm run build:mac
```

## Project Structure

```
src/
├── main/           # Electron main process
├── preload/        # Context bridge (IPC)
├── renderer/       # React UI
│   └── src/
│       ├── assets/ # CSS tokens, styles
│       └── components/
├── shared/         # Types shared between processes
└── drivers/        # Database driver abstraction
    ├── interface.ts    # Driver protocol
    └── postgres/       # PostgreSQL implementation
```

## Design

Ferret's visual identity is inspired by [Mole](https://github.com/tw93/Mole)'s dark-theme aesthetic — a bright indigo-purple palette with dense, information-rich layout.

## License

MIT
