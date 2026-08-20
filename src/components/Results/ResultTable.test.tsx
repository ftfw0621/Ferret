import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ResultTable } from './ResultTable'
import type { QueryResult } from '../../lib/tauri'

function makeResult(overrides: Partial<QueryResult> = {}): QueryResult {
  return {
    columns: [
      { name: 'id', dataType: 'int4', category: 'number' },
      { name: 'name', dataType: 'text', category: 'string' },
    ],
    rows: [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ],
    rowCount: 2,
    durationMs: 14,
    ...overrides,
  }
}

describe('ResultTable', () => {
  it('renders initial empty state', () => {
    render(<ResultTable queryResult={null} isExecuting={false} />)
    expect(screen.getByText('Execute a query to see results')).toBeInTheDocument()
  })

  it('renders executing spinner', () => {
    render(<ResultTable queryResult={null} isExecuting={true} />)
    expect(screen.getByText(/Executing query/)).toBeInTheDocument()
  })

  it('renders query error', () => {
    const result = makeResult({
      columns: [],
      rows: [],
      rowCount: 0,
      error: 'relation "foo" does not exist',
    })
    render(<ResultTable queryResult={result} isExecuting={false} />)
    expect(screen.getByText('Query Error')).toBeInTheDocument()
    expect(screen.getByText(/relation "foo" does not exist/)).toBeInTheDocument()
  })

  it('renders success with 0 columns (e.g. INSERT)', () => {
    const result = makeResult({ columns: [], rows: [], rowCount: 3 })
    render(<ResultTable queryResult={result} isExecuting={false} />)
    expect(screen.getByText(/3 row\(s\) affected/)).toBeInTheDocument()
  })

  it('renders table with columns and rows', () => {
    render(<ResultTable queryResult={makeResult()} isExecuting={false} />)
    // Column headers
    expect(screen.getByText('id')).toBeInTheDocument()
    expect(screen.getByText('name')).toBeInTheDocument()
    // Type annotations
    expect(screen.getByText('int4')).toBeInTheDocument()
    expect(screen.getByText('text')).toBeInTheDocument()
    // Data
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    // Row numbers — '1' also appears as data so check row-num cells directly
    const rowNumCells = document.querySelectorAll('.row-num')
    // First is header #, then 1 and 2
    expect(rowNumCells.length).toBeGreaterThanOrEqual(3)
    expect(rowNumCells[1].textContent).toBe('1')
    expect(rowNumCells[2].textContent).toBe('2')
  })

  it('renders NULL values with cell-null class', () => {
    const result = makeResult({
      rows: [{ id: 1, name: null }],
      rowCount: 1,
    })
    render(<ResultTable queryResult={result} isExecuting={false} />)
    const nullCell = screen.getByText('NULL')
    expect(nullCell).toBeInTheDocument()
    expect(nullCell).toHaveClass('cell-null')
  })

  it('renders number values with cell-number class', () => {
    const result = makeResult({
      columns: [{ name: 'count', dataType: 'int4', category: 'number' }],
      rows: [{ count: 42 }],
      rowCount: 1,
    })
    render(<ResultTable queryResult={result} isExecuting={false} />)
    const numCell = screen.getByText('42')
    expect(numCell).toHaveClass('cell-number')
  })

  it('renders boolean values with cell-bool class', () => {
    const result = makeResult({
      columns: [{ name: 'active', dataType: 'bool', category: 'boolean' }],
      rows: [{ active: true }],
      rowCount: 1,
    })
    render(<ResultTable queryResult={result} isExecuting={false} />)
    const boolCell = screen.getByText('true')
    expect(boolCell).toHaveClass('cell-bool')
  })

  it('renders JSON values with cell-json class', () => {
    const result = makeResult({
      columns: [{ name: 'data', dataType: 'jsonb', category: 'json' }],
      rows: [{ data: { key: 'value' } }],
      rowCount: 1,
    })
    render(<ResultTable queryResult={result} isExecuting={false} />)
    const jsonCell = screen.getByText('{"key":"value"}')
    expect(jsonCell).toHaveClass('cell-json')
  })

  it('renders binary values with cell-binary class', () => {
    const result = makeResult({
      columns: [{ name: 'hash', dataType: 'bytea', category: 'binary' }],
      rows: [{ hash: '\\xdeadbeef' }],
      rowCount: 1,
    })
    render(<ResultTable queryResult={result} isExecuting={false} />)
    const binCell = screen.getByText('\\xdeadbeef')
    expect(binCell).toHaveClass('cell-binary')
  })

  it('renders plain string values with no extra class', () => {
    const result = makeResult({
      columns: [{ name: 'label', dataType: 'text', category: 'string' }],
      rows: [{ label: 'hello' }],
      rowCount: 1,
    })
    render(<ResultTable queryResult={result} isExecuting={false} />)
    const cell = screen.getByText('hello')
    expect(cell.className).toBe('')
  })

  it('renders empty result (0 rows with columns)', () => {
    const result = makeResult({ rows: [], rowCount: 0 })
    render(<ResultTable queryResult={result} isExecuting={false} />)
    // Should still render column headers
    expect(screen.getByText('id')).toBeInTheDocument()
    expect(screen.getByText('name')).toBeInTheDocument()
    // But no data rows — only header row
    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(1) // header row only
  })
})
