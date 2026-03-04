import type { Metrics, Scores, OverallStatus } from '../../../shared/types'

function tier(value: number | null, thresholds: [number, number, number], ascending: boolean): number {
  if (value === null) return 0
  const [a, b, c] = thresholds
  if (ascending) {
    if (value > a) return 100
    if (value > b) return 70
    if (value > c) return 40
    return 10
  }
  if (value < a) return 100
  if (value < b) return 70
  if (value < c) return 40
  return 10
}

export function calculateScores(m: Metrics): Scores {
  const dl = m.dl_throughput_mbps
  const ul = m.ul_throughput_mbps
  const latency = m.ping_avg_ms
  const jitter = m.ping_jitter_ms
  const loss = m.packet_loss_pct

  const streaming =
    tier(dl, [25, 10, 5], true) * 0.4 +
    tier(jitter, [10, 30, 50], false) * 0.25 +
    tier(loss, [0.5, 2, 5], false) * 0.2 +
    tier(latency, [50, 100, 200], false) * 0.15

  const gaming =
    tier(latency, [20, 50, 100], false) * 0.35 +
    tier(jitter, [5, 15, 30], false) * 0.3 +
    tier(loss, [0.1, 1, 3], false) * 0.25 +
    tier(dl, [10, 5, 3], true) * 0.1

  const videocalls =
    tier(ul, [5, 2, 1], true) * 0.25 +
    tier(dl, [10, 5, 2], true) * 0.2 +
    tier(jitter, [10, 20, 40], false) * 0.25 +
    tier(latency, [30, 80, 150], false) * 0.15 +
    tier(loss, [0.5, 2, 5], false) * 0.15

  return {
    streaming: Math.round(streaming),
    gaming: Math.round(gaming),
    videocalls: Math.round(videocalls),
  }
}

export function getOverallStatus(scores: Scores): OverallStatus {
  const min = Math.min(scores.streaming, scores.gaming, scores.videocalls)
  if (min >= 80) return 'healthy'
  if (min >= 50) return 'degraded'
  return 'critical'
}
