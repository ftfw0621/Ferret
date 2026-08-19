---
id: "006"
title: "应用信息架构与布局"
type: grilling
status: closed
blocked_by: []
---

## Question

What is the right information architecture and layout for Ferret's main window?

Decide:

### Layout Structure
- **Three-panel layout?** Sidebar (connections + schema) | Editor (SQL) | Results (table)
- Or **two-panel** with sidebar + main area (editor/results stacked vertically)?
- Resizable split panes — which direction(s)?
- Collapsible sidebar?

### Sidebar Design
- Connection list at the top → schema tree below?
- Or connections as a separate view/dialog?
- Schema tree: Database → Schema → Table → Columns? How deep?
- Icons for each node type (database, table, view, column with type indicator)

### Main Area
- Editor and results: stacked vertically (top/bottom split)?
- Multiple tabs for different queries?
- Each tab has its own editor + result, or shared result area?

### Navigation Model
- Click a connection → opens it, shows schema in sidebar
- Click a table → what happens? Opens a SELECT query? Shows table info?
- Keyboard-driven navigation between panels

### Status Bar
- Current connection name
- Query execution time
- Row count
- Connection status indicator

Reference apps to look at: DataGrip, TablePlus, DBeaver, Postico, Beekeeper Studio.

## Resolution

**DataGrip-inspired two-panel layout** (V1 skips right tool panel).

### Layout
```
┌──────┬──────────────────────┐
│ Side │  Tab1 | Tab2 | Tab3  │
│ bar  │──────────────────────│
│      │                      │
│ 连接  │  SQL Editor           │
│ 树    │                      │
│      │───────── ↕ resize ───│
│ Sche │                      │
│ ma   │  Result Table         │
│ 浏览  │                      │
├──────┴──────────────────────┤
│ ● connected · PG 16 │ 42 rows · 14ms │
└─────────────────────────────┘
```

### Decisions

1. **Layout**: 左侧边栏 (220px, 可折叠 ⌘+B) + 主区域 (编辑器上 + 结果下, 可拖拽分割)
2. **右侧面板**: V1 不做，未来加表结构详情
3. **编辑器/结果分割**: 上下垂直分割，可拖拽调整比例
4. **Tab 模型**: 独立——每个 tab 拥有自己的编辑器 + 结果表格
5. **点击表名**: 在新 tab 打开 `SELECT * FROM table LIMIT 100` 并自动执行
6. **侧边栏**: 连接列表 (顶部) + Schema 浏览树 (底部)，点击连接展开 schema
7. **状态栏**: 左侧 = 连接状态点 + 连接名 + PG 版本；右侧 = 行数 + 查询耗时 + 光标位置

### Keyboard Shortcuts (planned)
- `⌘+B` 折叠/展开侧边栏
- `⌘+Enter` 执行当前 query
- `⌘+T` 新建 query tab
- `⌘+W` 关闭当前 tab
- `⌘+N` 新建连接
