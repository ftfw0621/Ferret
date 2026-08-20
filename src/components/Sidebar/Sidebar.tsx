import { useState, useCallback, useEffect } from 'react'
import './Sidebar.css'
import type { ConnectionConfig, ConnectionStatus, SchemaInfo, TableInfo, ColumnDetail } from '../../lib/tauri'

interface Props {
  connections: ConnectionConfig[]
  statusMap: Record<string, ConnectionStatus>
  activeConnectionId: string | null
  schemasMap: Record<string, SchemaInfo[]>
  tablesMap: Record<string, TableInfo[]>
  columnsMap: Record<string, ColumnDetail[]>
  onAddClick: () => void
  onConnect: (id: string) => void
  onDisconnect: (id: string) => void
  onEdit: (config: ConnectionConfig) => void
  onDelete: (id: string) => void
  onTableClick: (connectionId: string, schema: string, table: string) => void
  onFetchColumns: (connectionId: string, schema: string, table: string) => void
}

interface CtxMenu {
  x: number; y: number; connId: string
}

export function Sidebar(props: Props) {
  const { connections, statusMap, activeConnectionId, schemasMap, tablesMap, columnsMap } = props
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set())
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set())
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null)

  useEffect(() => {
    const close = () => setCtxMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent, connId: string) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, connId })
  }, [])

  const toggleSchema = (key: string) => {
    setExpandedSchemas(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const toggleTable = (key: string, connectionId: string, schema: string, table: string) => {
    setExpandedTables(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
        if (!columnsMap[key]) props.onFetchColumns(connectionId, schema, table)
      }
      return next
    })
  }

  if (connections.length === 0) {
    return (
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-title">Connections</span>
          <button className="sidebar-add" onClick={props.onAddClick} title="Add Connection">+</button>
        </div>
        <div className="sidebar-empty">
          <p>No connections yet</p>
          <p className="sidebar-hint">Click + to add a database connection</p>
        </div>
      </aside>
    )
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Connections</span>
        <button className="sidebar-add" onClick={props.onAddClick} title="Add Connection">+</button>
      </div>
      <div className="sidebar-tree">
        {connections.map(conn => {
          const status = statusMap[conn.id]
          const isConnected = status?.connected
          const isActive = conn.id === activeConnectionId
          const schemas = schemasMap[conn.id] ?? []

          return (
            <div key={conn.id}>
              <div
                className={`tree-item ${isActive ? 'active' : ''}`}
                onClick={() => isConnected ? props.onDisconnect(conn.id) : props.onConnect(conn.id)}
                onContextMenu={e => handleContextMenu(e, conn.id)}
              >
                <span className={`conn-dot ${isConnected ? 'connected' : status?.error ? 'error' : 'disconnected'}`} />
                <span className="tree-icon db">▥</span>
                <span>{conn.name || conn.database}</span>
              </div>

              {isConnected && schemas.map(schema => {
                const schemaKey = `${conn.id}:${schema.name}`
                const isSchemaExpanded = expandedSchemas.has(schemaKey)
                const tables = tablesMap[schemaKey] ?? []

                return (
                  <div key={schemaKey}>
                    <div className="sidebar-section" style={{ cursor: 'pointer' }} onClick={() => toggleSchema(schemaKey)}>
                      <span style={{ marginRight: '0.3rem' }}>{isSchemaExpanded ? '▾' : '▸'}</span>
                      {schema.name}
                    </div>

                    {isSchemaExpanded && tables.map(table => {
                      const tableKey = `${conn.id}:${schema.name}:${table.name}`
                      const isTableExpanded = expandedTables.has(tableKey)
                      const cols = columnsMap[tableKey] ?? []

                      return (
                        <div key={tableKey}>
                          <div
                            className="tree-item"
                            onClick={() => toggleTable(tableKey, conn.id, schema.name, table.name)}
                            onDoubleClick={() => props.onTableClick(conn.id, schema.name, table.name)}
                          >
                            <span className="tree-indent" />
                            <span className="tree-chevron">{isTableExpanded ? '▾' : '▸'}</span>
                            <span className="tree-icon">◫</span>
                            <span>{table.name}</span>
                            {table.rowCountEstimate > 0 && (
                              <span className="tree-count">
                                {table.rowCountEstimate >= 1000
                                  ? `${(table.rowCountEstimate / 1000).toFixed(1)}k`
                                  : table.rowCountEstimate}
                              </span>
                            )}
                          </div>
                          {isTableExpanded && cols.map(col => (
                            <div key={col.name} className="tree-item">
                              <span className="tree-indent" />
                              <span className="tree-indent" />
                              <span className="tree-icon" style={{ fontSize: '0.55rem', color: col.isPrimaryKey ? 'var(--f-accent)' : 'var(--f-text-4)' }}>
                                {col.isPrimaryKey ? '⊕' : '○'}
                              </span>
                              <span style={{ color: 'var(--f-text-3)' }}>{col.name}</span>
                              <span style={{ marginLeft: 'auto', fontSize: '0.55rem', color: 'var(--f-text-4)' }}>
                                {col.dataType}
                              </span>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {ctxMenu && (
        <div className="ctx-menu" style={{ left: ctxMenu.x, top: ctxMenu.y }}>
          {statusMap[ctxMenu.connId]?.connected ? (
            <button className="ctx-item" onClick={() => { props.onDisconnect(ctxMenu.connId); setCtxMenu(null) }}>
              Disconnect
            </button>
          ) : (
            <button className="ctx-item" onClick={() => { props.onConnect(ctxMenu.connId); setCtxMenu(null) }}>
              Connect
            </button>
          )}
          <button className="ctx-item" onClick={() => {
            const conn = connections.find(c => c.id === ctxMenu.connId)
            if (conn) props.onEdit(conn)
            setCtxMenu(null)
          }}>Edit</button>
          <button className="ctx-item danger" onClick={() => { props.onDelete(ctxMenu.connId); setCtxMenu(null) }}>
            Delete
          </button>
        </div>
      )}
    </aside>
  )
}
