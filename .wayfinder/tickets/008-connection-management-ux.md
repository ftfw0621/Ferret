---
id: "008"
title: "连接管理 UX 设计"
type: grilling
status: closed
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

## Resolution

### Multi-connection
**同时多个连接** — 可以同时连接 production + staging。每个 query tab 绑定一个连接，tab 标题显示连接名。侧边栏多个连接都可以展开 schema。

### Add Connection Flow
**侧边栏 + 模态弹窗** — 点侧边栏 `+` 按钮弹出模态窗口：
- 表单字段：Name (alias), Host, Port, Database, Username, Password, SSL Mode
- 默认值：localhost, 5432, postgres, disable
- **连接字符串粘贴** ✅ — 粘贴 `postgresql://user:pass@host:5432/db` 自动解析填充所有字段
- "Test Connection" 按钮（测试成功显示绿色 ✓ + PG 版本）
- Save / Cancel 按钮
- 编辑复用同一弹窗

### First-run Experience
App 启动 → Welcome screen（🦦 图标 + "Connect to a database to get started" + 键盘快捷键提示）。侧边栏空状态显示 "No connections yet" + "Click + to add"。

### Connection List
- 侧边栏列表，**支持拖拽排序**
- 状态指示器：🟢 connected / ⚫ disconnected / 🔴 error
- **右键上下文菜单**：连接 / 断开 / 编辑 / 复制 / 删除 / 新建查询

### Credential Storage
**两者都支持** — 默认用 `safeStorage` (Keychain-backed) 加密保存密码，但每个连接有 "每次询问密码" 选项。

### Config Persistence
- 连接元数据：`~/Library/Application Support/Ferret/connections.json`
- 密码：通过 Electron `safeStorage` 加密后存在同一文件中（不明文）
- 顺序：JSON 数组顺序即列表顺序（支持拖拽重排后保存）
