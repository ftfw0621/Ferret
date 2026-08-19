import { useState, useEffect, useCallback } from 'react'
import './assets/base.css'
import './assets/app.css'
import { useConnections } from './hooks/useConnections'
import { Sidebar } from './components/Sidebar/Sidebar'
import { ConnectionModal } from './components/ConnectionModal/ConnectionModal'
import { QueryEditor } from './components/Editor/QueryEditor'
import { ResultTable } from './components/Results/ResultTable'
import { StatusBar } from './components/StatusBar/StatusBar'
import type { ConnectionConfig, QueryResult } from '../../shared/types'

function App(): React.JSX.Element {
  const {
    connections,
    statusMap,
    activeConnectionId,
    activeConnection,
    activeStatus,
    schemasMap,
    tablesMap,
    columnsMap,
    saveConnection,
    removeConnection,
    connectTo,
    disconnectFrom,
    testConnection,
    fetchColumns,
    setActiveConnectionId
  } = useConnections()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingConn, setEditingConn] = useState<ConnectionConfig | undefined>()
  const [sql, setSql] = useState('')
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const [sidebarVisible, setSidebarVisible] = useState(true)

  // ⌘+N to open new connection modal
  // ⌘+B to toggle sidebar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'n') {
        e.preventDefault()
        setEditingConn(undefined)
        setModalOpen(true)
      }
      if (e.metaKey && e.key === 'b') {
        e.preventDefault()
        setSidebarVisible((v) => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleSaveConnection = useCallback(async (config: ConnectionConfig) => {
    await saveConnection(config)
    // Auto-connect after saving
    await connectTo(config.id)
  }, [saveConnection, connectTo])

  const handleEditConnection = useCallback((config: ConnectionConfig) => {
    setEditingConn(config)
    setModalOpen(true)
  }, [])

  const handleAddClick = useCallback(() => {
    setEditingConn(undefined)
    setModalOpen(true)
  }, [])

  const handleTableClick = useCallback(async (connectionId: string, schema: string, table: string) => {
    if (!schema || !table) return
    setActiveConnectionId(connectionId)
    const query = `SELECT * FROM "${schema}"."${table}" LIMIT 100;`
    setSql(query)
    // Auto-execute
    setIsExecuting(true)
    try {
      const result = await window.ferret.executeQuery(connectionId, query)
      setQueryResult(result)
    } finally {
      setIsExecuting(false)
    }
  }, [setActiveConnectionId])

  const handleExecute = useCallback(async () => {
    if (!activeConnectionId || !sql.trim()) return
    setIsExecuting(true)
    setQueryResult(null)
    try {
      const result = await window.ferret.executeQuery(activeConnectionId, sql)
      setQueryResult(result)
    } catch (err) {
      setQueryResult({
        columns: [],
        rows: [],
        rowCount: 0,
        duration: 0,
        error: String(err)
      })
    } finally {
      setIsExecuting(false)
    }
  }, [activeConnectionId, sql])

  const hasActiveConnection = activeConnection && activeStatus?.connected

  return (
    <div className={`app-layout ${sidebarVisible ? '' : 'sidebar-collapsed'}`}>
      {/* Sidebar */}
      {sidebarVisible && (
        <Sidebar
          connections={connections}
          statusMap={statusMap}
          activeConnectionId={activeConnectionId}
          schemasMap={schemasMap}
          tablesMap={tablesMap}
          columnsMap={columnsMap}
          onAddClick={handleAddClick}
          onConnect={connectTo}
          onDisconnect={disconnectFrom}
          onEdit={handleEditConnection}
          onDelete={removeConnection}
          onTableClick={handleTableClick}
          onFetchColumns={fetchColumns}
        />
      )}

      {/* Main content */}
      <main className="main-area">
        {hasActiveConnection ? (
          <>
            {/* Tab bar */}
            <div className="tab-bar">
              <div className="tab active">
                <span className="tab-icon">◆</span>
                Query 1
              </div>
            </div>

            {/* Editor + Results split */}
            <div className="editor-results-split">
              <div className="editor-pane">
                <QueryEditor
                  value={sql}
                  onChange={setSql}
                  onExecute={handleExecute}
                />
              </div>

              <div className="split-handle" />

              <div className="results-pane">
                {queryResult && !queryResult.error && (
                  <div className="results-toolbar">
                    <span>Results</span>
                    <span className="results-count">{queryResult.rowCount} rows</span>
                    <span className="results-time">{queryResult.duration}ms</span>
                  </div>
                )}
                <ResultTable queryResult={queryResult} isExecuting={isExecuting} />
              </div>
            </div>
          </>
        ) : (
          /* Welcome state */
          <div className="welcome">
            <div className="welcome-icon">🦦</div>
            <h1 className="welcome-title">Ferret</h1>
            <p className="welcome-subtitle">Connect to a database to get started</p>
            <div className="welcome-shortcuts">
              <div className="shortcut">
                <kbd>⌘</kbd><kbd>N</kbd>
                <span>New Connection</span>
              </div>
              <div className="shortcut">
                <kbd>⌘</kbd><kbd>B</kbd>
                <span>Toggle Sidebar</span>
              </div>
            </div>
          </div>
        )}

        {/* Status bar */}
        <StatusBar
          connection={activeConnection}
          status={activeStatus}
          queryResult={queryResult}
        />
      </main>

      {/* Connection modal */}
      <ConnectionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveConnection}
        onTest={testConnection}
        editingConnection={editingConn}
      />
    </div>
  )
}

export default App
