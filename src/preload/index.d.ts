import { ElectronAPI } from '@electron-toolkit/preload'
import type { ConnectionConfig, ConnectionStatus, QueryResult, SchemaInfo, TableInfo, ColumnDetail } from '../shared/types'

interface FerretAPI {
  // Connection persistence
  listConnections(): Promise<ConnectionConfig[]>
  saveConnection(config: ConnectionConfig): Promise<{ ok: boolean }>
  deleteConnection(id: string): Promise<{ ok: boolean }>
  reorderConnections(ids: string[]): Promise<{ ok: boolean }>

  // Database operations
  connect(config: ConnectionConfig): Promise<ConnectionStatus>
  disconnect(connectionId: string): Promise<void>
  testConnection(config: ConnectionConfig): Promise<{ ok: boolean; error?: string }>

  // Query
  executeQuery(connectionId: string, sql: string, params?: unknown[]): Promise<QueryResult>
  cancelQuery(connectionId: string): Promise<void>

  // Schema
  getSchemas(connectionId: string): Promise<SchemaInfo[]>
  getTables(connectionId: string, schema: string): Promise<TableInfo[]>
  getColumns(connectionId: string, schema: string, table: string): Promise<ColumnDetail[]>
}

declare global {
  interface Window {
    electron: ElectronAPI
    ferret: FerretAPI
  }
}
