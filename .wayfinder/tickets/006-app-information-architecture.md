---
id: "006"
title: "应用信息架构与布局"
type: grilling
status: open
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
