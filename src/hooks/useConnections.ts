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

  // Load saved connections on mount
  useEffect(() => {
    ferret.listConnections().then(setConnections).catch(console.error)
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
    try {
      console.log('Connecting to:', config.name, config.host, config.port)
      const status = await ferret.connect(config)
      console.log('Connect result:', status)
      setStatusMap(prev => ({ ...prev, [id]: status }))
      if (status.connected) {
        setActiveConnectionId(id)
        // Fetch schemas
        try {
          const schemas = await ferret.getSchemas(id)
          setSchemasMap(prev => ({ ...prev, [id]: schemas }))
          for (const schema of schemas) {
            const tables = await ferret.getTables(id, schema.name)
            setTablesMap(prev => ({ ...prev, [`${id}:${schema.name}`]: tables }))
          }
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
      alert(`Connection error: ${e}`)
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

  return {
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
    setActiveConnectionId,
  }
}
