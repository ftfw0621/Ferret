import { useState, useEffect, useCallback } from 'react'
import { ferret } from '../lib/tauri'
import type { ConnectionConfig, ConnectionStatus, SchemaInfo, TableInfo, ColumnDetail } from '../lib/tauri'

export function useConnections() {
  const [connections, setConnections] = useState<ConnectionConfig[]>([])
  const [statusMap, setStatusMap] = useState<Record<string, ConnectionStatus>>({})
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null)
  const [schemasMap, setSchemasMap] = useState<Record<string, SchemaInfo[]>>({})
  const [tablesMap, setTablesMap] = useState<Record<string, TableInfo[]>>({})
  const [columnsMap, setColumnsMap] = useState<Record<string, ColumnDetail[]>>({})
  const [tunnelDead, setTunnelDead] = useState<Set<string>>(new Set())
  const [connectingIds, setConnectingIds] = useState<Set<string>>(new Set())

  // Load saved connections on mount
  useEffect(() => {
    ferret.listConnections().then(setConnections).catch(console.error)
  }, [])

  // Listen for tunnel-disconnected events from the backend
  useEffect(() => {
    const unlisten = ferret.onTunnelStatus((event) => {
      if (event.status === 'disconnected') {
        console.warn('Tunnel disconnected:', event.connectionId, event.message)
        setTunnelDead(prev => new Set(prev).add(event.connectionId))
      }
    })
    return () => { unlisten.then(fn => fn()) }
  }, [])

  const activeConnection = connections.find(c => c.id === activeConnectionId) ?? null
  const activeStatus = activeConnectionId ? statusMap[activeConnectionId] ?? null : null

  const saveConnection = useCallback(async (config: ConnectionConfig) => {
    try {
      await ferret.saveConnection(config)
      setConnections(prev => {
        const idx = prev.findIndex(c => c.id === config.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = config
          return next
        }
        return [...prev, config]
      })
    } catch (e) {
      console.error('Save connection error:', e)
      alert(`Failed to save connection: ${e}`)
    }
  }, [])

  const removeConnection = useCallback(async (id: string) => {
    await ferret.deleteConnection(id)
    await ferret.disconnect(id).catch(() => {})
    setConnections(prev => prev.filter(c => c.id !== id))
    setStatusMap(prev => { const next = { ...prev }; delete next[id]; return next })
    if (activeConnectionId === id) setActiveConnectionId(null)
  }, [activeConnectionId])

  const connectTo = useCallback(async (id: string) => {
    const config = connections.find(c => c.id === id)
    if (!config) {
      console.error('connectTo: connection not found:', id)
      return
    }
    // Show connecting state immediately
    setConnectingIds(prev => new Set(prev).add(id))
    try {
      console.log('Connecting to:', config.name, config.host, config.port)
      const status = await ferret.connect(config)
      console.log('Connect result:', status)
      setStatusMap(prev => ({ ...prev, [id]: status }))
      if (status.connected) {
        // Clear any previous tunnel-dead state
        setTunnelDead(prev => { const next = new Set(prev); next.delete(id); return next })
        setActiveConnectionId(id)
        // Fetch schemas
        try {
          const schemas = await ferret.getSchemas(id)
          setSchemasMap(prev => ({ ...prev, [id]: schemas }))
          // Fetch all tables in parallel
          const tableResults = await Promise.all(
            schemas.map(schema =>
              ferret.getTables(id, schema.name)
                .then(tables => ({ key: `${id}:${schema.name}`, tables }))
                .catch(() => ({ key: `${id}:${schema.name}`, tables: [] as TableInfo[] }))
            )
          )
          setTablesMap(prev => {
            const next = { ...prev }
            for (const { key, tables } of tableResults) {
              next[key] = tables
            }
            return next
          })
        } catch (e) {
          console.error('Schema fetch error:', e)
        }
      } else {
        console.error('Connection failed:', status.error)
        alert(`Connection failed: ${status.error || 'Unknown error'}`)
      }
    } catch (e) {
      console.error('Connect invoke error:', e)
      setStatusMap(prev => ({
        ...prev,
        [id]: { id, connected: false, error: String(e) }
      }))
    } finally {
      setConnectingIds(prev => { const next = new Set(prev); next.delete(id); return next })
    }
  }, [connections])

  const disconnectFrom = useCallback(async (id: string) => {
    await ferret.disconnect(id)
    setStatusMap(prev => ({
      ...prev,
      [id]: { id, connected: false },
    }))
    if (activeConnectionId === id) setActiveConnectionId(null)
  }, [activeConnectionId])

  const testConnection = useCallback(async (config: ConnectionConfig) => {
    return ferret.testConnection(config)
  }, [])

  const fetchColumns = useCallback(async (connectionId: string, schema: string, table: string) => {
    const key = `${connectionId}:${schema}:${table}`
    try {
      const cols = await ferret.getColumns(connectionId, schema, table)
      setColumnsMap(prev => ({ ...prev, [key]: cols }))
    } catch (e) {
      console.error('Column fetch error:', e)
    }
  }, [])

  const reconnectTunnel = useCallback(async (id: string) => {
    await disconnectFrom(id)
    await connectTo(id)
  }, [disconnectFrom, connectTo])

  return {
    connections,
    statusMap,
    activeConnectionId,
    activeConnection,
    activeStatus,
    schemasMap,
    tablesMap,
    columnsMap,
    tunnelDead,
    connectingIds,
    saveConnection,
    removeConnection,
    connectTo,
    disconnectFrom,
    testConnection,
    fetchColumns,
    reconnectTunnel,
    setActiveConnectionId,
  }
}
