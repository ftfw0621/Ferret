import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { PostgresDriver } from '../drivers/postgres'
import { IPC_CHANNELS } from '../shared/types'
import { loadConnections, saveConnections, deleteConnection } from './connections'
import type { ConnectionConfig } from '../shared/types'

const pgDriver = new PostgresDriver()

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 12 },
    backgroundColor: '#f5f4ed', // --f-bg-deep (parchment)
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpcHandlers(): void {
  // ── Connection persistence ──
  ipcMain.handle(IPC_CHANNELS.LIST_CONNECTIONS, async () => {
    return loadConnections()
  })

  ipcMain.handle(IPC_CHANNELS.SAVE_CONNECTION, async (_event, config: ConnectionConfig) => {
    const all = loadConnections()
    const idx = all.findIndex((c) => c.id === config.id)
    if (idx >= 0) {
      all[idx] = config
    } else {
      all.push(config)
    }
    saveConnections(all)
    return { ok: true }
  })

  ipcMain.handle(IPC_CHANNELS.DELETE_CONNECTION, async (_event, id: string) => {
    deleteConnection(id)
    return { ok: true }
  })

  ipcMain.handle(IPC_CHANNELS.REORDER_CONNECTIONS, async (_event, ids: string[]) => {
    const all = loadConnections()
    const ordered = ids
      .map((id) => all.find((c) => c.id === id))
      .filter(Boolean) as ConnectionConfig[]
    saveConnections(ordered)
    return { ok: true }
  })

  // ── Database operations ──
  ipcMain.handle(IPC_CHANNELS.CONNECT, async (_event, config: ConnectionConfig) => {
    return pgDriver.connect(config)
  })

  ipcMain.handle(IPC_CHANNELS.DISCONNECT, async (_event, connectionId: string) => {
    return pgDriver.disconnect(connectionId)
  })

  ipcMain.handle(IPC_CHANNELS.TEST_CONNECTION, async (_event, config: ConnectionConfig) => {
    return pgDriver.testConnection(config)
  })

  ipcMain.handle(
    IPC_CHANNELS.EXECUTE_QUERY,
    async (_event, connectionId: string, sql: string, params?: unknown[]) => {
      return pgDriver.executeQuery(connectionId, sql, params)
    }
  )

  ipcMain.handle(IPC_CHANNELS.CANCEL_QUERY, async (_event, connectionId: string) => {
    return pgDriver.cancelQuery(connectionId)
  })

  ipcMain.handle(IPC_CHANNELS.GET_SCHEMAS, async (_event, connectionId: string) => {
    return pgDriver.getSchemas(connectionId)
  })

  ipcMain.handle(
    IPC_CHANNELS.GET_TABLES,
    async (_event, connectionId: string, schema: string) => {
      return pgDriver.getTables(connectionId, schema)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.GET_COLUMNS,
    async (_event, connectionId: string, schema: string, table: string) => {
      return pgDriver.getColumns(connectionId, schema, table)
    }
  )
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.ftfw.ferret')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
