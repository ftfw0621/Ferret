import './StatusBar.css'
import type { ConnectionConfig, ConnectionStatus, QueryResult } from '../../lib/tauri'

interface Props {
  connection: ConnectionConfig | null
  status: ConnectionStatus | null
  queryResult: QueryResult | null
}

export function StatusBar({ connection, status, queryResult }: Props) {
  return (
    <div className="status-bar">
      <div className="status-item">
        <span className={`status-dot ${status?.connected ? '' : 'off'}`} />
        {connection ? connection.name || connection.database : 'No connection'}
      </div>
      {status?.serverVersion && (
        <>
          <span className="status-sep">·</span>
          <span>{status.serverVersion.split(' ').slice(0, 2).join(' ')}</span>
        </>
      )}
      <div className="status-right">
        {queryResult && !queryResult.error && (
          <>
            <span>{queryResult.rowCount} rows</span>
            <span className="status-sep">·</span>
            <span>{queryResult.durationMs}ms</span>
          </>
        )}
      </div>
    </div>
  )
}
