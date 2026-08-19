/**
 * PostgreSQL Driver
 *
 * Implements the DatabaseDriver interface using node-postgres (pg).
 * All database operations run in the Electron main process.
 */

import type { DatabaseDriver } from '../interface'
import type {
  ConnectionConfig,
  ConnectionStatus,
  QueryResult,
  SchemaInfo,
  TableInfo,
  ColumnDetail,
  ColumnInfo
} from '../../shared/types'

// pg is imported dynamically in main process only
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Pool } = require('pg')

interface PoolEntry {
  pool: InstanceType<typeof Pool>
  pid?: number // backend PID for cancel support
}

export class PostgresDriver implements DatabaseDriver {
  readonly type = 'postgresql'
  readonly displayName = 'PostgreSQL'
  readonly defaultPort = 5432

  private pools = new Map<string, PoolEntry>()

  async connect(config: ConnectionConfig): Promise<ConnectionStatus> {
    try {
      const pool = new Pool({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.username,
        password: config.password,
        max: 5,
        connectionTimeoutMillis: 10_000,
        idleTimeoutMillis: 30_000,
        allowExitOnIdle: true,
        ssl: config.ssl ? { rejectUnauthorized: false } : false
      })

      // Test the connection
      const client = await pool.connect()
      const versionResult = await client.query('SELECT version()')
      client.release()

      const serverVersion = versionResult.rows[0]?.version ?? 'Unknown'

      this.pools.set(config.id, { pool })

      return {
        id: config.id,
        connected: true,
        serverVersion
      }
    } catch (error) {
      return {
        id: config.id,
        connected: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async disconnect(connectionId: string): Promise<void> {
    const entry = this.pools.get(connectionId)
    if (entry) {
      await entry.pool.end()
      this.pools.delete(connectionId)
    }
  }

  async testConnection(
    config: ConnectionConfig
  ): Promise<{ ok: boolean; error?: string }> {
    const pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      max: 1,
      connectionTimeoutMillis: 5_000,
      ssl: config.ssl ? { rejectUnauthorized: false } : false
    })

    try {
      const client = await pool.connect()
      await client.query('SELECT 1')
      client.release()
      await pool.end()
      return { ok: true }
    } catch (error) {
      await pool.end().catch(() => {})
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async executeQuery(
    connectionId: string,
    sql: string,
    params?: unknown[]
  ): Promise<QueryResult> {
    const entry = this.pools.get(connectionId)
    if (!entry) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        duration: 0,
        error: 'Not connected'
      }
    }

    const start = performance.now()

    try {
      const client = await entry.pool.connect()
      // Store PID for cancel support
      const pidResult = await client.query('SELECT pg_backend_pid() AS pid')
      entry.pid = pidResult.rows[0]?.pid

      const result = await client.query({
        text: sql,
        values: params,
        rowMode: 'object'
      })

      client.release()
      entry.pid = undefined

      const duration = Math.round(performance.now() - start)

      const columns: ColumnInfo[] = (result.fields ?? []).map((f: { name: string; dataTypeID: number }) => ({
        name: f.name,
        dataType: this.oidToTypeName(f.dataTypeID),
        dataTypeId: f.dataTypeID
      }))

      return {
        columns,
        rows: result.rows ?? [],
        rowCount: result.rowCount ?? 0,
        duration
      }
    } catch (error) {
      const duration = Math.round(performance.now() - start)
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        duration,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async cancelQuery(connectionId: string): Promise<void> {
    const entry = this.pools.get(connectionId)
    if (!entry?.pid) return

    try {
      const client = await entry.pool.connect()
      await client.query('SELECT pg_cancel_backend($1)', [entry.pid])
      client.release()
    } catch {
      // Best effort
    }
  }

  async getSchemas(connectionId: string): Promise<SchemaInfo[]> {
    const result = await this.executeQuery(
      connectionId,
      `SELECT schema_name FROM information_schema.schemata
       WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
       ORDER BY schema_name`
    )

    return (result.rows ?? []).map((row: Record<string, unknown>) => ({
      name: row.schema_name as string,
      tables: []
    }))
  }

  async getTables(connectionId: string, schema: string): Promise<TableInfo[]> {
    const result = await this.executeQuery(
      connectionId,
      `SELECT
        t.table_name,
        t.table_type,
        COALESCE(
          (SELECT reltuples::bigint FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE c.relname = t.table_name AND n.nspname = t.table_schema),
          0
        ) AS row_estimate,
        obj_description(
          (SELECT c.oid FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE c.relname = t.table_name AND n.nspname = t.table_schema),
          'pg_class'
        ) AS comment
      FROM information_schema.tables t
      WHERE t.table_schema = $1
        AND t.table_type IN ('BASE TABLE', 'VIEW')
      ORDER BY t.table_type, t.table_name`,
      [schema]
    )

    return (result.rows ?? []).map((row: Record<string, unknown>) => ({
      name: row.table_name as string,
      schema,
      type: (row.table_type === 'VIEW' ? 'view' : 'table') as TableInfo['type'],
      rowCountEstimate: Number(row.row_estimate) || 0,
      comment: (row.comment as string) || undefined
    }))
  }

  async getColumns(
    connectionId: string,
    schema: string,
    table: string
  ): Promise<ColumnDetail[]> {
    const result = await this.executeQuery(
      connectionId,
      `SELECT
        c.column_name,
        c.data_type,
        c.udt_name,
        c.is_nullable,
        c.column_default,
        c.ordinal_position,
        COALESCE(
          (SELECT true FROM information_schema.key_column_usage kcu
           JOIN information_schema.table_constraints tc
             ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
           WHERE tc.constraint_type = 'PRIMARY KEY'
             AND kcu.table_schema = c.table_schema
             AND kcu.table_name = c.table_name
             AND kcu.column_name = c.column_name),
          false
        ) AS is_pk,
        col_description(
          (SELECT oid FROM pg_class WHERE relname = $2
           AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = $1)),
          c.ordinal_position
        ) AS comment
      FROM information_schema.columns c
      WHERE c.table_schema = $1 AND c.table_name = $2
      ORDER BY c.ordinal_position`,
      [schema, table]
    )

    return (result.rows ?? []).map((row: Record<string, unknown>) => ({
      name: row.column_name as string,
      dataType: (row.udt_name as string) || (row.data_type as string),
      nullable: row.is_nullable === 'YES',
      defaultValue: (row.column_default as string) || undefined,
      isPrimaryKey: Boolean(row.is_pk),
      comment: (row.comment as string) || undefined,
      ordinalPosition: Number(row.ordinal_position)
    }))
  }

  /** Map common PostgreSQL OIDs to type names */
  private oidToTypeName(oid: number): string {
    const map: Record<number, string> = {
      16: 'bool',
      20: 'int8',
      21: 'int2',
      23: 'int4',
      25: 'text',
      114: 'json',
      142: 'xml',
      700: 'float4',
      701: 'float8',
      1043: 'varchar',
      1082: 'date',
      1114: 'timestamp',
      1184: 'timestamptz',
      1700: 'numeric',
      2950: 'uuid',
      3802: 'jsonb'
    }
    return map[oid] || `oid:${oid}`
  }
}
