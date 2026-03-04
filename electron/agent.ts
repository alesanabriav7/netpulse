import type { Analysis } from '@shared/types'
import { chatCompletion } from './llm'
import { getLatestMetrics, getMetricsRange, insertAnalysis } from './db'
import { getFixStatuses } from './fixer'
import { getConfig } from './config'

const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'get_latest_metrics',
      description: 'Get the most recent network metrics snapshot',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_trend',
      description: 'Get the last N metrics snapshots to identify trends',
      parameters: {
        type: 'object',
        properties: { count: { type: 'number', description: 'Number of recent snapshots (default 5)' } }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_anomalies',
      description: 'Get recent metrics where any score dropped below 70 (degraded)',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_applied_fixes',
      description: 'Get the list of network fixes and whether they are currently applied/detected',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'compare_periods',
      description: 'Compare metrics between two time periods',
      parameters: {
        type: 'object',
        properties: {
          period1_from: { type: 'string' },
          period1_to: { type: 'string' },
          period2_from: { type: 'string' },
          period2_to: { type: 'string' }
        },
        required: ['period1_from', 'period1_to', 'period2_from', 'period2_to']
      }
    }
  }
]

function handleToolCall(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'get_latest_metrics': {
      const m = getLatestMetrics()
      return JSON.stringify(m)
    }
    case 'get_trend': {
      const count = (args.count as number) || 5
      const now = new Date().toISOString()
      const from = new Date(Date.now() - count * 2 * 60 * 60 * 1000).toISOString()
      const metrics = getMetricsRange(from, now)
      return JSON.stringify(metrics.slice(-count))
    }
    case 'get_anomalies': {
      const now = new Date().toISOString()
      const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const all = getMetricsRange(from, now)
      const anomalies = all.filter(
        (m) =>
          (m.score_streaming != null && m.score_streaming < 70) ||
          (m.score_gaming != null && m.score_gaming < 70) ||
          (m.score_videocalls != null && m.score_videocalls < 70)
      )
      return JSON.stringify(anomalies)
    }
    case 'get_applied_fixes': {
      const statuses = getFixStatuses()
      return JSON.stringify(statuses)
    }
    case 'compare_periods': {
      const p1 = getMetricsRange(args.period1_from as string, args.period1_to as string)
      const p2 = getMetricsRange(args.period2_from as string, args.period2_to as string)
      return JSON.stringify({ period1: p1, period2: p2 })
    }
    default:
      return JSON.stringify({ error: 'Unknown tool' })
  }
}

const SYSTEM_PROMPT = `You are a network diagnostics agent for NetPulse. Analyze network metrics and provide concise assessments.

IMPORTANT: When metric values are null/missing, this means the probe failed to collect that data — treat it as "no data available", NOT as a critical failure. Only score based on metrics that have actual values.

Normal reference values:
- Latency: <30ms excellent, 30-80ms good, >100ms poor
- Jitter: <10ms excellent, 10-30ms acceptable, >50ms poor
- Packet loss: <0.5% excellent, 0.5-2% acceptable, >5% critical
- Download: >25 Mbps excellent, 10-25 good, <5 poor
- Upload: >5 Mbps excellent, 2-5 good, <1 poor

Determine the overall status:
- "healthy": All available scores above 80, no significant issues
- "degraded": Any available score between 50-80, or moderate packet loss/jitter
- "critical": Any available score below 50, or severe packet loss (>5%), or extremely high latency (>200ms)

Use get_applied_fixes to check what fixes are already in place before recommending actions.

Provide:
1. A brief summary (1-2 sentences) of the network condition
2. Root cause analysis if degraded/critical
3. Specific recommendation if degraded/critical (don't recommend fixes already applied)

Respond with JSON: {"status": "healthy|degraded|critical", "summary": "...", "root_cause": "...|null", "recommendation": "...|null"}`

export async function runAnalysis(metricId: number): Promise<Analysis | null> {
  const config = getConfig()
  if (!config.llmProvider && !process.env.LLM_API_KEY) return null

  const messages: { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string; tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[] }[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Analyze the current network metrics. The metric ID is ${metricId}. Use the available tools to gather data, then provide your assessment as JSON.` }
  ]

  // Agent loop: up to 5 iterations for tool calls
  for (let i = 0; i < 5; i++) {
    const response = await chatCompletion(messages, tools)
    if (!response || !response.choices?.[0]) return null

    const msg = response.choices[0].message
    messages.push(msg)

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      // Final response — parse JSON
      try {
        const text = msg.content.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
        const parsed = JSON.parse(text) as { status: string; summary: string; root_cause?: string; recommendation?: string }

        const analysis: Omit<Analysis, 'id' | 'timestamp'> = {
          metric_id: metricId,
          status: parsed.status as Analysis['status'],
          summary: parsed.summary,
          root_cause: parsed.root_cause ?? null,
          recommendation: parsed.recommendation ?? null
        }

        insertAnalysis(analysis)
        return {
          timestamp: new Date().toISOString(),
          ...analysis
        } as Analysis
      } catch {
        return null
      }
    }

    // Handle tool calls
    for (const tc of msg.tool_calls) {
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(tc.function.arguments)
      } catch { /* empty args */ }
      const result = handleToolCall(tc.function.name, args)
      messages.push({ role: 'tool', content: result, tool_call_id: tc.id })
    }
  }

  return null
}
