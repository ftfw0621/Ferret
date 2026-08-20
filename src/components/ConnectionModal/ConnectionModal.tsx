import { useState, useEffect, useCallback } from 'react'
import './ConnectionModal.css'
import { ferret } from '../../lib/tauri'
import type { ConnectionConfig, TunnelConfig } from '../../lib/tauri'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSave: (config: ConnectionConfig) => Promise<void> | void
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

const emptyTunnelForm = {
  kubeContext: '',
  kubeNamespace: '',
  kubeResource: '',
  localPort: '15432',
  remotePort: '5432',
  customCommand: '',
}

export function ConnectionModal({ isOpen, onClose, onSave, onTest, editingConnection }: Props) {
  const [form, setForm] = useState(emptyForm)
  const [connString, setConnString] = useState('')
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [tunnelType, setTunnelType] = useState<'' | 'kubectl' | 'custom'>('')
  const [tunnelForm, setTunnelForm] = useState(emptyTunnelForm)

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
        if (editingConnection.tunnel) {
          setTunnelType(editingConnection.tunnel.type)
          setTunnelForm({
            kubeContext: editingConnection.tunnel.kubeContext ?? '',
            kubeNamespace: editingConnection.tunnel.kubeNamespace ?? '',
            kubeResource: editingConnection.tunnel.kubeResource ?? '',
            localPort: String(editingConnection.tunnel.localPort),
            remotePort: String(editingConnection.tunnel.remotePort),
            customCommand: editingConnection.tunnel.customCommand ?? '',
          })
        } else {
          setTunnelType('')
          setTunnelForm(emptyTunnelForm)
        }
      } else {
        setForm(emptyForm)
        setTunnelType('')
        setTunnelForm(emptyTunnelForm)
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
    tunnel: tunnelType ? {
      type: tunnelType,
      kubeContext: tunnelForm.kubeContext || undefined,
      kubeNamespace: tunnelForm.kubeNamespace || undefined,
      kubeResource: tunnelForm.kubeResource || undefined,
      localPort: parseInt(tunnelForm.localPort) || 15432,
      remotePort: parseInt(tunnelForm.remotePort) || 5432,
      customCommand: tunnelForm.customCommand || undefined,
    } as TunnelConfig : undefined,
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

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      await onSave(buildConfig())
      onClose()
    } catch (e) {
      console.error('Save failed:', e)
      setSaveError(String(e))
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div className="modal-card">
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
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <div className="input-group">
            <label className="input-label">Name</label>
            <input className="input-field" value={form.name} placeholder="My Database"
              onChange={e => setForm({ ...form, name: e.target.value })}
              autoCapitalize="off" autoCorrect="off" spellCheck={false} />
          </div>
          <div className="input-row">
            <div className="input-group">
              <label className="input-label">Host</label>
              <input className="input-field" value={form.host}
                onChange={e => setForm({ ...form, host: e.target.value })}
                autoCapitalize="off" autoCorrect="off" spellCheck={false} />
            </div>
            <div className="input-group">
              <label className="input-label">Port</label>
              <input className="input-field" value={form.port}
                onChange={e => setForm({ ...form, port: e.target.value })}
                autoCapitalize="off" />
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Database</label>
            <input className="input-field" value={form.database}
              onChange={e => setForm({ ...form, database: e.target.value })}
              autoCapitalize="off" autoCorrect="off" spellCheck={false} />
          </div>
          <div className="input-row">
            <div className="input-group">
              <label className="input-label">Username</label>
              <input className="input-field" value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                autoCapitalize="off" autoCorrect="off" spellCheck={false} />
            </div>
            <div className="input-group">
              <label className="input-label">Password</label>
              <input className="input-field" type="password" value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                autoCapitalize="off" autoCorrect="off" />
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
          {/* Tunnel */}
          <div className="tunnel-section">
            <div className="input-group">
              <label className="input-label">Tunnel</label>
              <select className="input-field" value={tunnelType}
                onChange={e => setTunnelType(e.target.value as '' | 'kubectl' | 'custom')}>
                <option value="">None</option>
                <option value="kubectl">kubectl port-forward</option>
                <option value="custom">Custom Command</option>
              </select>
            </div>
            {tunnelType === 'kubectl' && (
              <>
                <div className="input-row">
                  <div className="input-group">
                    <label className="input-label">Context</label>
                    <input className="input-field" value={tunnelForm.kubeContext}
                      placeholder="current"
                      onChange={e => setTunnelForm({ ...tunnelForm, kubeContext: e.target.value })}
                      autoCapitalize="off" autoCorrect="off" spellCheck={false} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Namespace</label>
                    <input className="input-field" value={tunnelForm.kubeNamespace}
                      placeholder="default"
                      onChange={e => setTunnelForm({ ...tunnelForm, kubeNamespace: e.target.value })}
                      autoCapitalize="off" autoCorrect="off" spellCheck={false} />
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">Resource</label>
                  <input className="input-field" value={tunnelForm.kubeResource}
                    placeholder="pod/my-pod or svc/my-svc"
                    onChange={e => setTunnelForm({ ...tunnelForm, kubeResource: e.target.value })}
                    autoCapitalize="off" autoCorrect="off" spellCheck={false} />
                </div>
                <div className="input-row">
                  <div className="input-group">
                    <label className="input-label">Local Port</label>
                    <input className="input-field" value={tunnelForm.localPort}
                      onChange={e => setTunnelForm({ ...tunnelForm, localPort: e.target.value })}
                      autoCapitalize="off" />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Remote Port</label>
                    <input className="input-field" value={tunnelForm.remotePort}
                      onChange={e => setTunnelForm({ ...tunnelForm, remotePort: e.target.value })}
                      autoCapitalize="off" />
                  </div>
                </div>
              </>
            )}
            {tunnelType === 'custom' && (
              <>
                <div className="input-group">
                  <label className="input-label">Command</label>
                  <input className="input-field" value={tunnelForm.customCommand}
                    placeholder="ssh -L 5432:rds-host:5432 bastion"
                    onChange={e => setTunnelForm({ ...tunnelForm, customCommand: e.target.value })}
                    autoCapitalize="off" autoCorrect="off" spellCheck={false} />
                </div>
                <div className="input-group">
                  <label className="input-label">Local Port</label>
                  <input className="input-field" value={tunnelForm.localPort}
                    onChange={e => setTunnelForm({ ...tunnelForm, localPort: e.target.value })}
                    autoCapitalize="off" />
                </div>
              </>
            )}
            {tunnelType && (
              <div className="tunnel-info">
                ↳ Connects via 127.0.0.1:{tunnelForm.localPort || '…'}
              </div>
            )}
          </div>
          {testResult && (
            <div className={`test-result ${testResult.ok ? 'success' : 'error'}`}>
              {testResult.message}
            </div>
          )}
          {saveError && (
            <div className="test-result error">
              ✕ Save failed: {saveError}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={handleTest} disabled={testing}>
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
