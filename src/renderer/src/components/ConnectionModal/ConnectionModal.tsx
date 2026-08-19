import { useState, useEffect } from 'react'
import type { ConnectionConfig, PostgresConnectionConfig } from '../../../../shared/types'
import './ConnectionModal.css'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSave: (config: ConnectionConfig) => void
  onTest: (config: ConnectionConfig) => Promise<{ ok: boolean; error?: string }>
  editingConnection?: ConnectionConfig
}

const defaultForm: Omit<PostgresConnectionConfig, 'id'> = {
  driverType: 'postgresql',
  name: '',
  host: 'localhost',
  port: 5432,
  database: 'postgres',
  username: 'postgres',
  password: '',
  sslMode: 'disable'
}

function parseConnectionString(str: string): Partial<PostgresConnectionConfig> | null {
  try {
    const url = new URL(str)
    if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') return null
    return {
      host: url.hostname || 'localhost',
      port: url.port ? parseInt(url.port, 10) : 5432,
      database: url.pathname.replace(/^\//, '') || 'postgres',
      username: url.username || 'postgres',
      password: decodeURIComponent(url.password || ''),
      sslMode: (url.searchParams.get('sslmode') as PostgresConnectionConfig['sslMode']) || 'disable'
    }
  } catch {
    return null
  }
}

export function ConnectionModal({ isOpen, onClose, onSave, onTest, editingConnection }: Props) {
  const [form, setForm] = useState(defaultForm)
  const [connString, setConnString] = useState('')
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string; version?: string } | null>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (editingConnection) {
        setForm({ ...editingConnection })
      } else {
        setForm({ ...defaultForm })
      }
      setConnString('')
      setTestResult(null)
    }
  }, [isOpen, editingConnection])

  const handleConnStringChange = (value: string) => {
    setConnString(value)
    const parsed = parseConnectionString(value.trim())
    if (parsed) {
      setForm((prev) => ({
        ...prev,
        ...parsed,
        name: prev.name || parsed.database || ''
      }))
    }
  }

  const updateField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setTestResult(null)
  }

  const buildConfig = (): ConnectionConfig => ({
    ...form,
    id: editingConnection?.id || crypto.randomUUID(),
    name: form.name || `${form.host}:${form.port}/${form.database}`
  })

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const config = buildConfig()
      const result = await onTest(config)
      setTestResult(result)
    } catch (err) {
      setTestResult({ ok: false, error: String(err) })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = () => {
    onSave(buildConfig())
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{editingConnection ? 'Edit Connection' : 'New Connection'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Connection string paste */}
          <div className="form-group">
            <label>Connection String</label>
            <input
              type="text"
              className="form-input"
              placeholder="postgresql://user:pass@host:5432/dbname"
              value={connString}
              onChange={(e) => handleConnStringChange(e.target.value)}
            />
            <span className="form-hint">Paste a URL to auto-fill fields below</span>
          </div>

          <div className="form-divider" />

          {/* Form fields */}
          <div className="form-row">
            <div className="form-group form-grow">
              <label>Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="my-database"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group form-grow">
              <label>Host</label>
              <input
                type="text"
                className="form-input"
                value={form.host}
                onChange={(e) => updateField('host', e.target.value)}
              />
            </div>
            <div className="form-group form-port">
              <label>Port</label>
              <input
                type="number"
                className="form-input"
                value={form.port}
                onChange={(e) => updateField('port', parseInt(e.target.value, 10) || 5432)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group form-grow">
              <label>Database</label>
              <input
                type="text"
                className="form-input"
                value={form.database}
                onChange={(e) => updateField('database', e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group form-grow">
              <label>Username</label>
              <input
                type="text"
                className="form-input"
                value={form.username}
                onChange={(e) => updateField('username', e.target.value)}
              />
            </div>
            <div className="form-group form-grow">
              <label>Password</label>
              <input
                type="password"
                className="form-input"
                value={form.password ?? ''}
                onChange={(e) => updateField('password', e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group form-grow">
              <label>SSL Mode</label>
              <select
                className="form-input"
                value={form.sslMode}
                onChange={(e) => updateField('sslMode', e.target.value as PostgresConnectionConfig['sslMode'])}
              >
                <option value="disable">Disable</option>
                <option value="prefer">Prefer</option>
                <option value="require">Require</option>
                <option value="verify-ca">Verify CA</option>
                <option value="verify-full">Verify Full</option>
              </select>
            </div>
          </div>

          {/* Test result */}
          {testResult && (
            <div className={`test-result ${testResult.ok ? 'test-ok' : 'test-fail'}`}>
              {testResult.ok ? '✓ Connection successful' : `✕ ${testResult.error}`}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={handleTest} disabled={testing}>
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
          <div className="modal-footer-right">
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}
