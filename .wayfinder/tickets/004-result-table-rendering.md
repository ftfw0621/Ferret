---
id: "004"
title: "查询结果表格渲染方案"
type: research
status: closed
blocked_by: []
---

## Question

What is the best approach to render SQL query results as a beautiful, performant table in Electron + React?

Evaluate:
- **AG Grid Community** — the industry standard data grid
  - Free vs Enterprise features: what's in Community edition?
  - Virtual scrolling for large result sets (100K+ rows)
  - Column resizing, reordering, sorting, filtering
  - Custom cell renderers (for JSON, dates, NULLs, long text)
  - Copy to clipboard (cells, rows, columns)
  - Theme customization depth
- **TanStack Table (React Table v8)** — headless UI, full control
  - Paired with a virtual scrolling library (TanStack Virtual)
  - More work to style but total design freedom
  - Easier to match Mole's exact visual language
- **Glide Data Grid** — high-performance canvas-based grid
  - 1M+ cell rendering capability
  - Less traditional React but very fast
- Key requirements:
  - Handle NULL values visually (distinct from empty string)
  - JSON column pretty-printing / expandable
  - Row count and query timing display
  - Column type indicators (text, number, date, boolean, json)
  - Dark theme with Mole-inspired aesthetics
  - Responsive to window resize

## Resolution

**AG Grid Community Edition (MIT, ~338 kB).**

- Free tier covers: sorting, filtering, column resize/reorder, row+column virtualization, custom React cell renderers, rich theming API (`withParams()`)
- **Clipboard copy is Enterprise-only** — bridge with ~40 lines custom code using grid API + `navigator.clipboard.writeText()`
- Dracula-purple palette maps directly to AG Grid theme params
- TanStack Table rejected: 2-5 days extra work for resize handles, virtual scroll, sticky headers, CSS from scratch
- Glide Data Grid rejected: canvas-based (no text selection, imperative cell renderers), last publish ~3 years ago — maintenance risk
- NULL rendering: custom cell renderer with italic gray "NULL" text
- JSON columns: expandable cell renderer with pretty-print

Full research: `.wayfinder/research/004-result-table.md`
