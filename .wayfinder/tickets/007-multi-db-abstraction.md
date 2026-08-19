---
id: "007"
title: "多数据库抽象层设计"
type: grilling
status: closed
blocked_by: []
---

## Question

How should Ferret's TypeScript database driver abstraction be designed so PostgreSQL is V1 and MySQL/SQLite can be added later without changing the UI layer?

Design decisions:
- **Driver interface:** What does a `DatabaseDriver` look like?
  - `connect(config): Promise<Connection>`
  - `disconnect(): Promise<void>`
  - `query(sql, params?): Promise<QueryResult>`
  - `streamQuery(sql, params?): AsyncIterable<Row>`
  - `cancelQuery(): Promise<void>`
  - `getSchemas(): Promise<Schema[]>`
  - `getTables(schema): Promise<Table[]>`
  - `getColumns(schema, table): Promise<Column[]>`
  - `testConnection(): Promise<boolean>`
- **Type mapping:** How to normalize different DB types to a common type system for the UI
- **Schema introspection:** Common interface for browsing database structure across different DBs
- **Connection config:** What's common (host, port, user, pass, db) vs driver-specific (sslmode for PG, socket for MySQL)
- **Error normalization:** Different DBs have different error formats — how to present uniformly
- **Where does the abstraction live?** Separate npm package? Internal module boundary?

The answer should be a TypeScript interface definition + the PostgreSQL implementation sketch.

## Resolution

### Type Mapping
**保留原始类型名** — UI 显示数据库原始类型（int4, varchar, jsonb），不做统一映射。增加 `ColumnCategory` 大类（number/string/date/json/bool/binary/other）供 UI 做单元格渲染颜色和格式化。

### Connection Config
**每种数据库单独 Config 类型** — Discriminated union pattern:
- `BaseConnectionConfig`（id, name, driverType, color）
- `PostgresConnectionConfig`（host, port, database, username, password, sslMode）
- Future: `MySQLConnectionConfig`（+ socket）、`SQLiteConnectionConfig`（filePath only）
- `type ConnectionConfig = PostgresConnectionConfig` (V1)

### Error Normalization
所有 driver 返回统一的 `QueryResult.error?: string`。PG 错误消息直接透传，未来可增加 error code 分类。

### Module Location
**内部模块** — `src/drivers/` 目录，不抽成独立 npm 包。

### Code Changes
- `src/shared/types.ts` — discriminated union configs + ColumnCategory
- `src/drivers/postgres/index.ts` — oidToCategory(), sslMode enum
- `src/drivers/interface.ts` — unchanged (generic over ConnectionConfig)
