import type { Summary } from '@shared/types'
import { getMetricsRange, getAnalysis, insertSummary, getSummaries } from './db'
import { chatCompletion } from './llm'
import { getConfig } from './config'

export async function generateSummary(): Promise<Summary | null> {
  const now = new Date()
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const metrics = getMetricsRange(dayAgo.toISOString(), now.toISOString())
  if (metrics.length === 0) return null

  // Calculate averages
  let sumStreaming = 0, sumGaming = 0, sumVideocalls = 0, count = 0
  for (const m of metrics) {
    if (m.score_streaming != null) {
      sumStreaming += m.score_streaming
      sumGaming += (m.score_gaming ?? 0)
      sumVideocalls += (m.score_videocalls ?? 0)
      count++
    }
  }

  const avgStreaming = count > 0 ? Math.round(sumStreaming / count) : 0
  const avgGaming = count > 0 ? Math.round(sumGaming / count) : 0
  const avgVideocalls = count > 0 ? Math.round(sumVideocalls / count) : 0

  // Count degraded events
  const degradedCount = metrics.filter(m =>
    (m.score_streaming != null && m.score_streaming < 80) ||
    (m.score_gaming != null && m.score_gaming < 80) ||
    (m.score_videocalls != null && m.score_videocalls < 80)
  ).length

  // Find most common root cause from analyses
  const analyses = getAnalysis()
  const recentAnalyses = analyses.filter(a => new Date(a.timestamp) >= dayAgo)
  const causeCounts = new Map<string, number>()
  for (const a of recentAnalyses) {
    if (a.root_cause) {
      causeCounts.set(a.root_cause, (causeCounts.get(a.root_cause) || 0) + 1)
    }
  }
  let mostCommonCause: string | null = null
  let maxCount = 0
  for (const [cause, cnt] of causeCounts) {
    if (cnt > maxCount) { mostCommonCause = cause; maxCount = cnt }
  }

  // Generate narrative via LLM if available
  let narrative: string | null = null
  const config = getConfig()
  if (config.llmProvider || process.env.LLM_API_KEY) {
    try {
      const response = await chatCompletion([
        { role: 'system', content: 'You are a network quality analyst. Generate a brief 2-3 sentence summary of the network performance over the past 24 hours. Be concise and actionable.' },
        { role: 'user', content: JSON.stringify({
          sampleCount: metrics.length,
          avgScores: { streaming: avgStreaming, gaming: avgGaming, videocalls: avgVideocalls },
          degradedEvents: degradedCount,
          mostCommonCause: mostCommonCause,
          latestMetrics: metrics.slice(-3).map(m => ({
            ping: m.ping_avg_ms, dl: m.dl_throughput_mbps, ul: m.ul_throughput_mbps, loss: m.packet_loss_pct
          }))
        }) }
      ])
      if (response?.choices?.[0]?.message?.content) {
        narrative = response.choices[0].message.content.trim()
      }
    } catch {
      // LLM failed, fall back to data-only summary
    }
  }

  if (!narrative) {
    narrative = `Over the past 24h: ${metrics.length} samples collected. Average scores — Streaming: ${avgStreaming}, Gaming: ${avgGaming}, Video Calls: ${avgVideocalls}. ${degradedCount} degraded events detected.${mostCommonCause ? ` Most common issue: ${mostCommonCause}.` : ''}`
  }

  const summary: Omit<Summary, 'id' | 'timestamp'> = {
    period_start: dayAgo.toISOString(),
    period_end: now.toISOString(),
    avg_streaming: avgStreaming,
    avg_gaming: avgGaming,
    avg_videocalls: avgVideocalls,
    degraded_count: degradedCount,
    most_common_cause: mostCommonCause,
    narrative,
  }

  insertSummary(summary)
  const all = getSummaries()
  return all[0] ?? null
}

export { getSummaries }
