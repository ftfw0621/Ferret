import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StatusBar } from './StatusBar'
import type { ConnectionConfig, ConnectionStatus, QueryResult } from '../../lib/tauri'

const conn: ConnectionConfig = {
  id: 'c1',
  name: 'production',
  driverType: 'postgresql',
  host: 'localhost',
  port: 5432,
  database: 'mydb',
  username: 'user',
  sslMode: 'disable',
}

const connStatus: ConnectionStatus = {
  id: 'c1',
  connected: true,
  serverVersion: 'PostgreSQL 16.2 on aarch64-apple-darwin',
}

const qr: QueryResult = {
  columns: [{ name: 'id', dataType: 'int4', category: 'number' }],
  rows: [{ id: 1 }],
  rowCount: 42,
  durationMs: 14,
}

describe('StatusBar', () => {
  it('shows "No connection" when no connection', () => {
    render(<StatusBar connection={null} status={null} queryResult={null} />)
    expect(screen.getByText('No connection')).toBeInTheDocument()
  })

  it('shows connection name when connected', () => {
    render(<StatusBar connection={conn} status={connStatus} queryResult={null} />)
    expect(screen.getByText('production')).toBeInTheDocument()
  })

  it('shows server version when connected', () => {
    render(<StatusBar connection={conn} status={connStatus} queryResult={null} />)
    expect(screen.getByText('PostgreSQL 16.2')).toBeInTheDocument()
  })

  it('shows database name when connection has no name', () => {
    const noName = { ...conn, name: '' }
    render(<StatusBar connection={noName} status={connStatus} queryResult={null} />)
    expect(screen.getByText('mydb')).toBeInTheDocument()
  })

  it('shows query result stats', () => {
    render(<StatusBar connection={conn} status={connStatus} queryResult={qr} />)
    expect(screen.getByText('42 rows')).toBeInTheDocument()
    expect(screen.getByText('14ms')).toBeInTheDocument()
  })

  it('does not show query stats when no result', () => {
    render(<StatusBar connection={conn} status={connStatus} queryResult={null} />)
    expect(screen.queryByText(/rows/)).not.toBeInTheDocument()
  })

  it('does not show query stats on error result', () => {
    const errorResult: QueryResult = { ...qr, error: 'fail' }
    render(<StatusBar connection={conn} status={connStatus} queryResult={errorResult} />)
    expect(screen.queryByText('42 rows')).not.toBeInTheDocument()
  })

  it('shows disconnected dot class when status is off', () => {
    const offStatus: ConnectionStatus = { id: 'c1', connected: false }
    const { container } = render(
      <StatusBar connection={conn} status={offStatus} queryResult={null} />,
    )
    const dot = container.querySelector('.status-dot')
    expect(dot).toHaveClass('off')
  })

  it('shows connected dot class when status is on', () => {
    const { container } = render(
      <StatusBar connection={conn} status={connStatus} queryResult={null} />,
    )
    const dot = container.querySelector('.status-dot')
    expect(dot).not.toHaveClass('off')
  })
})
