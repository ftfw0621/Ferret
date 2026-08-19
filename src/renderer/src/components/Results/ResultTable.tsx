import type { QueryResult } from '../../../../shared/types'

interface Props {
  queryResult: QueryResult | null
  isExecuting: boolean
}

function formatBytea(value: unknown): string {
  // pg driver returns Buffer as { type: 'Buffer', data: number[] } after JSON serialization via IPC
  if (value && typeof value === 'object') {
    let bytes: number[] | undefined
    const obj = value as Record<string, unknown>
    if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
      bytes = obj.data as number[]
    } else if (Array.isArray(value)) {
      bytes = value as number[]
    }
    if (bytes) {
      const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('')
      const display = hex.length > 32 ? hex.slice(0, 32) + '…' : hex
      return `\\x${display}`
    }
  }
  return String(value)
}

function formatCell(value: unknown, category: string): { text: string; className: string } {
  if (value === null || value === undefined) {
    return { text: 'NULL', className: 'cell-null' }
  }
  if (typeof value === 'boolean') {
    return { text: String(value), className: 'cell-bool' }
  }
  if (category === 'binary') {
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
