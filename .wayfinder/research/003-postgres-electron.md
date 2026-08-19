# 003 — PostgreSQL from Electron

> How a React + Electron app should connect to, query, and introspect PostgreSQL databases.

---

## 1. Architecture: Main Process Owns the Connection

**Never** import `pg` in the renderer process. The renderer runs in a Chromium sandbox; giving it raw TCP access to a database exposes credentials in DevTools, bypasses contextIsolation, and violates Electron security best practices.

```
Renderer (React)                Main Process
─────────────────               ──────────────────────
ipcRenderer.invoke('db:query')  ──►  ipcMain.handle('db:query')
                                         │
                                     pg.Pool  ──►  PostgreSQL
                                         │
◄── JSON result / error  ◄──────────  return rows
```

All `pg` usage lives in the main process. The renderer communicates via `contextBridge`-exposed IPC channels only.

---

## 2. node-postgres (`pg`) Driver

### 2.1 Installation

```bash
npm install pg                  # core driver
npm install pg-cursor           # server-side cursor for batch reads
npm install pg-query-stream     # Node.js Readable stream wrapper around cursor
npm install @types/pg           # TypeScript types
```

### 2.2 Connection Pooling with `pg.Pool`

For a desktop app a single Pool instance is sufficient. Desktop apps typically have one user, so the pool can be smaller than a server deployment.

```ts
// main/db/pool.ts
import { Pool, PoolConfig } from 'pg';

export function createPool(config: PoolConfig): Pool {
  const pool = new Pool({
    host: config.host ?? 'localhost',
    port: config.port ?? 5432,
    user: config.user,
    password: config.password,
    database: config.database,

    // Desktop-appropriate pool sizing
    max: 5,                        // max simultaneous connections
    min: 0,                        // no idle minimum for desktop
    idleTimeoutMillis: 30_000,     // close idle conns after 30s
    connectionTimeoutMillis: 10_000, // fail connect after 10s
    allowExitOnIdle: true,         // let Node exit when pool is idle

    // SSL — see §2.3
    ssl: config.ssl,
  });

  // Surface pool errors instead of crashing
  pool.on('error', (err) => {
    console.error('[pg pool] unexpected error on idle client', err);
  });

  return pool;
}
```

**Key Pool behaviors:**

| Setting | Desktop recommendation | Why |
|---|---|---|
| `max` | 3–5 | Single user; more wastes server slots |
| `min` | 0 | No need to keep warm connections when the app is idle |
| `idleTimeoutMillis` | 30 000 | Free resources between user actions |
| `connectionTimeoutMillis` | 10 000 | Desktop users tolerate slightly longer waits; avoid premature failures on slow networks |
| `allowExitOnIdle` | `true` | Prevents the pool from keeping the Electron process alive after quit |

### 2.3 SSL / TLS Connections

The `ssl` property on the config object is passed directly to Node's `tls.connect()`.

```ts
import { readFileSync } from 'fs';

// Full verification (production / cloud databases)
const sslFull = {
  rejectUnauthorized: true,
  ca: readFileSync('/path/to/ca-cert.pem').toString(),
};

// Client certificate authentication
const sslMutual = {
  rejectUnauthorized: true,
  ca: readFileSync('/path/to/ca.pem').toString(),
  key: readFileSync('/path/to/client-key.pem').toString(),
  cert: readFileSync('/path/to/client-cert.pem').toString(),
};

// Self-signed (dev only — never ship this)
const sslDev = {
  rejectUnauthorized: false,
};
```

**Gotcha:** If you pass a connection string with `?sslmode=require`, node-postgres silently overrides the `ssl` object properties. Keep TLS config in the `ssl` object and **do not** put `sslmode` in the connection URL.

PostgreSQL 17+ supports direct SSL negotiation (immediate TLS handshake without the cleartext startup packet). Enable with `sslnegotiation: 'direct'` in the ssl config.

### 2.4 Type Mapping: PostgreSQL → JavaScript

node-postgres returns all values as strings by default and uses OID-based type parsers to convert them. The `pg-types` package (bundled) handles common types:

| PostgreSQL type | JS result | Notes |
|---|---|---|
| `int2`, `int4` | `number` | Parsed by default |
| `int8` (bigint) | **`string`** | JS Number overflows at 2^53; kept as string for safety |
| `float4`, `float8` | `number` | |
| `numeric` / `decimal` | **`string`** | Arbitrary precision; no JS equivalent |
| `bool` | `boolean` | |
| `text`, `varchar` | `string` | |
| `json`, `jsonb` | parsed object | `JSON.parse` applied |
| `date` | `Date` | Midnight local time |
| `timestamp` | `Date` | **Microseconds truncated** — JS Date is millisecond precision |
| `timestamptz` | `Date` | Converted to local timezone |
| `uuid` | `string` | |
| `bytea` | `Buffer` | |
| `array` (e.g. `int[]`) | `Array` | Parsed recursively |
| `interval` | object `{years, months, days, hours, minutes, seconds}` | via `postgres-interval` |

**Custom type parsers** — override globally or per-pool:

```ts
import { types } from 'pg';

// Parse int8 (OID 20) as BigInt instead of string
types.setTypeParser(20, (val: string) => BigInt(val));

// Keep timestamps as ISO strings instead of Date objects
types.setTypeParser(1114, (val: string) => val); // timestamp
types.setTypeParser(1184, (val: string) => val); // timestamptz

// Per-pool override (pg 8.8+)
const pool = new Pool({
  ...config,
  types: {
    getTypeParser: (oid: number) => {
      if (oid === 20) return (val: string) => BigInt(val);
      return types.getTypeParser(oid);
    },
  },
});
```

### 2.5 Query Streaming for Large Result Sets

Two complementary packages, both using PostgreSQL server-side cursors:

#### pg-cursor — pull-based, batch reads

```ts
import { Pool } from 'pg';
import Cursor from 'pg-cursor';

async function readLargeTable(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    const cursor = client.query(
      new Cursor('SELECT * FROM large_table WHERE created_at > $1', ['2025-01-01'])
    );

    const batchSize = 100;
    let rows = await cursor.read(batchSize);
    while (rows.length > 0) {
      // Process batch
      for (const row of rows) {
        // handle row...
      }
      rows = await cursor.read(batchSize);
    }
    await cursor.close();
  } finally {
    client.release();
  }
}
```

#### pg-query-stream — Node.js Readable stream

```ts
import { Pool } from 'pg';
import QueryStream from 'pg-query-stream';

async function streamResults(pool: Pool): Promise<any[]> {
  const client = await pool.connect();
  const results: any[] = [];

  try {
    const query = new QueryStream(
      'SELECT * FROM large_table',
      [],
      { batchSize: 256 } // internal cursor fetch size
    );
    const stream = client.query(query);

    for await (const row of stream) {
      results.push(row);
      // Or pipe: stream.pipe(transformStream).pipe(writableStream);
    }
  } finally {
    client.release();
  }
  return results;
}
```

---

## 3. IPC Pattern: Renderer ↔ Main Process

### 3.1 Preload Script (contextBridge)

```ts
// preload.ts
import { contextBridge, ipcRenderer } from 'electron';

export interface DbApi {
  query(sql: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }>;
  testConnection(config: ConnectionConfig): Promise<boolean>;
  disconnect(): Promise<void>;
  connect(config: ConnectionConfig): Promise<void>;
  // Schema introspection
  listDatabases(): Promise<string[]>;
  listSchemas(database: string): Promise<string[]>;
  listTables(schema: string): Promise<TableInfo[]>;
  listColumns(schema: string, table: string): Promise<ColumnInfo[]>;
}

contextBridge.exposeInMainWorld('db', {
  query: (sql: string, params?: any[]) =>
    ipcRenderer.invoke('db:query', sql, params),
  testConnection: (config: ConnectionConfig) =>
    ipcRenderer.invoke('db:test-connection', config),
  disconnect: () =>
    ipcRenderer.invoke('db:disconnect'),
  connect: (config: ConnectionConfig) =>
    ipcRenderer.invoke('db:connect', config),
  listDatabases: () =>
    ipcRenderer.invoke('db:list-databases'),
  listSchemas: (database: string) =>
    ipcRenderer.invoke('db:list-schemas', database),
  listTables: (schema: string) =>
    ipcRenderer.invoke('db:list-tables', schema),
  listColumns: (schema: string, table: string) =>
    ipcRenderer.invoke('db:list-columns', schema, table),
} satisfies DbApi);
```

### 3.2 Main Process Handlers

```ts
// main/db/ipc-handlers.ts
import { ipcMain } from 'electron';
import { Pool } from 'pg';
import { createPool } from './pool';

let pool: Pool | null = null;

export function registerDbHandlers(): void {

  ipcMain.handle('db:connect', async (_event, config: ConnectionConfig) => {
    if (pool) {
      await pool.end();
    }
    pool = createPool(config);
    // Verify the connection actually works
    const client = await pool.connect();
    client.release();
  });

  ipcMain.handle('db:disconnect', async () => {
    if (pool) {
      await pool.end();
      pool = null;
    }
  });

  ipcMain.handle('db:test-connection', async (_event, config: ConnectionConfig) => {
    const testPool = createPool({ ...config, max: 1, connectionTimeoutMillis: 5000 });
    try {
      const client = await testPool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch {
      return false;
    } finally {
      await testPool.end();
    }
  });

  ipcMain.handle('db:query', async (_event, sql: string, params?: any[]) => {
    if (!pool) throw new Error('Not connected');
    const result = await pool.query(sql, params);
    return {
      rows: result.rows,
      rowCount: result.rowCount,
      fields: result.fields.map(f => ({
        name: f.name,
        dataTypeID: f.dataTypeID,
        tableID: f.tableID,
      })),
    };
  });

  // Schema introspection handlers — see §6 for the SQL
  ipcMain.handle('db:list-databases', async () => {
    if (!pool) throw new Error('Not connected');
    const { rows } = await pool.query(
      `SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname`
    );
    return rows.map((r: any) => r.datname);
  });

  // ... additional schema handlers
}
```

### 3.3 Streaming Large Results over IPC

IPC serializes to JSON, so you cannot pipe a Node stream directly. Two practical approaches:

#### Option A: Chunked IPC with a reply channel

```ts
// main process
ipcMain.handle('db:stream-query', async (event, id: string, sql: string, params?: any[]) => {
  if (!pool) throw new Error('Not connected');
  const client = await pool.connect();
  try {
    const cursor = client.query(new Cursor(sql, params));
    const batchSize = 500;
    let batch = await cursor.read(batchSize);
    while (batch.length > 0) {
      event.sender.send(`db:stream-chunk:${id}`, batch);
      batch = await cursor.read(batchSize);
    }
    event.sender.send(`db:stream-end:${id}`);
    await cursor.close();
  } finally {
    client.release();
  }
});

// preload
contextBridge.exposeInMainWorld('db', {
  streamQuery: (sql: string, params: any[], onChunk: (rows: any[]) => void) => {
    const id = crypto.randomUUID();
    const cleanup = () => {
      ipcRenderer.removeAllListeners(`db:stream-chunk:${id}`);
      ipcRenderer.removeAllListeners(`db:stream-end:${id}`);
    };
    return new Promise<void>((resolve, reject) => {
      ipcRenderer.on(`db:stream-chunk:${id}`, (_e, rows) => onChunk(rows));
      ipcRenderer.on(`db:stream-end:${id}`, () => { cleanup(); resolve(); });
      ipcRenderer.invoke('db:stream-query', id, sql, params).catch((err) => {
        cleanup();
        reject(err);
      });
    });
  },
});
```

#### Option B: MessagePort (Electron 22+)

Use `MessageChannelMain` to create a dedicated port for streaming — avoids polluting the global IPC namespace.

```ts
// main process
import { MessageChannelMain } from 'electron';

ipcMain.handle('db:open-stream', async (event, sql: string, params?: any[]) => {
  const { port1, port2 } = new MessageChannelMain();
  event.sender.postMessage('db:stream-port', null, [port2]);

  const client = await pool!.connect();
  const cursor = client.query(new Cursor(sql, params));
  const batchSize = 500;

  try {
    let batch = await cursor.read(batchSize);
    while (batch.length > 0) {
      port1.postMessage({ type: 'chunk', rows: batch });
      batch = await cursor.read(batchSize);
    }
    port1.postMessage({ type: 'end' });
  } finally {
    await cursor.close();
    client.release();
    port1.close();
  }
});
```

### 3.4 Using from React

```tsx
// renderer — React component
function QueryRunner() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const runQuery = async (sql: string) => {
    setLoading(true);
    try {
      const result = await window.db.query(sql);
      setRows(result.rows);
    } catch (err) {
      console.error('Query failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (/* ... */);
}
```

---

## 4. Credential Security on macOS

### 4.1 Electron `safeStorage` (recommended — no extra dependency)

Electron's built-in `safeStorage` API encrypts strings using the macOS Keychain. The encryption key is stored in a Keychain entry named `<AppName> Safe Storage`.

```ts
// main/credentials.ts
import { safeStorage } from 'electron';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';

const credPath = join(app.getPath('userData'), 'connections.enc');

interface StoredConnection {
  name: string;
  host: string;
  port: number;
  user: string;
  password: string;   // will be encrypted at rest
  database: string;
  ssl?: object;
}

export function saveConnections(connections: StoredConnection[]): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption not available');
  }
  const json = JSON.stringify(connections);
  const encrypted = safeStorage.encryptString(json);
  writeFileSync(credPath, encrypted);
}

export function loadConnections(): StoredConnection[] {
  if (!existsSync(credPath)) return [];
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption not available');
  }
  const encrypted = readFileSync(credPath);
  const json = safeStorage.decryptString(encrypted);
  return JSON.parse(json);
}
```

**How it works under the hood:** On macOS, safeStorage uses `SecKeychainAddGenericPassword` / `SecKeychainFindGenericPassword`. The key is AES-128-CBC with a hardcoded IV (Electron's implementation detail — the real security comes from the Keychain gating access to the encryption key per-app signing identity).

### 4.2 `keychain-store` (modern macOS Data Protection Keychain)

For apps that need per-item Keychain entries (visible in Keychain Access) rather than a single encrypted blob:

```bash
npm install keychain-store
```

```ts
import { KeychainStore } from 'keychain-store';

const keychain = new KeychainStore({
  service: 'com.yourapp.ferret',
});

await keychain.set('pg-password-prod', 'hunter2');
const password = await keychain.get('pg-password-prod');
await keychain.delete('pg-password-prod');
```

Uses `SecItemAdd` / `SecItemCopyMatching` with `kSecUseDataProtectionKeychain: true` — Apple's recommended path for new work.

### 4.3 Comparison

| Approach | Dependency | macOS Keychain | Per-item entries | Biometric gate | Recommendation |
|---|---|---|---|---|---|
| `safeStorage` | Built-in | Yes (one blob key) | No | No | Default choice |
| `keychain-store` | Native module | Yes (Data Protection) | Yes | Possible | When per-credential Keychain visibility needed |
| `keytar` | Native module (deprecated) | Yes (legacy file keychain) | Yes | No | **Avoid** — archived, no longer maintained |

**Recommendation:** Use `safeStorage` for simplicity. It requires no native compilation, ships with Electron, and is sufficient for storing serialized connection configs.

---

## 5. Connection Lifecycle

### 5.1 Full Lifecycle Manager

```ts
// main/db/connection-manager.ts
import { Pool, PoolClient } from 'pg';
import { createPool } from './pool';

export class ConnectionManager {
  private pool: Pool | null = null;
  private config: PoolConfig | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  async connect(config: PoolConfig): Promise<void> {
    this.config = config;
    this.pool = createPool(config);

    this.pool.on('error', (err) => {
      console.error('[ConnectionManager] pool error:', err);
      this.scheduleReconnect();
    });

    // Verify connection works
    await this.test();
  }

  async test(): Promise<{ ok: boolean; latencyMs: number; serverVersion: string }> {
    if (!this.pool) throw new Error('Not connected');
    const start = Date.now();
    const client = await this.pool.connect();
    try {
      const { rows } = await client.query('SELECT version()');
      return {
        ok: true,
        latencyMs: Date.now() - start,
        serverVersion: rows[0].version,
      };
    } finally {
      client.release();
    }
  }

  async disconnect(): Promise<void> {
    this.clearReconnect();
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async query(sql: string, params?: any[]) {
    if (!this.pool) throw new Error('Not connected');
    return this.pool.query(sql, params);
  }

  /** Get a dedicated client for transactions or cursors */
  async acquireClient(): Promise<PoolClient> {
    if (!this.pool) throw new Error('Not connected');
    return this.pool.connect();
  }

  get isConnected(): boolean {
    return this.pool !== null && this.pool.totalCount > 0;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || !this.config) return;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        console.log('[ConnectionManager] attempting reconnect...');
        await this.connect(this.config!);
        console.log('[ConnectionManager] reconnected');
      } catch (err) {
        console.error('[ConnectionManager] reconnect failed:', err);
        this.scheduleReconnect(); // exponential backoff could be added
      }
    }, 5000);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
```

### 5.2 Timeout Handling

```ts
// Per-query statement timeout (PostgreSQL-side enforcement)
await pool.query("SET statement_timeout = '30s'");
await pool.query('SELECT * FROM slow_table'); // cancelled after 30s

// Or set per-connection via pool config
const pool = new Pool({
  ...config,
  statement_timeout: 30_000, // 30 seconds
});

// Connection-level timeout is handled by connectionTimeoutMillis in Pool config
```

---

## 6. Query Execution

### 6.1 Cancelling Long-Running Queries

PostgreSQL supports query cancellation via a backend cancel message. With node-postgres, the most reliable approach:

```ts
async function cancellableQuery(pool: Pool, sql: string, params?: any[], signal?: AbortSignal) {
  const client = await pool.connect();
  try {
    // Get this connection's backend PID
    const { rows: [{ pg_backend_pid: pid }] } = await client.query('SELECT pg_backend_pid()');

    // Set up cancellation
    const cancelHandler = async () => {
      // Use a separate connection to cancel
      const cancelClient = await pool.connect();
      try {
        await cancelClient.query('SELECT pg_cancel_backend($1)', [pid]);
      } finally {
        cancelClient.release();
      }
    };

    signal?.addEventListener('abort', cancelHandler, { once: true });

    try {
      return await client.query(sql, params);
    } finally {
      signal?.removeEventListener('abort', cancelHandler);
    }
  } finally {
    client.release();
  }
}

// Usage
const controller = new AbortController();
const resultPromise = cancellableQuery(pool, 'SELECT * FROM huge_table', [], controller.signal);

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);
```

**Alternative — `statement_timeout`:** Simpler but less flexible. Set per-session or per-transaction:

```sql
SET LOCAL statement_timeout = '10s';   -- per-transaction
SET statement_timeout = '30s';          -- per-session
```

### 6.2 Transactions

```ts
async function transferFunds(pool: Pool, from: number, to: number, amount: number) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
      [amount, from]
    );
    await client.query(
      'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
      [amount, to]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

**Important:** Always acquire a dedicated client via `pool.connect()` for transactions. Do not use `pool.query()` — the pool may route successive queries to different connections.

### 6.3 Multiple Statements

PostgreSQL's simple query protocol allows multiple semicolon-separated statements, but node-postgres sends them all at once and only returns the **last** result:

```ts
// Only the last result is returned
const result = await pool.query(`
  CREATE TEMP TABLE t (x int);
  INSERT INTO t VALUES (1), (2), (3);
  SELECT * FROM t;
`);
// result.rows = [{x: 1}, {x: 2}, {x: 3}]
```

For multiple independent results, issue separate `pool.query()` calls, or use a transaction with dedicated client.

---

## 7. Schema Introspection Queries

### 7.1 List Databases

```sql
SELECT datname
FROM pg_database
WHERE datistemplate = false
ORDER BY datname;
```

### 7.2 List Schemas

```sql
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
ORDER BY schema_name;
```

### 7.3 List Tables (and Views)

```sql
SELECT
  t.table_name,
  t.table_type,                              -- 'BASE TABLE', 'VIEW', 'FOREIGN TABLE'
  obj_description((quote_ident(t.table_schema) || '.' || quote_ident(t.table_name))::regclass) AS comment,
  pg_size_pretty(pg_total_relation_size((quote_ident(t.table_schema) || '.' || quote_ident(t.table_name))::regclass)) AS total_size,
  (SELECT count(*) FROM information_schema.columns c
   WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name) AS column_count
FROM information_schema.tables t
WHERE t.table_schema = $1                    -- schema name parameter
  AND t.table_type IN ('BASE TABLE', 'VIEW')
ORDER BY t.table_type, t.table_name;
```

### 7.4 List Columns

```sql
SELECT
  c.column_name,
  c.ordinal_position,
  c.data_type,
  c.udt_name,                                -- underlying type (e.g. 'int4', 'varchar')
  c.character_maximum_length,
  c.numeric_precision,
  c.numeric_scale,
  c.is_nullable,                              -- 'YES' or 'NO'
  c.column_default,
  col_description(
    (quote_ident(c.table_schema) || '.' || quote_ident(c.table_name))::regclass,
    c.ordinal_position
  ) AS comment,
  c.is_identity,                              -- 'YES' or 'NO'
  c.identity_generation                       -- 'ALWAYS', 'BY DEFAULT', or null
FROM information_schema.columns c
WHERE c.table_schema = $1
  AND c.table_name = $2
ORDER BY c.ordinal_position;
```

### 7.5 List Constraints (primary keys, foreign keys, unique, check)

```sql
SELECT
  tc.constraint_name,
  tc.constraint_type,                         -- 'PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE', 'CHECK'
  kcu.column_name,
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name   AS foreign_table_name,
  ccu.column_name  AS foreign_column_name,
  cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
  AND tc.table_schema = ccu.table_schema
  AND tc.constraint_type = 'FOREIGN KEY'
LEFT JOIN information_schema.check_constraints cc
  ON tc.constraint_name = cc.constraint_name
  AND tc.table_schema = cc.constraint_schema
WHERE tc.table_schema = $1
  AND tc.table_name = $2
ORDER BY tc.constraint_type, tc.constraint_name, kcu.ordinal_position;
```

### 7.6 List Indexes

`information_schema` does not expose indexes well. Use `pg_indexes` instead:

```sql
SELECT
  i.indexname,
  i.indexdef,
  ix.indisunique   AS is_unique,
  ix.indisprimary  AS is_primary,
  array_agg(a.attname ORDER BY x.ordinality) AS column_names
FROM pg_indexes i
JOIN pg_class c     ON c.relname = i.indexname
JOIN pg_index ix    ON ix.indexrelid = c.oid
CROSS JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS x(attnum, ordinality)
JOIN pg_attribute a ON a.attrelid = ix.indrelid AND a.attnum = x.attnum
WHERE i.schemaname = $1
  AND i.tablename = $2
GROUP BY i.indexname, i.indexdef, ix.indisunique, ix.indisprimary
ORDER BY ix.indisprimary DESC, i.indexname;
```

### 7.7 List Foreign Keys (detailed, multi-column aware)

```sql
SELECT
  conname AS constraint_name,
  (SELECT array_agg(a.attname ORDER BY x.n)
   FROM unnest(conkey) WITH ORDINALITY AS x(attnum, n)
   JOIN pg_attribute a ON a.attrelid = conrelid AND a.attnum = x.attnum
  ) AS source_columns,
  confrelid::regclass::text AS target_table,
  (SELECT array_agg(a.attname ORDER BY x.n)
   FROM unnest(confkey) WITH ORDINALITY AS x(attnum, n)
   JOIN pg_attribute a ON a.attrelid = confrelid AND a.attnum = x.attnum
  ) AS target_columns,
  CASE confupdtype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
       WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END AS on_update,
  CASE confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
       WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END AS on_delete
FROM pg_constraint
WHERE conrelid = (quote_ident($1) || '.' || quote_ident($2))::regclass
  AND contype = 'f'
ORDER BY conname;
```

### 7.8 Table Row Count Estimate (fast, without full scan)

```sql
SELECT reltuples::bigint AS estimated_row_count
FROM pg_class
WHERE oid = (quote_ident($1) || '.' || quote_ident($2))::regclass;
```

---

## 8. Putting It All Together — Recommended Package Set

```json
{
  "dependencies": {
    "pg": "^8.13",
    "pg-cursor": "^2.11",
    "pg-query-stream": "^4.7"
  },
  "devDependencies": {
    "@types/pg": "^8.11",
    "@types/pg-cursor": "^2.7"
  }
}
```

No `keytar` needed — `safeStorage` is built into Electron.

---

## 9. Key Decisions for Ferret

| Decision | Recommendation | Rationale |
|---|---|---|
| Where to run `pg` | Main process only | Security; renderer must not see credentials or hold TCP connections |
| Pool size | max 3–5 | Single desktop user, keep server slots low |
| Credential storage | `safeStorage` | Zero dependencies, macOS Keychain-backed |
| Large result streaming | pg-cursor + chunked IPC | Keeps renderer responsive; MessagePort is cleaner for Electron 22+ |
| Type mapping | Override int8→BigInt, keep timestamps as ISO strings | Prevents silent precision loss; ISO strings serialize cleanly across IPC |
| Query cancellation | `pg_cancel_backend` via AbortController pattern | Cooperative and safe; combine with `statement_timeout` as a hard ceiling |
| Schema introspection | `pg_catalog` views for indexes/FKs, `information_schema` for the rest | `information_schema` is standards-compliant but lacks index data |

---

## Sources

- [node-postgres — Connection Pooling](https://node-postgres.com/features/pooling)
- [node-postgres — SSL](https://node-postgres.com/features/ssl)
- [node-postgres — Type Parsing](https://node-postgres.com/features/types)
- [node-postgres — Cursor API](https://node-postgres.com/apis/cursor)
- [pg-query-stream on GitHub](https://github.com/brianc/node-postgres/tree/master/packages/pg-query-stream)
- [Electron IPC Tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Electron ipcMain API](https://www.electronjs.org/docs/latest/api/ipc-main)
- [Electron safeStorage API](https://www.electronjs.org/docs/latest/api/safe-storage)
- [keychain-store on GitHub](https://github.com/biw/keychain-store)
- [Replacing Keytar with safeStorage](https://freek.dev/2103-replacing-keytar-with-electrons-safestorage-in-ray)
- [PostgreSQL Information Schema Documentation](https://www.postgresql.org/docs/current/information-schema.html)
- [node-postgres sslmode Gotcha](https://devops-daily.com/posts/node-postgres-sslmode-silently-ignores-ssl-options)
- [Node.js Connection Pooling for PostgreSQL](https://oneuptime.com/blog/post/2026-01-06-nodejs-connection-pooling-postgresql-mysql/view)
- [pg-types on GitHub](https://github.com/brianc/node-pg-types)
- [Cancel a Hanging PostgreSQL Query](https://www.cybertec-postgresql.com/en/cancel-hanging-postgresql-query/)
