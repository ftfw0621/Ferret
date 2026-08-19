# 004 — Result Table Rendering

> **Question:** What is the best approach to render SQL query results as a beautiful, performant table in Electron + React?

## Candidates Evaluated

| Criteria | AG Grid Community | TanStack Table + Virtual | Glide Data Grid |
|---|---|---|---|
| **License** | MIT | MIT | MIT |
| **Architecture** | Batteries-included, DOM-based with virtualization | Headless logic + separate virtualization lib | Canvas-based rendering |
| **Bundle size** | ~338 kB (Community) | ~15 kB core + ~5 kB virtual + UI code (~30 kB total) | ~80 kB |
| **Virtual scrolling** | Built-in (rows + columns) | Via @tanstack/virtual (separate setup) | Native canvas (no DOM nodes at all) |
| **100K rows** | Proven, handles six-figure row counts OOTB | Comparable when properly configured | Handles millions; designed for 1M+ cells |
| **Column resize/reorder/sort/filter** | All built-in Community | Sort/filter built-in; resize/reorder need custom code | Resize/reorder built-in; sort/filter are app-provided |
| **Custom cell renderers** | React components via `cellRenderer` | Full React control (headless) | Canvas drawing API (low-level `ctx` calls) |
| **Clipboard (Ctrl+C)** | **Enterprise only** for grid-level copy; Community only has `enableCellTextSelection` for native browser text select | DIY (you wire up your own handler) | Built-in Ctrl+C/V with `getCellsForSelection` |
| **Theming** | 100+ CSS vars (`--ag-*`), `withParams()` API, built-in dark variants | Zero built-in CSS — total freedom, total work | Theme interface (~15 color tokens via CSS vars `--gdg-*`) |
| **npm weekly downloads** | ~600K+ | ~3M+ (table) | ~95K |
| **GitHub stars** | 13K+ | 26K+ (table) | 4.5K |
| **Last published** | Actively maintained (2025–2026 releases) | Actively maintained (2025–2026 releases) | **v6.0.3, last published ~3 years ago** |
| **React version support** | 16–19 | 16–19 | 16–19 |

---

## Detailed Evaluation

### 1. AG Grid Community Edition

**Strengths:**
- Drop-in component with immediate visual output; minimal boilerplate.
- Built-in column and row virtualization handles large datasets without extra libraries.
- Rich theming API: `themeQuartz.withParams({ backgroundColor: '#1e1e2e', foregroundColor: '#e0e0e0', accentColor: '#BD93F9', borderColor: '#404040', browserColorScheme: 'dark' })` maps directly to the Dracula-purple palette.
- Custom cell renderers are plain React components — rendering a styled "NULL" or a JSON tree is straightforward.
- Sorting, filtering, column resizing, column reordering, pagination — all Community.
- Massive ecosystem, tutorials, StackOverflow coverage, and active maintenance.
- MIT license — safe for open-source projects.

**Weaknesses:**
- **Clipboard copy is Enterprise-only.** `ClipboardModule` requires a commercial license ($999+/dev). Community only offers `enableCellTextSelection` which lets users select text inside a single cell via the browser, but not multi-cell/row/column copy.
- Bundle size (~338 kB) is the largest of the three, though acceptable for Electron.
- Row grouping, pivot, master/detail, range selection, Excel export — all Enterprise paywalled.
- The grid has opinions about DOM structure; overriding deeply nested styles can require specificity battles.

**Clipboard workaround for Community:**
You can set `enableCellTextSelection: true` and `ensureDomOrder: true` to allow native browser text selection across cells, then rely on the browser's Ctrl+C. This works for visible text but loses structure (no tab-separated columns). Alternatively, you can add a custom keyboard listener on the grid wrapper that reads selected rows from the grid API and writes to `navigator.clipboard` — roughly 30–50 lines of code, but it is entirely doable.

**Verdict:** Best time-to-value ratio. The clipboard gap is the main pain point but solvable with a custom handler.

---

### 2. TanStack Table v8 + TanStack Virtual

**Strengths:**
- Headless — zero CSS opinions, total design freedom.
- The lightest bundle (~30 kB with virtual), ideal if size matters (less critical in Electron).
- Perfect aesthetic control: every `<td>`, `<th>`, class, and inline style is yours. Matching the Dracula palette is trivial because you write all the CSS from scratch.
- Sorting, filtering, column visibility, row selection, grouping, expansion — all free, all headless.
- Largest community (3M+ weekly downloads), very active maintenance.
- Clipboard: you own the DOM, so wiring Ctrl+C with `navigator.clipboard.writeText()` is natural.

**Weaknesses:**
- **Significant upfront build time.** You must write: the `<table>` render loop, header groups, cell rendering, resize handles, drag-and-drop column reorder, virtual scroll container with absolute positioning, sticky headers, horizontal scroll sync, row number gutter, and all dark-theme CSS. Estimate: 2–5 days for a polished result table matching the spec.
- Column resizing requires implementing drag handles and state management yourself.
- Column reordering requires implementing drag-and-drop yourself.
- Virtual scrolling requires integrating `@tanstack/virtual`, setting up a scroll container, computing row offsets, and managing overscan — roughly 100 lines of glue code.
- No built-in context menu, no built-in cell editing, no built-in selection highlight — everything is DIY.

**Verdict:** Maximum flexibility at maximum effort. Best if the result table is the centerpiece of the product and you want pixel-perfect control. Worst if you need to ship fast.

---

### 3. Glide Data Grid

**Strengths:**
- Canvas rendering = unmatched raw performance. Handles millions of cells at 60fps because no DOM nodes are created per cell.
- Built-in copy/paste (Ctrl+C/V) with `getCellsForSelection` callback.
- Theme interface maps cleanly to custom colors: `{ bgCell: '#1e1e2e', textDark: '#e0e0e0', accentColor: '#BD93F9', borderColor: '#404040', bgHeader: '#252535' }`.
- Column resize and reorder are built-in.
- Data callback pattern (`getCellContent(cell)`) is a natural fit for lazy-loading query results.
- Row numbers achievable via a frozen first column.
- MIT licensed.

**Weaknesses:**
- **Maintenance concern: last npm publish was ~3 years ago.** Only 4.5K stars, 95K weekly downloads. The project is usable but the bus factor and long-term viability are risks.
- Custom cell renderers require **Canvas 2D API drawing** — not React components. Rendering a styled italic gray "NULL", a JSON tree with expand/collapse, or a column-type icon badge means writing imperative `ctx.fillText()`, `ctx.fillRect()`, `ctx.drawImage()` code. This is a fundamentally different skill than React component development.
- Sorting and filtering are "application-provided" — you must implement them yourself.
- The expand/collapse JSON cell (a key requirement) is especially hard on canvas: you would need to either pop up a React overlay or implement a multi-line expandable canvas cell from scratch.
- Documentation is sparse ("Coming soon" on key pages), and the community is small.
- Dependencies include `lodash`, `marked`, and `react-responsive-carousel` which add weight.
- No built-in context menu.
- Text selection within cells is not possible (canvas pixels, not DOM text nodes) — you can only copy via the grid's clipboard API, not by dragging to select text.

**Verdict:** Overkill performance at a steep DX cost, with maintenance risk. Best for spreadsheet-like apps that truly need millions of cells. Risky for a project that needs active community support and React-native cell customization.

---

## Requirements Matrix

| Requirement | AG Grid Community | TanStack + Virtual | Glide Data Grid |
|---|---|---|---|
| NULL display (italic gray) | Easy (cellRenderer React component) | Easy (you own the `<td>`) | Medium (canvas `ctx.font = 'italic ...'`) |
| JSON pretty-print / expandable | Easy (cellRenderer with collapsible `<pre>`) | Easy (any React component) | **Hard** (canvas + overlay hack) |
| Row number column | Built-in `rowIndex` | Easy (add a column) | Easy (frozen column) |
| Column type indicators | Easy (custom header component) | Easy (you own the `<th>`) | Medium (canvas header drawing) |
| Query timing / row count | Outside grid (React component) | Outside grid (React component) | Outside grid (React component) |
| Dark theme (#1e1e2e / #404040 / #e0e0e0 / #BD93F9) | Easy (`withParams()`) | Easy (write your own CSS) | Easy (theme object) |
| Responsive resize | Built-in | Manual (but straightforward) | Built-in |
| Cell text selection + copy | Partial (single cell via `enableCellTextSelection`; multi-cell needs custom handler) | Full (you own the DOM) | **No** (canvas pixels; only grid clipboard API) |
| Ctrl+C multi-cell copy | **Enterprise only** (custom handler ~40 LOC workaround) | DIY (~40 LOC) | Built-in |
| 100K+ row performance | Excellent | Excellent (with virtual) | Overkill-excellent |

---

## Recommendation

### Use AG Grid Community with a custom clipboard handler.

**Reasoning:**

1. **Fastest path to a polished result.** AG Grid gives you a production-quality table with sorting, filtering, column resizing, column reordering, row virtualization, and theming out of the box. A SQL result viewer is a display surface, not a spreadsheet — Community's feature set covers the need.

2. **The clipboard gap is small and solvable.** The Enterprise clipboard is the only meaningful missing feature. A ~40-line custom keyboard handler using the AG Grid API (`api.getSelectedRows()` or `api.getCellRanges()` from cell selection) + `navigator.clipboard.writeText()` bridges this cleanly. Set `enableCellTextSelection: true` for single-cell native select as a bonus.

3. **Custom cell renderers are React components.** Rendering NULL as `<span style={{color: '#888', fontStyle: 'italic'}}>NULL</span>`, a JSON cell as an expandable `<pre>` with a toggle button, or a column-type icon next to the header text — these are 10–20 line React components each, not canvas drawing code.

4. **Theming maps 1:1 to the spec.**
   ```ts
   const ferretDark = themeQuartz.withParams({
     backgroundColor: '#1e1e2e',
     foregroundColor: '#e0e0e0',
     accentColor: '#BD93F9',
     borderColor: '#404040',
     browserColorScheme: 'dark',
   });
   ```

5. **MIT license** is clean for an open-source project; no attribution or commercial concerns.

6. **Ecosystem durability.** 600K+ weekly downloads, 13K+ stars, active 2025–2026 releases, Fortune 500 adoption. This library is not going anywhere.

7. **Bundle size is irrelevant in Electron.** The 338 kB cost that matters in a web app is noise in an Electron bundle.

**Why not TanStack Table?** It would produce a better-looking result eventually, but the 2–5 day build cost for column resize handles, virtual scroll glue, sticky headers, drag reorder, and dark-theme CSS is not justified when AG Grid delivers all of it in an afternoon. If the team later wants pixel-perfect control over the table, migrating to TanStack is always possible since the data layer is separate.

**Why not Glide Data Grid?** The canvas rendering model makes custom cell content (especially expandable JSON) painful, text selection impossible, and the project's 3-year publish gap is a maintenance red flag. The performance advantage (millions of cells) is irrelevant for SQL result sets that are typically 10K–100K rows.

---

## Implementation Sketch (AG Grid Community)

```tsx
import { AgGridReact } from 'ag-grid-react';
import { themeQuartz } from 'ag-grid-community';

// 1. Theme
const ferretTheme = themeQuartz.withParams({
  backgroundColor: '#1e1e2e',
  foregroundColor: '#e0e0e0',
  accentColor: '#BD93F9',
  borderColor: '#404040',
  headerBackgroundColor: '#252535',
  browserColorScheme: 'dark',
});

// 2. Custom cell renderers
const NullCellRenderer = (params) => {
  if (params.value === null) {
    return <span className="null-value">NULL</span>; // italic gray via CSS
  }
  if (typeof params.value === 'object') {
    return <JsonCell value={params.value} />;  // expandable JSON
  }
  return params.value;
};

// 3. Column definitions (generated from query result metadata)
const buildColDefs = (columns, types) => [
  { headerName: '#', valueGetter: 'node.rowIndex + 1', width: 60, pinned: 'left' },
  ...columns.map((col, i) => ({
    field: col,
    headerComponent: TypedHeader,  // shows type icon
    headerComponentParams: { type: types[i] },
    cellRenderer: NullCellRenderer,
    resizable: true,
    sortable: true,
    filter: true,
  })),
];

// 4. Custom clipboard handler (bridges Community gap)
const onKeyDown = (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
    const rows = gridApi.getSelectedRows();
    if (rows.length) {
      const tsv = rows.map(r => Object.values(r).join('\t')).join('\n');
      navigator.clipboard.writeText(tsv);
    }
  }
};

// 5. Render
<div onKeyDown={onKeyDown}>
  <AgGridReact
    theme={ferretTheme}
    rowData={queryResult.rows}
    columnDefs={buildColDefs(queryResult.columns, queryResult.types)}
    rowSelection="multiple"
    enableCellTextSelection={true}
    ensureDomOrder={true}
  />
</div>
```

---

## Sources

- [AG Grid Community vs Enterprise](https://www.ag-grid.com/react-data-grid/community-vs-enterprise/)
- [AG Grid Theming: Colors & Dark Mode](https://www.ag-grid.com/javascript-data-grid/theming-colors/)
- [AG Grid Clipboard (Enterprise)](https://www.ag-grid.com/react-data-grid/clipboard/)
- [AG Grid License & Pricing](https://www.ag-grid.com/license-pricing/)
- [TanStack Table Overview](https://tanstack.com/table/latest/docs/overview)
- [TanStack Virtual](https://tanstack.com/virtual/latest)
- [TanStack Table vs AG Grid Comparison](https://www.simple-table.com/blog/tanstack-table-vs-ag-grid-comparison)
- [Glide Data Grid GitHub](https://github.com/glideapps/glide-data-grid)
- [Glide Data Grid API](https://github.com/glideapps/glide-data-grid/blob/main/packages/core/API.md)
- [Glide Data Grid Styling](https://docs.grid.glideapps.com/api/dataeditor/styling)
- [Glide Data Grid Custom Cells](https://docs.grid.glideapps.com/guides/implementing-custom-cells)
- [AG Grid npm](https://www.npmjs.com/package/ag-grid-community)
- [Glide Data Grid npm](https://www.npmjs.com/package/@glideapps/glide-data-grid)
