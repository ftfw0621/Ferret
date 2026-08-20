import { useState, useEffect, useCallback } from 'react'
import './ConnectionModal.css'
import { ferret } from '../../lib/tauri'
import type { ConnectionConfig } from '../../lib/tauri'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSave: (config: ConnectionConfig) => void
  onTest: (config: ConnectionConfig) => Promise<string>
  editingConnection?: ConnectionConfig
}

const emptyForm = {
  name: '',
  host: 'localhost',
  port: '5432',
  database: 'postgres',
  username: 'postgres',
  password: '',
  sslMode: 'disable',
}

export function ConnectionModal({ isOpen, onClose, onSave, onTest, editingConnection }: Props) {
  const [form, setForm] = useState(emptyForm)
  const [connString, setConnString] = useState('')
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (editingConnection) {
        setForm({
          name: editingConnection.name,
          host: editingConnection.host,
          port: String(editingConnection.port),
          database: editingConnection.database,
          username: editingConnection.username,
          password: editingConnection.password ?? '',
          sslMode: editingConnection.sslMode,
        })
      } else {
        setForm(emptyForm)
      }
      setConnString('')
      setTestResult(null)
    }
  }, [isOpen, editingConnection])

  const handleConnStringPaste = useCallback(async (value: string) => {
    setConnString(value)
    if (value.startsWith('postgresql://') || value.startsWith('postgres://')) {
      try {
        const parsed = await ferret.parseConnectionUrl(value)
        setForm({
          name: form.name || parsed.database,
          host: parsed.host,
          port: String(parsed.port),
          database: parsed.database,
          username: parsed.username,
          password: parsed.password ?? '',
          sslMode: parsed.sslMode,
        })
      } catch {
        // Invalid URL, ignore
      }
    }
  }, [form.name])

  const buildConfig = (): ConnectionConfig => ({
    id: editingConnection?.id ?? crypto.randomUUID(),
    name: form.name || form.database,
    driverType: 'postgresql',
    host: form.host,
    port: parseInt(form.port) || 5432,
    database: form.database,
    username: form.username,
    password: form.password || undefined,
    sslMode: form.sslMode,
  })

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const version = await onTest(buildConfig())
      setTestResult({ ok: true, message: `✓ Connected — ${version}` })
    } catch (e) {
      setTestResult({ ok: false, message: `✕ ${e}` })
    }
    setTesting(false)
  }

  const handleSave = () => {
    onSave(buildConfig())
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{editingConnection ? 'Edit Connection' : 'New Connection'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <input
            className="conn-string-input"
            placeholder="Paste connection string: postgresql://user:pass@host:5432/db"
            value={connString}
            onChange={e => handleConnStringPaste(e.target.value)}
          />
          <div className="input-group">
            <label className="input-label">Name</label>
            <input className="input-field" value={form.name} placeholder="My Database"
              onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="input-row">
            <div className="input-group">
              <label className="input-label">Host</label>
              <input className="input-field" value={form.host}
                onChange={e => setForm({ ...form, host: e.target.value })} />
            </div>
            <div className="input-group">
              <label className="input-label">Port</label>
              <input className="input-field" value={form.port}
                onChange={e => setForm({ ...form, port: e.target.value })} />
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Database</label>
            <input className="input-field" value={form.database}
              onChange={e => setForm({ ...form, database: e.target.value })} />
          </div>
          <div className="input-row">
            <div className="input-group">
              <label className="input-label">Username</label>
              <input className="input-field" value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })} />
            </div>
            <div className="input-group">
              <label className="input-label">Password</label>
              <input className="input-field" type="password" value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })} />
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">SSL Mode</label>
            <select className="input-field" value={form.sslMode}
              onChange={e => setForm({ ...form, sslMode: e.target.value })}>
              <option value="disable">Disable</option>
              <option value="prefer">Prefer</option>
              <option value="require">Require</option>
              <option value="verify-ca">Verify CA</option>
              <option value="verify-full">Verify Full</option>
            </select>
          </div>
          {testResult && (
            <div className={`test-result ${testResult.ok ? 'success' : 'error'}`}>
              {testResult.message}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={handleTest} disabled={testing}>
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}
