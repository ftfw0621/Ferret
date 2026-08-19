---
id: "003"
title: "Electron 中 PostgreSQL 连接与查询"
type: research
status: closed
blocked_by: []
---

## Question

How should an Electron app connect to and query PostgreSQL databases?

Investigate:
- **node-postgres (pg)** — the standard Node.js PostgreSQL driver
  - Main process vs renderer process: where should the connection live?
  - Connection pooling: `pg.Pool` configuration for a desktop app (not a server)
  - SSL/TLS connection support
  - Query streaming for large result sets
  - Parameterized queries and SQL injection prevention
  - Type mapping: PostgreSQL types → JavaScript types (especially dates, JSON, arrays, UUIDs)
- **Connection string format:** `postgresql://user:pass@host:port/dbname?sslmode=require`
- **Credential security:** Where to store saved passwords on macOS?
  - macOS Keychain via `keytar` or `@electron/keychain`
  - Encrypted local storage
- **Connection lifecycle:** Connect, test, disconnect, reconnect on error
- **Query execution:**
  - Streaming results vs buffered results
  - Cancelling long-running queries
  - Transaction support (BEGIN/COMMIT/ROLLBACK)
  - Multiple result sets from a single query
- **Schema introspection queries:** What SQL to run to get databases, schemas, tables, columns, types, constraints, indexes
- **IPC pattern:** How the renderer (React UI) communicates query requests to the main process (where pg runs)

## Resolution

**All pg usage in main process only.** Renderer communicates via contextBridge IPC.

- **Pool**: `pg.Pool` with max 3-5 connections, `allowExitOnIdle: true`
- **SSL**: Pass `ssl` object directly on pool config; avoid `sslmode` in URL (silently overrides)
- **Types**: Keep int8 as BigInt, timestamps as ISO strings — avoid JS Date precision loss
- **Streaming**: `pg-cursor` for pull-based batches, `pg-query-stream` for Node Readable
- **Credentials**: **`safeStorage`** (built-in Electron, Keychain-backed, zero deps). `keytar` is deprecated.
- **Cancellation**: `pg_cancel_backend(pid)` via separate connection + AbortController pattern
- **Schema SQL**: Complete queries for databases, schemas, tables (with size), columns, constraints, indexes, foreign keys
- **IPC**: Chunked events with unique channel ID, or MessagePort for Electron 22+
- **Packages**: `pg`, `pg-cursor`, `pg-query-stream`, `@types/pg`

Full research: `.wayfinder/research/003-postgres-electron.md`
