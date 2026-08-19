import type { QueryResult } from '../../../../shared/types'

interface Props {
  queryResult: QueryResult | null
  isExecuting: boolean
}

function bytesToHex(bytes: ArrayLike<number>): string {
  const parts: string[] = []
  const len = Math.min(bytes.length, 16) // show first 16 bytes
  for (let i = 0; i < len; i++) {
    parts.push(bytes[i].toString(16).padStart(2, '0'))
  }
  const hex = parts.join('')
  return bytes.length > 16 ? `\\x${hex}…` : `\\x${hex}`
}

function formatBytea(value: unknown): string {
  if (value == null) return 'NULL'

  // Uint8Array or Buffer (structured clone via IPC)
  if (value instanceof Uint8Array) {
    return bytesToHex(value)
  }

  // { type: 'Buffer', data: [...] } (JSON serialized Buffer)
  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>
    if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
      return bytesToHex(obj.data as number[])
    }
  }

  // Plain number array (contextBridge serialization)
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'number') {
    return bytesToHex(value)
  }

  // Already a hex string from pg (e.g. \x0ab7ec...)
  const str = String(value)
  if (str.startsWith('\\x')) return str.length > 36 ? str.slice(0, 36) + '…' : str

  return str
}

function looksLikeBytea(value: unknown): boolean {
  if (value instanceof Uint8Array) return true
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>
    if (obj.type === 'Buffer' && Array.isArray(obj.data)) return true
  }
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'number' && value[0] >= 0 && value[0] <= 255) return true
  return false
}

function formatCell(value: unknown, category: string): { text: string; className: string } {
  if (value === null || value === undefined) {
    return { text: 'NULL', className: 'cell-null' }
  }
  if (typeof value === 'boolean') {
    return { text: String(value), className: 'cell-bool' }
  }
  // Catch binary both by category and by data shape (fallback if category missing)
  if (category === 'binary' || looksLikeBytea(value)) {
    return { text: formatBytea(value), className: 'cell-binary' }
  }
  if (category === 'number') {
    return { text: String(value), className: 'cell-number' }
  }
  if (category === 'json') {
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
    return { text, className: 'cell-json' }
  }
  return { text: String(value), className: '' }
}

export function ResultTable({ queryResult, isExecuting }: Props) {
  if (isExecuting) {
    return (
      <div className="result-empty">
        <span className="result-spinner">⟳</span> Executing query…
      </div>
    )
  }

  if (!queryResult) {
    return (
      <div className="result-empty">
        Execute a query to see results
      </div>
    )
  }

  if (queryResult.error) {
    return (
      <div className="result-error">
        <div className="result-error-title">Query Error</div>
        <pre className="result-error-msg">{queryResult.error}</pre>
      </div>
    )
  }

  if (queryResult.columns.length === 0) {
    return (
      <div className="result-empty">
        Query executed successfully — {queryResult.rowCount} row(s) affected
      </div>
    )
  }

  return (
    <div className="result-table-wrap">
      <table className="result-table">
        <thead>
          <tr>
            <th className="row-num">#</th>
            {queryResult.columns.map((col) => (
              <th key={col.name}>
                {col.name}
                <span className="col-type">{col.dataType}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {queryResult.rows.map((row, rowIdx) => (
            <tr key={rowIdx}>
              <td className="row-num">{rowIdx + 1}</td>
              {queryResult.columns.map((col) => {
                const { text, className } = formatCell(row[col.name], col.category)
                return (
                  <td key={col.name} className={className}>
                    {text}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
