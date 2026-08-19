import { useState, useEffect, useCallback } from 'react'
import type { ConnectionConfig, ConnectionStatus, SchemaInfo, TableInfo, ColumnDetail } from '../../../shared/types'

export interface ConnectionState {
  connections: ConnectionConfig[]
  statusMap: Record<string, ConnectionStatus>
  activeConnectionId: string | null
  schemasMap: Record<string, SchemaInfo[]>
  tablesMap: Record<string, TableInfo[]>
  columnsMap: Record<string, ColumnDetail[]>
}

export function useConnections() {
  const [connections, setConnections] = useState<ConnectionConfig[]>([])
  const [statusMap, setStatusMap] = useState<Record<string, ConnectionStatus>>({})
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null)
  const [schemasMap, setSchemasMap] = useState<Record<string, SchemaInfo[]>>({})
  const [tablesMap, setTablesMap] = useState<Record<string, TableInfo[]>>({})
  const [columnsMap, setColumnsMap] = useState<Record<string, ColumnDetail[]>>({})

  // Load saved connections on mount
  useEffect(() => {
    window.ferret.listConnections().then((saved) => {
      setConnections(saved)
    })
  }, [])

  const saveConnection = useCallback(async (config: ConnectionConfig) => {
    await window.ferret.saveConnection(config)
    setConnections((prev) => {
      const idx = prev.findIndex((c) => c.id === config.id)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = config
        return updated
      }
      return [...prev, config]
    })
  }, [])

  const removeConnection = useCallback(async (id: string) => {
    // Disconnect first if connected
    const status = statusMap[id]
    if (status?.connected) {
      await window.ferret.disconnect(id)
    }
    await window.ferret.deleteConnection(id)
    setConnections((prev) => prev.filter((c) => c.id !== id))
    setStatusMap((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    if (activeConnectionId === id) {
      setActiveConnectionId(null)
    }
  }, [statusMap, activeConnectionId])

  const connectTo = useCallback(async (id: string) => {
    const config = connections.find((c) => c.id === id)
    if (!config) return

    const status = await window.ferret.connect(config)
    setStatusMap((prev) => ({ ...prev, [id]: status }))

    if (status.connected) {
      setActiveConnectionId(id)
      // Fetch schemas
      try {
        const schemas = await window.ferret.getSchemas(id)
        setSchemasMap((prev) => ({ ...prev, [id]: schemas }))
        // Auto-fetch tables for each schema
        for (const schema of schemas) {
          const tables = await window.ferret.getTables(id, schema.name)
          setTablesMap((prev) => ({
            ...prev,
            [`${id}:${schema.name}`]: tables
          }))
        }
      } catch {
        // Schema fetch failed — not fatal
      }
    }
  }, [connections])

  const disconnectFrom = useCallback(async (id: string) => {
    await window.ferret.disconnect(id)
    setStatusMap((prev) => ({
      ...prev,
      [id]: { id, connected: false }
    }))
    if (activeConnectionId === id) {
      setActiveConnectionId(null)
    }
  }, [activeConnectionId])

  const testConnection = useCallback(async (config: ConnectionConfig) => {
    return window.ferret.testConnection(config)
  }, [])

  const fetchColumns = useCallback(async (connectionId: string, schema: string, table: string) => {
    const cols = await window.ferret.getColumns(connectionId, schema, table)
    setColumnsMap((prev) => ({
      ...prev,
      [`${connectionId}:${schema}.${table}`]: cols
    }))
    return cols
  }, [])

  const activeConnection = connections.find((c) => c.id === activeConnectionId) ?? null
  const activeStatus = activeConnectionId ? statusMap[activeConnectionId] ?? null : null

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
    setActiveConnectionId
  }
}
