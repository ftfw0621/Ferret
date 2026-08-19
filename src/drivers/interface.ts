/**
 * Database Driver Interface
 *
 * This is the abstraction layer that allows Ferret to support
 * multiple database types. V1 ships with PostgreSQL only;
 * MySQL and SQLite can be added by implementing this interface.
 */

import type {
  ConnectionConfig,
  ConnectionStatus,
  QueryResult,
  SchemaInfo,
  TableInfo,
  ColumnDetail
} from '../shared/types'

export interface DatabaseDriver {
  /** Unique driver identifier */
  readonly type: string

  /** Human-readable name */
  readonly displayName: string

  /** Default port for this database type */
  readonly defaultPort: number

  /** Establish a connection */
  connect(config: ConnectionConfig): Promise<ConnectionStatus>

  /** Close the connection */
  disconnect(connectionId: string): Promise<void>

  /** Test if a connection config is valid */
  testConnection(config: ConnectionConfig): Promise<{ ok: boolean; error?: string }>

  /** Execute a SQL query and return results */
  executeQuery(
    connectionId: string,
    sql: string,
    params?: unknown[]
  ): Promise<QueryResult>

  /** Cancel a running query */
  cancelQuery(connectionId: string): Promise<void>

  /** List all schemas in the connected database */
  getSchemas(connectionId: string): Promise<SchemaInfo[]>

  /** List tables in a specific schema */
  getTables(connectionId: string, schema: string): Promise<TableInfo[]>

  /** Get column details for a specific table */
  getColumns(
    connectionId: string,
    schema: string,
    table: string
  ): Promise<ColumnDetail[]>
}
