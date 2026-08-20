import './ExplainView.css'
import type { QueryResult } from '../../lib/tauri'

interface PlanNode {
  'Node Type': string
  'Relation Name'?: string
  'Schema'?: string
  'Alias'?: string
  'Index Name'?: string
  'Startup Cost': number
  'Total Cost': number
  'Plan Rows': number
  'Plan Width': number
  'Actual Startup Time'?: number
  'Actual Total Time'?: number
  'Actual Rows'?: number
  'Actual Loops'?: number
  'Plans'?: PlanNode[]
  [key: string]: unknown
}

export interface ExplainData {
  Plan: PlanNode
  'Planning Time'?: number
  'Execution Time'?: number
}

const STRUCTURAL_KEYS = new Set([
  'Node Type', 'Relation Name', 'Schema', 'Alias', 'Index Name',
  'Startup Cost', 'Total Cost', 'Plan Rows', 'Plan Width',
  'Actual Startup Time', 'Actual Total Time', 'Actual Rows', 'Actual Loops',
  'Plans', 'Output', 'Parent Relationship',
  'Parallel Aware', 'Async Capable',
])

export function parseExplainJson(result: QueryResult): ExplainData | null {
  try {
    if (result.rows.length === 0) return null
    const parts = result.rows.map(row => {
      const val = row['QUERY PLAN']
      return typeof val === 'string' ? val : JSON.stringify(val)
    })
    const parsed = JSON.parse(parts.join(''))
    const data = Array.isArray(parsed) ? parsed[0] : parsed
    if (!data?.Plan) return null
    return data
  } catch {
    return null
  }
}

function formatTime(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
  if (ms >= 1) return `${ms.toFixed(2)}ms`
  return `${(ms * 1000).toFixed(0)}µs`
}

function timeColor(pct: number): string {
  const hue = Math.round(120 * (1 - Math.min(pct, 1)))
  return `hsl(${hue}, 55%, 55%)`
}

function getNodeLabel(node: PlanNode): string {
  const parts = [node['Node Type']]
  if (node['Relation Name']) {
    const schema = node['Schema'] && node['Schema'] !== 'public' ? `${node['Schema']}.` : ''
    parts.push(`on ${schema}${node['Relation Name']}`)
  }
  if (node['Index Name']) {
    parts.push(`using ${node['Index Name']}`)
  }
  return parts.join(' ')
}

function getExtraProps(node: PlanNode): [string, string][] {
  const extras: [string, string][] = []
  for (const [key, value] of Object.entries(node)) {
    if (STRUCTURAL_KEYS.has(key)) continue
    if (value === null || value === undefined) continue
    if (typeof value === 'object' && !Array.isArray(value)) continue
    const strVal = Array.isArray(value) ? value.join(', ') : String(value)
    if (strVal === 'true' || strVal === 'false') continue
    extras.push([key, strVal])
  }
  return extras
}

interface NodeProps {
  node: PlanNode
  totalTime: number
  depth: number
}

function PlanNodeView({ node, totalTime, depth }: NodeProps) {
  const time = node['Actual Total Time'] ?? 0
  const loops = node['Actual Loops'] ?? 1
  const nodeTime = time * loops
  const pct = totalTime > 0 ? nodeTime / totalTime : 0
  const actualRows = node['Actual Rows'] ?? 0
  const planRows = node['Plan Rows'] ?? 0
  const extras = getExtraProps(node)
  const children = node['Plans'] ?? []
  const rowMismatch = planRows > 0 ? actualRows / planRows : 1

  return (
    <div className="explain-node" style={{ marginLeft: depth > 0 ? '1.25rem' : 0 }}>
      <div className="explain-card">
        <div className="explain-header">
          <span className="explain-type">{getNodeLabel(node)}</span>
          <span className="explain-time" style={{ color: timeColor(pct) }}>
            {formatTime(nodeTime)}
          </span>
        </div>
        <div className="explain-bar-track">
          <div
            className="explain-bar-fill"
            style={{ width: `${Math.max(pct * 100, 1)}%`, background: timeColor(pct) }}
          />
        </div>
        <div className="explain-metrics">
          <span>
            Rows: {actualRows.toLocaleString()}
            {planRows !== actualRows && (
              <span className={`explain-estimate ${rowMismatch > 10 || rowMismatch < 0.1 ? 'warn' : ''}`}>
                {' '}(est. {planRows.toLocaleString()})
              </span>
            )}
          </span>
          {loops > 1 && <span>× {loops} loops</span>}
          <span className="explain-pct">{(pct * 100).toFixed(1)}%</span>
        </div>
        {extras.length > 0 && (
          <div className="explain-extras">
            {extras.map(([key, val]) => (
              <div key={key} className="explain-extra">
                <span className="explain-extra-key">{key}:</span> {val}
              </div>
            ))}
          </div>
        )}
      </div>
      {children.map((child, i) => (
        <PlanNodeView key={i} node={child} totalTime={totalTime} depth={depth + 1} />
      ))}
    </div>
  )
}

interface Props {
  data: ExplainData
}

export function ExplainView({ data }: Props) {
  const totalTime = data['Execution Time'] ?? (data.Plan['Actual Total Time'] ?? 0) * (data.Plan['Actual Loops'] ?? 1)

  return (
    <div className="explain-view">
      <div className="explain-summary">
        <span className="explain-label">EXPLAIN ANALYZE</span>
        <span className="explain-total">
          Execution: {formatTime(data['Execution Time'] ?? 0)}
        </span>
        {data['Planning Time'] != null && (
          <>
            <span className="explain-sep">·</span>
            <span>Planning: {formatTime(data['Planning Time'])}</span>
          </>
        )}
      </div>
      <div className="explain-tree">
        <PlanNodeView node={data.Plan} totalTime={totalTime} depth={0} />
      </div>
    </div>
  )
}
