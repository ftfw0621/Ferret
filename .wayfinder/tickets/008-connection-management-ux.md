---
id: "008"
title: "连接管理 UX 设计"
type: grilling
status: open
blocked_by: []
---

## Question

How should Ferret's connection management work from the user's perspective?

Decide:
- **First-run experience:** App opens → what does the user see? Empty state with "Add Connection" prompt?
- **Add connection flow:**
  - Form fields: name (alias), host, port, database, username, password, SSL mode
  - "Test Connection" button before saving
  - Connection string paste support (parse `postgresql://...` into fields)
  - Default values (localhost, 5432, postgres)
- **Connection list:**
  - Sidebar list or separate management dialog?
  - Visual indicator: connected (green dot), disconnected (gray), error (red)
  - Right-click context menu: connect, disconnect, edit, duplicate, delete
  - Drag to reorder?
- **Credential storage:**
  - Save password in macOS Keychain (secure) vs local encrypted storage
  - "Remember password" checkbox
  - Option to ask for password on each connect
- **Multi-connection:**
  - Can multiple connections be active simultaneously?
  - Each query tab bound to a specific connection?
  - Or one active connection at a time?
- **Connection config persistence:**
  - Where to store: `~/Library/Application Support/Ferret/connections.json`?
  - Passwords separate (Keychain) from connection metadata (JSON)
