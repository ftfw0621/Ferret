/**
 * Shared types between main and renderer processes.
 * These types define the contracts for IPC communication.
 */

// ── Connection ──

export interface ConnectionConfig {
  id: string
  name: string
  host: string
  port: number
  database: string
  username: string
  password?: string // stored in safeStorage, not here
  ssl: boolean
  color?: string // optional accent color for sidebar
}

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

export interface ColumnInfo {
  name: string
  dataType: string // PostgreSQL type name
  dataTypeId: number // OID
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

  // Query
  EXECUTE_QUERY: 'db:execute-query',
  CANCEL_QUERY: 'db:cancel-query',

  // Schema
  GET_SCHEMAS: 'db:get-schemas',
  GET_TABLES: 'db:get-tables',
  GET_COLUMNS: 'db:get-columns',
} as const
