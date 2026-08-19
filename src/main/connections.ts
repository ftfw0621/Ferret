/**
 * Connection persistence — save/load connections to disk.
 * Passwords are encrypted via Electron safeStorage (macOS Keychain-backed).
 */

import { app, safeStorage } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import type { ConnectionConfig } from '../shared/types'

interface StoredConnection {
  id: string
  name: string
  driverType: string
  host: string
  port: number
  database: string
  username: string
  encryptedPassword?: string // base64 of safeStorage-encrypted bytes
  askPassword?: boolean
  sslMode: string
  color?: string
  order: number
}

const getConfigPath = (): string => {
  const dir = join(app.getPath('userData'), 'config')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return join(dir, 'connections.json')
}

export function loadConnections(): ConnectionConfig[] {
  try {
    const filePath = getConfigPath()
    if (!existsSync(filePath)) return []

    const data = JSON.parse(readFileSync(filePath, 'utf-8')) as StoredConnection[]

    return data
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((stored) => {
        let password: string | undefined
        if (stored.encryptedPassword && safeStorage.isEncryptionAvailable()) {
          try {
            const buf = Buffer.from(stored.encryptedPassword, 'base64')
            password = safeStorage.decryptString(buf)
          } catch {
            // Decryption failed — password will be undefined
          }
        }

        return {
          id: stored.id,
          name: stored.name,
          driverType: stored.driverType as 'postgresql',
          host: stored.host,
          port: stored.port,
          database: stored.database,
          username: stored.username,
          password,
          sslMode: stored.sslMode as ConnectionConfig['sslMode'],
          color: stored.color
        } satisfies ConnectionConfig
      })
  } catch {
    return []
  }
}

export function saveConnections(connections: ConnectionConfig[]): void {
  const stored: StoredConnection[] = connections.map((conn, index) => {
    let encryptedPassword: string | undefined
    if (conn.password && safeStorage.isEncryptionAvailable()) {
      encryptedPassword = safeStorage.encryptString(conn.password).toString('base64')
    }

    return {
      id: conn.id,
      name: conn.name,
      driverType: conn.driverType,
      host: conn.host,
      port: conn.port,
      database: conn.database,
      username: conn.username,
      encryptedPassword,
      sslMode: conn.sslMode,
      color: conn.color,
      order: index
    }
  })

  writeFileSync(getConfigPath(), JSON.stringify(stored, null, 2), 'utf-8')
}

export function deleteConnection(id: string): void {
  const connections = loadConnections()
  saveConnections(connections.filter((c) => c.id !== id))
}
