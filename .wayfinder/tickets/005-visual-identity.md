---
id: "005"
title: "Ferret 视觉设计语言"
type: prototype
status: closed
blocked_by: []
---

## Question

How should Ferret's visual identity translate Mole's aesthetic into a desktop database client?

Build a **design token prototype** (CSS custom properties / Tailwind config) covering:

### Color System (from Mole)
- Background layers: main bg, sidebar bg, panel bg, input bg, hover bg
- Primary accent: Dracula purple `#BD93F9` / soft purple `#C79FD7`
- Status colors: ok green `#A5D6A7`, warn amber `#FFD75F`, danger red `#FF5F5F`
- Text hierarchy: primary text, secondary text `#737373`, muted, disabled
- Border / separator: `#404040`
- Selection / highlight

### Typography
- Monospace font for SQL editor and results (system mono or specific?)
- UI font for labels, menus, sidebar
- Size scale: compact, dense layout like Mole

### Component Patterns
- Sidebar: connection tree with expand/collapse
- Tab bar: multiple query tabs
- Status bar: connection status, row count, query time
- Split panes: editor above, results below (resizable)
- Form inputs: connection config fields
- Buttons: primary, secondary, danger
- Context menus

### Visual Personality
- Dark-first (can we skip light mode for V1?)
- Dense, information-rich layout (not airy/spacious)
- Subtle borders, no heavy shadows
- Accent color used sparingly for focus and active states
- Mole-quality progress indicators and loading states

Deliver as a Tailwind config + CSS custom properties file, with a reference HTML page showing all tokens applied to sample components.

## Resolution

**Bright indigo-purple dark theme** — confirmed by user after two brightness iterations.

- **Backgrounds**: 6-layer system from `#252546` (deep) to `#4a3a78` (active), all with blue-purple undertone
- **Accent**: Dracula purple `#BD93F9` (primary), `#C79FD7` (soft/titles), `#9580cc` (dim), `#3a2e65` (bg)
- **Status**: OK `#A5D6A7`, Warn `#FFD75F`, Danger `#FF5F5F`, Info `#7dd3fc`
- **Text**: 4-level hierarchy from `#f0f0f5` (primary) to `#686888` (disabled)
- **Borders**: `#464670` (standard), `#3c3c62` (subtle), `#555580` (dividers)
- **Typography**: JetBrains Mono (brand + code), Inter (UI), 13px dense base
- **Monaco tokens**: Keywords purple, strings green, numbers amber, comments gray, types cyan, functions soft-purple, operators red
- **V1**: Dark-only, no light mode
- **App mock**: Sidebar (connections + schema tree) | Editor (Monaco) | Results (AG Grid) | Status bar

Prototype artifact: `.wayfinder/prototypes/005-visual-identity.html`
