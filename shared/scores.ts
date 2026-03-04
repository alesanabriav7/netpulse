import type { Metrics, Scores, OverallStatus } from './types'

interface WeightedMetric {
  value: number | null
  weight: number
  thresholds: [number, number, number]
  ascending: boolean
}

export function tier(value: number | null, thresholds: [number, number, number], ascending: boolean): number {
  if (value === null) return -1
  // thresholds: [excellent, good, poor] boundary values
  // Returns 0-100 with smooth interpolation between thresholds
  const [excellent, good, poor] = thresholds

  if (ascending) {
    // Higher value = better (e.g., throughput)
    if (value >= excellent) return 100
    if (value >= good) return 70 + 30 * (value - good) / (excellent - good)
    if (value >= poor) return 40 + 30 * (value - poor) / (good - poor)
    if (value > 0) return Math.max(5, 40 * value / poor)
    return 0
  } else {
    // Lower value = better (e.g., latency, jitter, loss)
    if (value <= excellent) return 100
    if (value <= good) return 70 + 30 * (good - value) / (good - excellent)
    if (value <= poor) return 40 + 30 * (poor - value) / (poor - good)
    // Beyond poor: decay towards 0
    return Math.max(5, 40 * Math.max(0, 1 - (value - poor) / poor))
  }
}

function weightedAverage(metrics: WeightedMetric[]): number {
  let totalScore = 0
  let totalWeight = 0
  for (const m of metrics) {
    if (m.value === null || m.value === undefined) continue
    totalScore += tier(m.value, m.thresholds, m.ascending) * m.weight
    totalWeight += m.weight
  }
  if (totalWeight === 0) return 0
  return Math.round(totalScore / totalWeight)
}

export function calculateScores(m: Metrics): Scores {
  const streaming = weightedAverage([
    { value: m.dl_throughput_mbps, weight: 0.4, thresholds: [50, 15, 5], ascending: true },
    { value: m.ping_jitter_ms, weight: 0.25, thresholds: [15, 40, 80], ascending: false },
    { value: m.packet_loss_pct, weight: 0.2, thresholds: [0.5, 2, 5], ascending: false },
    { value: m.ping_avg_ms, weight: 0.15, thresholds: [50, 120, 250], ascending: false },
  ])

  const gaming = weightedAverage([
    { value: m.ping_avg_ms, weight: 0.35, thresholds: [30, 75, 150], ascending: false },
    { value: m.ping_jitter_ms, weight: 0.3, thresholds: [8, 20, 50], ascending: false },
    { value: m.packet_loss_pct, weight: 0.25, thresholds: [0.5, 2, 5], ascending: false },
    { value: m.dl_throughput_mbps, weight: 0.1, thresholds: [15, 5, 3], ascending: true },
  ])

  const videocalls = weightedAverage([
    { value: m.ul_throughput_mbps, weight: 0.25, thresholds: [10, 3, 1], ascending: true },
    { value: m.dl_throughput_mbps, weight: 0.2, thresholds: [15, 5, 2], ascending: true },
    { value: m.ping_jitter_ms, weight: 0.25, thresholds: [15, 30, 60], ascending: false },
    { value: m.ping_avg_ms, weight: 0.15, thresholds: [50, 100, 200], ascending: false },
    { value: m.packet_loss_pct, weight: 0.15, thresholds: [1, 3, 7], ascending: false },
  ])

  return { streaming, gaming, videocalls }
}

export function getOverallStatus(scores: Scores): OverallStatus {
  const { streaming, gaming, videocalls } = scores
  // All zero means no data
  if (streaming === 0 && gaming === 0 && videocalls === 0) return 'unknown'
  const avg = Math.round((streaming + gaming + videocalls) / 3)
  if (avg >= 80) return 'healthy'
  if (avg >= 50) return 'degraded'
  return 'critical'
}
