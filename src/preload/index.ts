import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC_CHANNELS } from '../shared/types'
import type { ConnectionConfig } from '../shared/types'

const ferretAPI = {
  // Connection persistence
  listConnections: () =>
    ipcRenderer.invoke(IPC_CHANNELS.LIST_CONNECTIONS),

  saveConnection: (config: ConnectionConfig) =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_CONNECTION, config),

  deleteConnection: (id: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_CONNECTION, id),

  reorderConnections: (ids: string[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.REORDER_CONNECTIONS, ids),

  // Database operations
  connect: (config: ConnectionConfig) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONNECT, config),

  disconnect: (connectionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DISCONNECT, connectionId),

  testConnection: (config: ConnectionConfig) =>
    ipcRenderer.invoke(IPC_CHANNELS.TEST_CONNECTION, config),

  // Query
  executeQuery: (connectionId: string, sql: string, params?: unknown[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXECUTE_QUERY, connectionId, sql, params),

  cancelQuery: (connectionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.CANCEL_QUERY, connectionId),

  // Schema
  getSchemas: (connectionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_SCHEMAS, connectionId),

  getTables: (connectionId: string, schema: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_TABLES, connectionId, schema),

  getColumns: (connectionId: string, schema: string, table: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_COLUMNS, connectionId, schema, table)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('ferret', ferretAPI)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error fallback for non-isolated context
  window.electron = electronAPI
  // @ts-expect-error fallback for non-isolated context
  window.ferret = ferretAPI
}
