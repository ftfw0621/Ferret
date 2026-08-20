import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConnectionModal } from './ConnectionModal'
import type { ConnectionConfig } from '../../lib/tauri'

// Mock the ferret module
vi.mock('../../lib/tauri', () => ({
  ferret: {
    parseConnectionUrl: vi.fn(),
  },
}))

import { ferret } from '../../lib/tauri'

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSave: vi.fn(),
  onTest: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ConnectionModal', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <ConnectionModal {...defaultProps} isOpen={false} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders form fields when isOpen is true', () => {
    render(<ConnectionModal {...defaultProps} />)
    expect(screen.getByText('New Connection')).toBeInTheDocument()
    expect(screen.getByText('Host')).toBeInTheDocument()
    expect(screen.getByText('Port')).toBeInTheDocument()
    expect(screen.getByText('Database')).toBeInTheDocument()
    expect(screen.getByText('Username')).toBeInTheDocument()
    expect(screen.getByText('Password')).toBeInTheDocument()
    expect(screen.getByText('SSL Mode')).toBeInTheDocument()
  })

  it('fills default values', () => {
    render(<ConnectionModal {...defaultProps} />)
    expect(screen.getByDisplayValue('localhost')).toBeInTheDocument()
    expect(screen.getByDisplayValue('5432')).toBeInTheDocument()
    // 'postgres' appears in both Database and Username
    const postgresInputs = screen.getAllByDisplayValue('postgres')
    expect(postgresInputs.length).toBe(2)
  })

  it('shows Edit Connection title when editing', () => {
    const editing: ConnectionConfig = {
      id: 'e1',
      name: 'Prod',
      driverType: 'postgresql',
      host: 'db.example.com',
      port: 5433,
      database: 'prod',
      username: 'admin',
      password: 'secret',
      sslMode: 'require',
    }
    render(<ConnectionModal {...defaultProps} editingConnection={editing} />)
    expect(screen.getByText('Edit Connection')).toBeInTheDocument()
    expect(screen.getByDisplayValue('db.example.com')).toBeInTheDocument()
    expect(screen.getByDisplayValue('5433')).toBeInTheDocument()
    expect(screen.getByDisplayValue('prod')).toBeInTheDocument()
  })

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn()
    render(<ConnectionModal {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when overlay is clicked', () => {
    const onClose = vi.fn()
    render(<ConnectionModal {...defaultProps} onClose={onClose} />)
    fireEvent.click(document.querySelector('.modal-overlay')!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose when modal card is clicked', () => {
    const onClose = vi.fn()
    render(<ConnectionModal {...defaultProps} onClose={onClose} />)
    fireEvent.click(document.querySelector('.modal-card')!)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onSave with correct config when Save is clicked', () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    render(<ConnectionModal {...defaultProps} onSave={onSave} onClose={onClose} />)

    // Change host and name
    fireEvent.change(screen.getByDisplayValue('localhost'), { target: { value: 'myhost' } })
    // Name input — find by placeholder
    const nameInput = screen.getByPlaceholderText('My Database')
    fireEvent.change(nameInput, { target: { value: 'My DB' } })
    fireEvent.click(screen.getByText('Save'))

    expect(onSave).toHaveBeenCalledTimes(1)
    const config = onSave.mock.calls[0][0] as ConnectionConfig
    expect(config.host).toBe('myhost')
    expect(config.name).toBe('My DB')
    expect(config.port).toBe(5432)
    expect(config.driverType).toBe('postgresql')
    expect(config.id).toBeTruthy() // UUID generated
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('parses connection string and fills fields', async () => {
    const mockParsed: ConnectionConfig = {
      id: 'parsed',
      name: '',
      driverType: 'postgresql',
      host: 'db.prod.com',
      port: 5433,
      database: 'orders',
      username: 'admin',
      password: 'secret',
      sslMode: 'require',
    }
    vi.mocked(ferret.parseConnectionUrl).mockResolvedValue(mockParsed)

    render(<ConnectionModal {...defaultProps} />)
    const connInput = screen.getByPlaceholderText(/Paste connection string/)
    fireEvent.change(connInput, {
      target: { value: 'postgresql://admin:secret@db.prod.com:5433/orders?sslmode=require' },
    })

    await waitFor(() => {
      expect(screen.getByDisplayValue('db.prod.com')).toBeInTheDocument()
    })
    expect(screen.getByDisplayValue('5433')).toBeInTheDocument()
    // 'orders' may appear in both Name and Database fields
    expect(screen.getAllByDisplayValue('orders').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByDisplayValue('admin')).toBeInTheDocument()
  })

  it('shows test connection success', async () => {
    const onTest = vi.fn().mockResolvedValue('PostgreSQL 16.2')
    render(<ConnectionModal {...defaultProps} onTest={onTest} />)
    fireEvent.click(screen.getByText('Test Connection'))

    await waitFor(() => {
      expect(screen.getByText(/Connected/)).toBeInTheDocument()
    })
    expect(screen.getByText(/PostgreSQL 16\.2/)).toBeInTheDocument()
  })

  it('shows test connection failure', async () => {
    const onTest = vi.fn().mockRejectedValue(new Error('Connection refused'))
    render(<ConnectionModal {...defaultProps} onTest={onTest} />)
    fireEvent.click(screen.getByText('Test Connection'))

    await waitFor(() => {
      expect(screen.getByText(/Connection refused/)).toBeInTheDocument()
    })
  })

  it('shows close button (✕)', () => {
    render(<ConnectionModal {...defaultProps} />)
    expect(screen.getByText('✕')).toBeInTheDocument()
  })

  it('shows Testing… while testing', async () => {
    // Never resolves during this test
    const onTest = vi.fn().mockReturnValue(new Promise(() => {}))
    render(<ConnectionModal {...defaultProps} onTest={onTest} />)
    fireEvent.click(screen.getByText('Test Connection'))

    await waitFor(() => {
      expect(screen.getByText('Testing…')).toBeInTheDocument()
    })
  })
})
