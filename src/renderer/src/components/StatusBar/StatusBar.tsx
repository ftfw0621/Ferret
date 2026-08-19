import type { ConnectionConfig, ConnectionStatus, QueryResult } from '../../../../shared/types'
import './StatusBar.css'

interface Props {
  connection: ConnectionConfig | null
  status: ConnectionStatus | null
  queryResult: QueryResult | null
}

export function StatusBar({ connection, status, queryResult }: Props) {
  return (
    <div className="statusbar">
      <div className="statusbar-left">
        {connection && status?.connected ? (
          <>
            <span className="statusbar-dot dot-connected" />
            <span className="statusbar-conn-name">{connection.name}</span>
            <span className="statusbar-sep">·</span>
            <span className="statusbar-version">
              {status.serverVersion
                ? status.serverVersion.split(' ').slice(0, 2).join(' ')
                : 'PostgreSQL'}
            </span>
          </>
        ) : connection ? (
          <>
            <span className="statusbar-dot dot-disconnected" />
            <span className="statusbar-conn-name">{connection.name}</span>
            <span className="statusbar-sep">·</span>
            <span className="statusbar-disconnected">Disconnected</span>
          </>
        ) : (
          <span className="statusbar-no-conn">No connection</span>
        )}
      </div>

      <div className="statusbar-right">
        {queryResult && !queryResult.error && (
          <>
            <span className="statusbar-rows">{queryResult.rowCount} rows</span>
            <span className="statusbar-sep">·</span>
            <span className="statusbar-time">{queryResult.duration}ms</span>
          </>
        )}
        {queryResult?.error && (
          <span className="statusbar-error">Error</span>
        )}
      </div>
    </div>
  )
}
