import { useState, useCallback } from 'react'
import type { ConnectionConfig, ConnectionStatus, SchemaInfo, TableInfo, ColumnDetail } from '../../../../shared/types'
import './Sidebar.css'

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

export function Sidebar({
  connections,
  statusMap,
  activeConnectionId,
  schemasMap,
  tablesMap,
  columnsMap,
  onAddClick,
  onConnect,
  onDisconnect,
  onEdit,
  onDelete,
  onTableClick,
  onFetchColumns
}: Props) {
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set())
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; connId: string } | null>(null)

  const toggleSchema = useCallback((key: string) => {
    setExpandedSchemas((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const toggleTable = useCallback((key: string, connectionId: string, schema: string, table: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
        // Fetch columns if not loaded
        const colKey = `${connectionId}:${schema}.${table}`
        if (!columnsMap[colKey]) {
          onFetchColumns(connectionId, schema, table)
        }
      }
      return next
    })
  }, [columnsMap, onFetchColumns])

  const handleContextMenu = (e: React.MouseEvent, connId: string) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, connId })
  }

  const closeContextMenu = () => setContextMenu(null)

  const getStatusDot = (id: string): string => {
    const status = statusMap[id]
    if (!status) return 'dot-disconnected'
    if (status.error) return 'dot-error'
    if (status.connected) return 'dot-connected'
    return 'dot-disconnected'
  }

  return (
    <aside className="sidebar" onClick={closeContextMenu}>
      <div className="sidebar-header">
        <span className="sidebar-title">Connections</span>
        <button className="sidebar-add" title="Add Connection (⌘N)" onClick={onAddClick}>+</button>
      </div>

      <div className="sidebar-tree">
        {connections.length === 0 ? (
          <div className="sidebar-empty">
            <p>No connections yet</p>
            <p className="sidebar-hint">Click + to add a database</p>
          </div>
        ) : (
          connections.map((conn) => {
            const isConnected = statusMap[conn.id]?.connected
            const schemas = schemasMap[conn.id] ?? []

            return (
              <div key={conn.id}>
                {/* Connection item */}
                <div
                  className={`tree-item tree-conn ${activeConnectionId === conn.id ? 'active' : ''}`}
                  onClick={() => isConnected ? undefined : onConnect(conn.id)}
                  onDoubleClick={() => onTableClick(conn.id, '', '')}
                  onContextMenu={(e) => handleContextMenu(e, conn.id)}
                >
                  <span className={`conn-dot ${getStatusDot(conn.id)}`} />
                  <span className="tree-icon db">▥</span>
                  <span className="tree-label">{conn.name}</span>
                </div>

                {/* Schema tree (only when connected) */}
                {isConnected && schemas.map((schema) => {
                  const schemaKey = `${conn.id}:${schema.name}`
                  const isExpanded = expandedSchemas.has(schemaKey)
                  const tables = tablesMap[schemaKey] ?? []

                  return (
                    <div key={schemaKey}>
                      <div
                        className="tree-item tree-schema"
                        onClick={() => toggleSchema(schemaKey)}
                      >
                        <span className="tree-chevron">{isExpanded ? '▾' : '▸'}</span>
                        <span className="tree-section-label">{schema.name}</span>
                      </div>

                      {isExpanded && tables.map((table) => {
                        const tableKey = `${conn.id}:${schema.name}.${table.name}`
                        const isTableExpanded = expandedTables.has(tableKey)
                        const columns = columnsMap[tableKey] ?? []

                        return (
                          <div key={tableKey}>
                            <div
                              className="tree-item tree-table"
                              onClick={() => toggleTable(tableKey, conn.id, schema.name, table.name)}
                              onDoubleClick={() => onTableClick(conn.id, schema.name, table.name)}
                            >
                              <span className="tree-chevron">{isTableExpanded ? '▾' : '▸'}</span>
                              <span className="tree-icon">{table.type === 'view' ? '◇' : '◫'}</span>
                              <span className="tree-label">{table.name}</span>
                              <span className="tree-count">
                                {table.rowCountEstimate > 0
                                  ? table.rowCountEstimate >= 1000
                                    ? `${(table.rowCountEstimate / 1000).toFixed(1)}k`
                                    : table.rowCountEstimate
                                  : ''}
                              </span>
                            </div>

                            {isTableExpanded && columns.map((col) => (
                              <div key={col.name} className="tree-item tree-column">
                                <span className="tree-col-icon">{col.isPrimaryKey ? '⊕' : '○'}</span>
                                <span className="tree-col-name">{col.name}</span>
                                <span className="tree-col-type">{col.dataType}</span>
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
          })
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {statusMap[contextMenu.connId]?.connected ? (
            <button onClick={() => { onDisconnect(contextMenu.connId); closeContextMenu() }}>
              Disconnect
            </button>
          ) : (
            <button onClick={() => { onConnect(contextMenu.connId); closeContextMenu() }}>
              Connect
            </button>
          )}
          <button onClick={() => {
            const c = connections.find((x) => x.id === contextMenu.connId)
            if (c) onEdit(c)
            closeContextMenu()
          }}>Edit</button>
          <div className="context-divider" />
          <button className="context-danger" onClick={() => { onDelete(contextMenu.connId); closeContextMenu() }}>
            Delete
          </button>
        </div>
      )}
    </aside>
  )
}
