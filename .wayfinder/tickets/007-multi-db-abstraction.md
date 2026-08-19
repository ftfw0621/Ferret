---
id: "007"
title: "多数据库抽象层设计"
type: grilling
status: open
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
