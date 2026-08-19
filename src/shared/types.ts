/**
 * Shared types between main and renderer processes.
 * These types define the contracts for IPC communication.
 */

// ── Connection ──
// Discriminated union: each DB type has its own config shape.
// UI renders driver-specific fields based on driverType.

export type DriverType = 'postgresql' | 'mysql' | 'sqlite'

interface BaseConnectionConfig {
  id: string
  name: string
  driverType: DriverType
  color?: string // optional accent color for sidebar
}

export interface PostgresConnectionConfig extends BaseConnectionConfig {
  driverType: 'postgresql'
  host: string
  port: number
  database: string
  username: string
  password?: string // stored in safeStorage, not here
  sslMode: 'disable' | 'require' | 'verify-ca' | 'verify-full' | 'prefer'
}

// Future: MySQL
// export interface MySQLConnectionConfig extends BaseConnectionConfig {
//   driverType: 'mysql'
//   host: string
//   port: number
//   database: string
//   username: string
//   password?: string
//   socket?: string  // Unix socket path
// }

// Future: SQLite
// export interface SQLiteConnectionConfig extends BaseConnectionConfig {
//   driverType: 'sqlite'
//   filePath: string  // path to .db file
// }

// V1: only PostgreSQL
export type ConnectionConfig = PostgresConnectionConfig
// Future: PostgresConnectionConfig | MySQLConnectionConfig | SQLiteConnectionConfig

export interface ConnectionStatus {
  id: string
  connected: boolean
  serverVersion?: string
  error?: string
}

// ── Query ──

export interface QueryRequest {
  connectionId: string
  sql: string
  params?: unknown[]
}

export interface QueryResult {
  columns: ColumnInfo[]
  rows: Record<string, unknown>[]
  rowCount: number
  duration: number // milliseconds
  error?: string
}

/** Broad type category for UI cell rendering (color, formatting) */
export type ColumnCategory = 'number' | 'string' | 'date' | 'boolean' | 'json' | 'binary' | 'other'

export interface ColumnInfo {
  name: string
  dataType: string // native DB type name (int4, varchar, jsonb) — kept as-is
  dataTypeId: number // OID (PG-specific, 0 for other DBs)
  category: ColumnCategory // broad category for UI rendering
}

// ── Schema ──

export interface SchemaInfo {
  name: string
  tables: TableInfo[]
}

export interface TableInfo {
  name: string
  schema: string
  type: 'table' | 'view' | 'materialized_view'
  rowCountEstimate: number
  comment?: string
}

export interface ColumnDetail {
  name: string
  dataType: string
  nullable: boolean
  defaultValue?: string
  isPrimaryKey: boolean
  comment?: string
  ordinalPosition: number
}

// ── IPC Channels ──

export const IPC_CHANNELS = {
  // Connection
  CONNECT: 'db:connect',
  DISCONNECT: 'db:disconnect',
  TEST_CONNECTION: 'db:test',
  LIST_CONNECTIONS: 'db:list-connections',
  SAVE_CONNECTION: 'db:save-connection',
  DELETE_CONNECTION: 'db:delete-connection',
  REORDER_CONNECTIONS: 'db:reorder-connections',

  // Query
  EXECUTE_QUERY: 'db:execute-query',
  CANCEL_QUERY: 'db:cancel-query',

  // Schema
  GET_SCHEMAS: 'db:get-schemas',
  GET_TABLES: 'db:get-tables',
  GET_COLUMNS: 'db:get-columns',
} as const
