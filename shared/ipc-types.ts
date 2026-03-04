import type { Metrics, Analysis, FixStatus } from './types'

export interface IpcApi {
  getLatestMetrics: () => Promise<Metrics | null>
  getMetricsRange: (from: string, to: string) => Promise<Metrics[]>
  runProbeNow: () => Promise<void>
  applyFix: (fixId: string) => Promise<{ success: boolean; message: string }>
  getAnalysis: () => Promise<Analysis[]>
  getFixStatuses: () => Promise<Record<string, FixStatus>>
  onMetricsUpdate: (callback: (metrics: Metrics) => void) => () => void
  onAnalysisUpdate: (callback: (analysis: Analysis[]) => void) => () => void
}

export const IPC_CHANNELS = {
  GET_LATEST_METRICS: 'metrics:get-latest',
  GET_METRICS_RANGE: 'metrics:get-range',
  RUN_PROBE_NOW: 'probe:run-now',
  APPLY_FIX: 'fix:apply',
  GET_ANALYSIS: 'analysis:get',
  GET_FIX_STATUSES: 'fix:get-statuses',
  METRICS_UPDATED: 'metrics:updated',
  ANALYSIS_UPDATED: 'analysis:updated',
} as const
