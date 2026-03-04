import { BrowserWindow, powerMonitor } from 'electron'
import type { Metrics, OverallStatus } from '@shared/types'
import { IPC_CHANNELS } from '@shared/ipc-types'
import { calculateScores } from '@shared/scores'
import { runPing } from './probes/ping'
import { runThroughput } from './probes/throughput/index'
import { getWifiInfo } from './probes/wifi/index'
import { insertMetrics, getLatestMetrics, getAnalysis } from './db'
import { runAnalysis } from './agent'
import { notifyDegradation } from './notifier'
import { getConfig } from './config'

let timer: ReturnType<typeof setTimeout> | null = null
let onBattery = false
let currentWin: BrowserWindow | null = null
let previousMetrics: Metrics | null = null

interface ChangeEvent {
  type: string
  description: string
  severity: 'info' | 'warning' | 'critical'
}

function detectChanges(prev: Metrics, curr: Metrics): ChangeEvent[] {
  const changes: ChangeEvent[] = []

  // Latency spike (>50% increase or >30ms jump)
  if (prev.ping_avg_ms != null && curr.ping_avg_ms != null) {
    const increase = curr.ping_avg_ms - prev.ping_avg_ms
    const pctIncrease = prev.ping_avg_ms > 0 ? increase / prev.ping_avg_ms : 0
    if (pctIncrease > 0.5 || increase > 30) {
      changes.push({
        type: 'latency_spike',
        description: `Latency spiked from ${prev.ping_avg_ms.toFixed(0)}ms to ${curr.ping_avg_ms.toFixed(0)}ms`,
        severity: curr.ping_avg_ms > 100 ? 'critical' : 'warning',
      })
    }
  }

  // Throughput drop (>30%)
  if (prev.dl_throughput_mbps != null && curr.dl_throughput_mbps != null && prev.dl_throughput_mbps > 0) {
    const drop = (prev.dl_throughput_mbps - curr.dl_throughput_mbps) / prev.dl_throughput_mbps
    if (drop > 0.3) {
      changes.push({
        type: 'throughput_drop',
        description: `Download dropped from ${prev.dl_throughput_mbps.toFixed(1)} to ${curr.dl_throughput_mbps.toFixed(1)} Mbps`,
        severity: curr.dl_throughput_mbps < 5 ? 'critical' : 'warning',
      })
    }
  }

  // WiFi channel change
  if (prev.wifi_channel != null && curr.wifi_channel != null && prev.wifi_channel !== curr.wifi_channel) {
    changes.push({
      type: 'channel_change',
      description: `WiFi channel changed from ${prev.wifi_channel} to ${curr.wifi_channel}`,
      severity: 'info',
    })
  }

  // AWDL state change
  if (prev.awdl_active != null && curr.awdl_active != null && prev.awdl_active !== curr.awdl_active) {
    changes.push({
      type: 'awdl_change',
      description: curr.awdl_active ? 'AWDL became active (potential WiFi interference)' : 'AWDL became inactive',
      severity: curr.awdl_active ? 'warning' : 'info',
    })
  }

  // Packet loss spike (>2%)
  if (curr.packet_loss_pct != null && curr.packet_loss_pct > 2) {
    const prevLoss = prev.packet_loss_pct ?? 0
    if (curr.packet_loss_pct - prevLoss > 1) {
      changes.push({
        type: 'packet_loss_spike',
        description: `Packet loss spiked to ${curr.packet_loss_pct.toFixed(1)}%`,
        severity: curr.packet_loss_pct > 5 ? 'critical' : 'warning',
      })
    }
  }

  return changes
}

function getIntervalMs(): number {
  const config = getConfig()
  const baseMinutes = config.probeIntervalMinutes || 60
  const baseMs = baseMinutes * 60 * 1000
  // Halve frequency on battery
  return onBattery ? baseMs * 2 : baseMs
}

function emitProgress(phase: string, detail: string): void {
  if (currentWin && !currentWin.isDestroyed()) {
    currentWin.webContents.send(IPC_CHANNELS.PROBE_PROGRESS, { phase, detail })
  }
}

async function runProbes(): Promise<Metrics> {
  emitProgress('ping', 'Testing latency & packet loss...')
  const ping = await runPing()

  emitProgress('throughput', 'Measuring download & upload speed...')
  const throughput = await runThroughput()

  emitProgress('wifi', 'Checking WiFi signal quality...')
  const wifi = await getWifiInfo()

  emitProgress('scoring', 'Calculating scores...')

  const metrics: Metrics = {
    timestamp: new Date().toISOString(),
    ping_avg_ms: ping.avg_ms ?? null,
    ping_jitter_ms: ping.jitter_ms ?? null,
    packet_loss_pct: ping.packet_loss_pct ?? null,
    dl_throughput_mbps: throughput.dl_throughput_mbps ?? null,
    ul_throughput_mbps: throughput.ul_throughput_mbps ?? null,
    dl_responsiveness_rpm: throughput.dl_responsiveness_rpm ?? null,
    ul_responsiveness_rpm: throughput.ul_responsiveness_rpm ?? null,
    dl_latency_ms: throughput.dl_latency_ms ?? null,
    ul_latency_ms: throughput.ul_latency_ms ?? null,
    wifi_channel: wifi.channel ?? null,
    wifi_noise_dbm: wifi.noise_dbm ?? null,
    wifi_rssi_dbm: wifi.rssi_dbm ?? null,
    wifi_tx_rate_mbps: wifi.tx_rate_mbps ?? null,
    awdl_active: wifi.awdl_active ?? null,
    score_streaming: null,
    score_gaming: null,
    score_videocalls: null,
    raw_json: JSON.stringify({ ping, throughput, wifi })
  }

  const scores = calculateScores(metrics)
  metrics.score_streaming = scores.streaming
  metrics.score_gaming = scores.gaming
  metrics.score_videocalls = scores.videocalls

  return metrics
}

async function probeCycle(): Promise<void> {
  try {
    const metrics = await runProbes()
    const metricId = insertMetrics(metrics)
    metrics.id = metricId

    emitProgress('done', 'Test complete!')

    // Send to renderer
    if (currentWin && !currentWin.isDestroyed()) {
      currentWin.webContents.send(IPC_CHANNELS.METRICS_UPDATED, metrics)
    }

    // Detect changes
    const changes = previousMetrics ? detectChanges(previousMetrics, metrics) : []
    previousMetrics = metrics

    // Notify on significant changes
    if (changes.some(c => c.severity === 'warning' || c.severity === 'critical')) {
      const changeDesc = changes.map(c => c.description).join('; ')
      notifyDegradation('degraded' as OverallStatus, changeDesc)
    }

    // Run agent analysis
    const analysis = await runAnalysis(metricId)
    if (analysis) {
      notifyDegradation(analysis.status, analysis.summary)
      if (currentWin && !currentWin.isDestroyed()) {
        const allAnalysis = getAnalysis()
        currentWin.webContents.send(IPC_CHANNELS.ANALYSIS_UPDATED, allAnalysis)
      }
    }
  } catch (err) {
    console.error('Probe cycle error:', err)
  }
}

function scheduleNext(): void {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    probeCycle().finally(() => scheduleNext())
  }, getIntervalMs())
}

export function setSchedulerWindow(win: BrowserWindow | null): void {
  currentWin = win
}

export function startScheduler(win: BrowserWindow | null): void {
  currentWin = win

  // Power-aware scheduling
  powerMonitor.on('on-ac', () => {
    onBattery = false
  })
  powerMonitor.on('on-battery', () => {
    onBattery = true
  })

  // Run first probe immediately
  probeCycle().finally(() => scheduleNext())
}

export async function runProbeNow(): Promise<void> {
  // Reset the timer
  if (timer) clearTimeout(timer)
  await probeCycle()
  scheduleNext()
}
