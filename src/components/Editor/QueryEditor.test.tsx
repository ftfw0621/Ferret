import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { QueryEditor } from './QueryEditor'

describe('QueryEditor', () => {
  it('renders textarea with placeholder', () => {
    render(<QueryEditor value="" onChange={vi.fn()} onExecute={vi.fn()} />)
    const textarea = screen.getByPlaceholderText(/Write your SQL/)
    expect(textarea).toBeInTheDocument()
  })

  it('calls onChange when typing', () => {
    const onChange = vi.fn()
    render(<QueryEditor value="" onChange={onChange} onExecute={vi.fn()} />)
    const textarea = screen.getByPlaceholderText(/Write your SQL/)
    fireEvent.change(textarea, { target: { value: 'SELECT 1' } })
    expect(onChange).toHaveBeenCalledWith('SELECT 1')
  })

  it('calls onExecute on Cmd+Enter', () => {
    const onExecute = vi.fn()
    render(<QueryEditor value="SELECT 1" onChange={vi.fn()} onExecute={onExecute} />)
    const textarea = screen.getByPlaceholderText(/Write your SQL/)
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true })
    expect(onExecute).toHaveBeenCalledTimes(1)
  })

  it('calls onExecute on Ctrl+Enter', () => {
    const onExecute = vi.fn()
    render(<QueryEditor value="SELECT 1" onChange={vi.fn()} onExecute={onExecute} />)
    const textarea = screen.getByPlaceholderText(/Write your SQL/)
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true })
    expect(onExecute).toHaveBeenCalledTimes(1)
  })

  it('shows Execute button', () => {
    render(<QueryEditor value="SELECT 1" onChange={vi.fn()} onExecute={vi.fn()} />)
    expect(screen.getByText('Execute')).toBeInTheDocument()
  })

  it('disables Execute button when value is empty', () => {
    render(<QueryEditor value="" onChange={vi.fn()} onExecute={vi.fn()} />)
    const btn = screen.getByTitle('Execute Query (⌘+Enter)')
    expect(btn).toBeDisabled()
  })

  it('disables Execute button when executing', () => {
    render(
      <QueryEditor value="SELECT 1" onChange={vi.fn()} onExecute={vi.fn()} isExecuting={true} />,
    )
    const btn = screen.getByTitle('Execute Query (⌘+Enter)')
    expect(btn).toBeDisabled()
    expect(screen.getByText('Running…')).toBeInTheDocument()
  })

  it('enables Execute button when value present and not executing', () => {
    render(<QueryEditor value="SELECT 1" onChange={vi.fn()} onExecute={vi.fn()} />)
    const btn = screen.getByTitle('Execute Query (⌘+Enter)')
    expect(btn).not.toBeDisabled()
  })

  it('renders line numbers matching content lines', () => {
    render(<QueryEditor value={"line1\nline2\nline3"} onChange={vi.fn()} onExecute={vi.fn()} />)
    const gutterLines = document.querySelectorAll('.gutter-line')
    expect(gutterLines).toHaveLength(3)
    expect(gutterLines[0].textContent).toBe('1')
    expect(gutterLines[1].textContent).toBe('2')
    expect(gutterLines[2].textContent).toBe('3')
  })

  it('renders at least 1 line number for empty input', () => {
    render(<QueryEditor value="" onChange={vi.fn()} onExecute={vi.fn()} />)
    const gutterLines = document.querySelectorAll('.gutter-line')
    expect(gutterLines).toHaveLength(1)
  })

  it('shows keyboard shortcut hint', () => {
    render(<QueryEditor value="" onChange={vi.fn()} onExecute={vi.fn()} />)
    expect(screen.getByText('⌘+Enter')).toBeInTheDocument()
  })

  it('calls onExecute when Execute button is clicked', () => {
    const onExecute = vi.fn()
    render(<QueryEditor value="SELECT 1" onChange={vi.fn()} onExecute={onExecute} />)
    fireEvent.click(screen.getByText('Execute'))
    expect(onExecute).toHaveBeenCalledTimes(1)
  })
})
