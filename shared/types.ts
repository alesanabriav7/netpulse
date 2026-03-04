export interface Metrics {
  id?: number
  timestamp: string
  ping_avg_ms: number | null
  ping_jitter_ms: number | null
  packet_loss_pct: number | null
  dl_throughput_mbps: number | null
  ul_throughput_mbps: number | null
  dl_responsiveness_rpm: number | null
  ul_responsiveness_rpm: number | null
  dl_latency_ms: number | null
  ul_latency_ms: number | null
  wifi_channel: string | null
  wifi_noise_dbm: number | null
  wifi_rssi_dbm: number | null
  wifi_tx_rate_mbps: number | null
  awdl_active: boolean | null
  score_streaming: number | null
  score_gaming: number | null
  score_videocalls: number | null
  raw_json: string | null
}

export interface WifiInfo {
  channel: string | null
  noise_dbm: number | null
  rssi_dbm: number | null
  tx_rate_mbps: number | null
  ssid: string | null
  bssid: string | null
  security: string | null
}

export interface ThroughputResult {
  dl_throughput_mbps: number | null
  ul_throughput_mbps: number | null
  dl_responsiveness_rpm: number | null
  ul_responsiveness_rpm: number | null
  dl_latency_ms: number | null
  ul_latency_ms: number | null
  raw: string
}

export interface PingResult {
  avg_ms: number | null
  jitter_ms: number | null
  packet_loss_pct: number | null
  raw: string
}

export interface Analysis {
  id?: number
  timestamp: string
  metric_id: number
  status: 'healthy' | 'degraded' | 'critical'
  summary: string
  root_cause: string | null
  recommendation: string | null
}

export interface Scores {
  streaming: number
  gaming: number
  videocalls: number
}

export interface Fix {
  id: string
  label: string
  description: string
  platforms: ('darwin' | 'win32')[]
  command: { darwin?: string; win32?: string }
  reversible: boolean
  requiresAdmin: boolean
}

export interface FixStatus {
  fixId: string
  applied: boolean
  lastResult: { success: boolean; message: string } | null
}

export type OverallStatus = 'healthy' | 'degraded' | 'critical'
