import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export interface TunnelConfig {
  type: 'kubectl' | 'custom'
  kubeContext?: string
  kubeNamespace?: string
  kubeResource?: string
  localPort: number
  remotePort: number
  customCommand?: string
}

export interface ConnectionConfig {
  id: string
  name: string
  driverType: 'postgresql' | 'mysql' | 'sqlite'
  host: string
  port: number
  database: string
  username: string
  password?: string
  sslMode: string
  color?: string
  tunnel?: TunnelConfig
}

export interface ConnectionStatus {
  id: string
  connected: boolean
  serverVersion?: string
  error?: string
}

export interface QueryResult {
  columns: ColumnInfo[]
  rows: Record<string, unknown>[]
  rowCount: number
  durationMs: number
  error?: string
}

export interface ColumnInfo {
  name: string
  dataType: string
  category: 'number' | 'string' | 'date' | 'boolean' | 'json' | 'binary' | 'other'
}

export interface SchemaInfo {
  name: string
}

export interface TableInfo {
  name: string
  schema: string
  type: string
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

export interface TunnelEvent {
  connectionId: string
  status: 'disconnected'
  message: string
}

export const ferret = {
  // Connection persistence
  listConnections: (): Promise<ConnectionConfig[]> =>
    invoke('list_connections'),

  saveConnection: (config: ConnectionConfig): Promise<void> =>
    invoke('save_connection', { config }),

  deleteConnection: (id: string): Promise<void> =>
    invoke('delete_connection', { id }),

  reorderConnections: (ids: string[]): Promise<void> =>
    invoke('reorder_connections', { ids }),

  // Database operations
  connect: (config: ConnectionConfig): Promise<ConnectionStatus> =>
    invoke('connect_db', { config }),

  disconnect: (connectionId: string): Promise<void> =>
    invoke('disconnect_db', { connectionId }),

  testConnection: (config: ConnectionConfig): Promise<string> =>
    invoke('test_connection', { config }),

  // Query
  executeQuery: (connectionId: string, sql: string): Promise<QueryResult> =>
    invoke('execute_query', { connectionId, sql }),

  cancelQuery: (): Promise<void> =>
    invoke('cancel_query'),

  // Schema
  getSchemas: (connectionId: string): Promise<SchemaInfo[]> =>
    invoke('get_schemas', { connectionId }),

  getTables: (connectionId: string, schema: string): Promise<TableInfo[]> =>
    invoke('get_tables', { connectionId, schema }),

  getColumns: (connectionId: string, schema: string, table: string): Promise<ColumnDetail[]> =>
    invoke('get_columns', { connectionId, schema, table }),

  // Utilities
  parseConnectionUrl: (url: string): Promise<ConnectionConfig> =>
    invoke('parse_connection_url', { url }),

  // Events
  onTunnelStatus: (handler: (event: TunnelEvent) => void): Promise<UnlistenFn> =>
    listen<TunnelEvent>('tunnel-status', (e) => handler(e.payload)),
}
