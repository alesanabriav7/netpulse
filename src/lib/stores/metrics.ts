import { writable, derived } from 'svelte/store'
import type { Metrics, Scores, OverallStatus } from '../../../shared/types'
import { calculateScores, getOverallStatus } from '../utils/scores'

export const latestMetrics = writable<Metrics | null>(null)
export const metricsHistory = writable<Metrics[]>([])

export const scores = derived(latestMetrics, ($m) =>
  $m ? calculateScores($m) : null
)

export const overallStatus = derived(scores, ($s): OverallStatus | null =>
  $s ? getOverallStatus($s) : null
)

export function initMetricsStore(): () => void {
  window.api.getLatestMetrics().then((m) => {
    if (m) latestMetrics.set(m)
  })

  const now = new Date()
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  window.api.getMetricsRange(dayAgo.toISOString(), now.toISOString()).then((history) => {
    metricsHistory.set(history)
  })

  const unsub = window.api.onMetricsUpdate((metrics) => {
    latestMetrics.set(metrics)
    metricsHistory.update((h) => [...h.slice(-287), metrics])
  })

  return unsub
}
