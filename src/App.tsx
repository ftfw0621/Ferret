import { useState, useEffect, useCallback, useRef } from 'react'
import './assets/base.css'
import './assets/app.css'
import { useConnections } from './hooks/useConnections'
import { Sidebar } from './components/Sidebar/Sidebar'
import { ConnectionModal } from './components/ConnectionModal/ConnectionModal'
import { QueryEditor } from './components/Editor/QueryEditor'
import { ResultTable } from './components/Results/ResultTable'
import { StatusBar } from './components/StatusBar/StatusBar'
import { ferret } from './lib/tauri'
import type { ConnectionConfig, QueryResult } from './lib/tauri'

interface Tab {
  id: string
  title: string
  sql: string
  result: QueryResult | null
  isExecuting: boolean
  connectionId: string | null
}

let tabCounter = 1

function createTab(connectionId: string | null, title?: string, sql?: string): Tab {
  const id = `tab-${Date.now()}-${tabCounter++}`
  return {
    id,
    title: title || `Query ${tabCounter - 1}`,
    sql: sql || '',
    result: null,
    isExecuting: false,
    connectionId,
  }
}

function App() {
  const {
    connections, statusMap, activeConnectionId, activeConnection, activeStatus,
    schemasMap, tablesMap, columnsMap, tunnelDead, connectingIds,
    saveConnection, removeConnection, connectTo, disconnectFrom, testConnection,
    fetchColumns, reconnectTunnel, setActiveConnectionId,
  } = useConnections()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingConn, setEditingConn] = useState<ConnectionConfig | undefined>()
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [editorHeight, setEditorHeight] = useState(45)
  const [sidebarWidth, setSidebarWidth] = useState(220)
  const splitRef = useRef<HTMLDivElement>(null)
  const [sidebarVisible, setSidebarVisible] = useState(true)

  const activeTab = tabs.find(t => t.id === activeTabId) ?? null

  // Create first tab when a connection becomes active
  useEffect(() => {
    if (activeConnectionId && tabs.length === 0) {
      const tab = createTab(activeConnectionId)
      setTabs([tab])
      setActiveTabId(tab.id)
    }
  }, [activeConnectionId, tabs.length])

  // ⌘+N new connection, ⌘+B toggle sidebar, ⌘+T new tab, ⌘+W close tab
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'n') {
        e.preventDefault(); setEditingConn(undefined); setModalOpen(true)
      }
      if (e.metaKey && e.key === 'b') {
        e.preventDefault(); setSidebarVisible(v => !v)
      }
      if (e.metaKey && e.key === 't') {
        e.preventDefault(); handleNewTab()
      }
      if (e.metaKey && e.key === 'w') {
        e.preventDefault(); if (activeTabId) handleCloseTab(activeTabId)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId, activeConnectionId])

  const handleNewTab = useCallback(() => {
    if (!activeConnectionId) return
    const tab = createTab(activeConnectionId)
    setTabs(prev => [...prev, tab])
    setActiveTabId(tab.id)
  }, [activeConnectionId])

  const handleCloseTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const next = prev.filter(t => t.id !== tabId)
      if (next.length === 0 && activeConnectionId) {
        // Always keep at least one tab
        const newTab = createTab(activeConnectionId)
        setActiveTabId(newTab.id)
        return [newTab]
      }
      // If closing the active tab, switch to the nearest one
      if (tabId === activeTabId) {
        const idx = prev.findIndex(t => t.id === tabId)
        const nextActive = next[Math.min(idx, next.length - 1)]
        setActiveTabId(nextActive?.id ?? null)
      }
      return next
    })
  }, [activeTabId, activeConnectionId])

  const updateTab = useCallback((tabId: string, updates: Partial<Tab>) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, ...updates } : t))
  }, [])

  const handleSaveConnection = useCallback(async (config: ConnectionConfig) => {
    await saveConnection(config)
    await connectTo(config.id)
  }, [saveConnection, connectTo])

  const handleEditConnection = useCallback((config: ConnectionConfig) => {
    setEditingConn(config)
    setModalOpen(true)
  }, [])

  const handleTableClick = useCallback(async (connectionId: string, schema: string, table: string) => {
    setActiveConnectionId(connectionId)
    const query = `SELECT * FROM "${schema}"."${table}" LIMIT 100;`
    // Open in a new tab
    const tab = createTab(connectionId, table, query)
    setTabs(prev => [...prev, tab])
    setActiveTabId(tab.id)
    // Auto-execute
    updateTab(tab.id, { isExecuting: true })
    try {
      const result = await ferret.executeQuery(connectionId, query)
      updateTab(tab.id, { result, isExecuting: false })
    } catch {
      updateTab(tab.id, { isExecuting: false })
    }
  }, [setActiveConnectionId, updateTab])

  const handleExecute = useCallback(async (sql: string) => {
    if (!activeTab || !activeConnectionId || !sql.trim()) return
    updateTab(activeTab.id, { isExecuting: true, result: null })
    try {
      const result = await ferret.executeQuery(activeConnectionId, sql)
      updateTab(activeTab.id, { result, isExecuting: false })
    } catch (err) {
      updateTab(activeTab.id, {
        result: { columns: [], rows: [], rowCount: 0, durationMs: 0, error: String(err) },
        isExecuting: false,
      })
    }
  }, [activeTab, activeConnectionId, updateTab])

  const handleSqlChange = useCallback((sql: string) => {
    if (activeTabId) updateTab(activeTabId, { sql })
  }, [activeTabId, updateTab])

  const hasActiveConnection = activeConnection && activeStatus?.connected

  return (
    <div
      className={`app-layout ${sidebarVisible ? '' : 'sidebar-collapsed'}`}
      style={sidebarVisible ? { gridTemplateColumns: `${sidebarWidth}px 4px 1fr` } : undefined}
    >
      {sidebarVisible && (
        <>
          <Sidebar
            connections={connections}
            statusMap={statusMap}
            activeConnectionId={activeConnectionId}
            schemasMap={schemasMap}
            tablesMap={tablesMap}
            columnsMap={columnsMap}
            connectingIds={connectingIds}
            onAddClick={() => { setEditingConn(undefined); setModalOpen(true) }}
            onConnect={connectTo}
            onDisconnect={disconnectFrom}
            onEdit={handleEditConnection}
            onDelete={removeConnection}
            onTableClick={handleTableClick}
            onFetchColumns={fetchColumns}
          />
          <div
            className="sidebar-resize-handle"
            onMouseDown={(e) => {
              e.preventDefault()
              const startX = e.clientX
              const startWidth = sidebarWidth
              const onMouseMove = (ev: MouseEvent) => {
                const delta = ev.clientX - startX
                setSidebarWidth(Math.min(Math.max(startWidth + delta, 140), 500))
              }
              const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove)
                document.removeEventListener('mouseup', onMouseUp)
                document.body.style.cursor = ''
                document.body.style.userSelect = ''
              }
              document.body.style.cursor = 'col-resize'
              document.body.style.userSelect = 'none'
              document.addEventListener('mousemove', onMouseMove)
              document.addEventListener('mouseup', onMouseUp)
            }}
          />
        </>
      )}

      <main className="main-area">
        {hasActiveConnection ? (
          <>
            {/* Tab bar */}
            <div className="tab-bar" data-tauri-drag-region>
              {tabs.map(tab => (
                <div
                  key={tab.id}
                  className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
                  onClick={() => setActiveTabId(tab.id)}
                >
                  <span className="tab-icon">{tab.id === activeTabId ? '◆' : '◇'}</span>
                  <span className="tab-title">{tab.title}</span>
                  <span
                    className="tab-close"
                    onClick={(e) => { e.stopPropagation(); handleCloseTab(tab.id) }}
                  >✕</span>
                </div>
              ))}
              <button className="tab-add" onClick={handleNewTab} title="New Tab (⌘+T)">+</button>
            </div>

            {/* Editor + Results for active tab */}
            {activeTab && (
              <div className="editor-results-split" ref={splitRef}>
                <div className="editor-pane" style={{ flex: `0 0 ${editorHeight}%` }}>
                  <QueryEditor
                    value={activeTab.sql}
                    onChange={handleSqlChange}
                    onExecute={handleExecute}
                    isExecuting={activeTab.isExecuting}
                  />
                </div>
                <div
                  className="split-handle"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    const container = splitRef.current
                    if (!container) return
                    const startY = e.clientY
                    const startHeight = editorHeight
                    const containerHeight = container.getBoundingClientRect().height
                    const onMouseMove = (ev: MouseEvent) => {
                      const delta = ev.clientY - startY
                      const pct = startHeight + (delta / containerHeight) * 100
                      setEditorHeight(Math.min(Math.max(pct, 10), 90))
                    }
                    const onMouseUp = () => {
                      document.removeEventListener('mousemove', onMouseMove)
                      document.removeEventListener('mouseup', onMouseUp)
                      document.body.style.cursor = ''
                      document.body.style.userSelect = ''
                    }
                    document.body.style.cursor = 'row-resize'
                    document.body.style.userSelect = 'none'
                    document.addEventListener('mousemove', onMouseMove)
                    document.addEventListener('mouseup', onMouseUp)
                  }}
                />
                <div className="results-pane">
                  {activeTab.result && !activeTab.result.error && (
                    <div className="results-toolbar">
                      <span>Results</span>
                      <span className="results-count">{activeTab.result.rowCount} rows</span>
                      <span className="results-time">{activeTab.result.durationMs}ms</span>
                    </div>
                  )}
                  <ResultTable queryResult={activeTab.result} isExecuting={activeTab.isExecuting} />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="welcome" data-tauri-drag-region>
            <div className="welcome-icon">
              <svg width="64" height="64" viewBox="0 0 128 128">
                <defs><linearGradient id="wlg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#c07050"/><stop offset="100%" stopColor="#8a4830"/></linearGradient></defs>
                <rect width="128" height="128" rx="28" fill="url(#wlg)"/>
                <path d="M40 90 Q30 70 35 55 Q38 45 42 40 L46 32 Q44 28 48 30 Q52 32 50 36 L48 40 Q55 35 64 35 Q73 35 80 40 L78 36 Q76 32 80 30 Q84 28 82 32 L86 40 Q90 45 93 55 Q98 70 88 90 Z" fill="#1c1917"/>
                <circle cx="52" cy="56" r="5" fill="#faf0e0"/><circle cx="76" cy="56" r="5" fill="#faf0e0"/>
                <circle cx="53" cy="55.5" r="2.5" fill="#1c1917"/><circle cx="77" cy="55.5" r="2.5" fill="#1c1917"/>
                <ellipse cx="64" cy="65" rx="4" ry="3" fill="#faf0e0"/>
                <text x="52" y="84" fontFamily="monospace" fontSize="18" fontWeight="bold" fill="#faf0e0">›_</text>
              </svg>
            </div>
            <h1 className="welcome-title">Ferret</h1>
            <p className="welcome-subtitle">Connect to a database to get started</p>
            <div className="welcome-shortcuts">
              <div className="shortcut"><kbd>⌘</kbd><kbd>N</kbd><span>New Connection</span></div>
              <div className="shortcut"><kbd>⌘</kbd><kbd>T</kbd><span>New Tab</span></div>
              <div className="shortcut"><kbd>⌘</kbd><kbd>B</kbd><span>Toggle Sidebar</span></div>
            </div>
          </div>
        )}
        <StatusBar
          connection={activeConnection}
          status={activeStatus}
          queryResult={activeTab?.result ?? null}
          tunnelState={
            !activeConnection?.tunnel ? 'none' :
            activeConnectionId && tunnelDead.has(activeConnectionId) ? 'disconnected' :
            activeStatus?.connected ? 'active' : 'none'
          }
          onReconnect={activeConnectionId ? () => reconnectTunnel(activeConnectionId) : undefined}
        />
      </main>

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
