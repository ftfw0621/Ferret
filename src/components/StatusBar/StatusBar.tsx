import './StatusBar.css'
import type { ConnectionConfig, ConnectionStatus, QueryResult } from '../../lib/tauri'

interface Props {
  connection: ConnectionConfig | null
  status: ConnectionStatus | null
  queryResult: QueryResult | null
  tunnelState: 'none' | 'active' | 'disconnected'
  onReconnect?: () => void
}

export function StatusBar({ connection, status, queryResult, tunnelState, onReconnect }: Props) {
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
      {tunnelState === 'active' && connection?.tunnel && (
        <>
          <span className="status-sep">·</span>
          <span className="tunnel-badge active">
            ⇋ {connection.tunnel.type === 'kubectl' ? 'kubectl' : 'tunnel'}:{connection.tunnel.localPort}
          </span>
        </>
      )}
      {tunnelState === 'disconnected' && (
        <>
          <span className="status-sep">·</span>
          <span className="tunnel-badge dead">⚠ Tunnel lost</span>
          {onReconnect && (
            <button className="tunnel-reconnect" onClick={onReconnect}>
              Reconnect
            </button>
          )}
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
