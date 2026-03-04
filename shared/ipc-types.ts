import type { Metrics, Analysis, FixStatus, AppConfig, SafeAppConfig, Summary } from './types'

export interface IpcApi {
  getLatestMetrics: () => Promise<Metrics | null>
  getMetricsRange: (from: string, to: string) => Promise<Metrics[]>
  runProbeNow: () => Promise<void>
  applyFix: (fixId: string) => Promise<{ success: boolean; message: string }>
  getAnalysis: () => Promise<Analysis[]>
  getFixStatuses: () => Promise<Record<string, FixStatus>>
  checkFixes: () => Promise<Record<string, FixStatus>>
  onMetricsUpdate: (callback: (metrics: Metrics) => void) => () => void
  onAnalysisUpdate: (callback: (analysis: Analysis[]) => void) => () => void
  getConfig: () => Promise<SafeAppConfig>
  setConfig: (partial: Partial<AppConfig>) => Promise<SafeAppConfig>
  onProbeProgress: (callback: (step: { phase: string; detail: string }) => void) => () => void
  onConfigUpdate: (callback: (config: SafeAppConfig) => void) => () => void
  getSummaries: () => Promise<Summary[]>
  generateSummary: () => Promise<Summary | null>
  discoverLlm: () => Promise<{ provider: string | null; source: string }>
}

export const IPC_CHANNELS = {
  GET_LATEST_METRICS: 'metrics:get-latest',
  GET_METRICS_RANGE: 'metrics:get-range',
  RUN_PROBE_NOW: 'probe:run-now',
  APPLY_FIX: 'fix:apply',
  GET_ANALYSIS: 'analysis:get',
  GET_FIX_STATUSES: 'fix:get-statuses',
  CHECK_FIXES: 'fix:check',
  FIX_STATUSES_UPDATED: 'fix:statuses-updated',
  METRICS_UPDATED: 'metrics:updated',
  ANALYSIS_UPDATED: 'analysis:updated',
  GET_CONFIG: 'config:get',
  SET_CONFIG: 'config:set',
  CONFIG_UPDATED: 'config:updated',
  GET_SUMMARIES: 'summary:get',
  GENERATE_SUMMARY: 'summary:generate',
  SUMMARY_UPDATED: 'summary:updated',
  PROBE_PROGRESS: 'probe:progress',
  LLM_DISCOVER: 'llm:discover',
} as const
