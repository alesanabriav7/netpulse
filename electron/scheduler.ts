import { BrowserWindow, powerMonitor } from 'electron'
import type { Metrics, Scores } from '@shared/types'
import { IPC_CHANNELS } from '@shared/ipc-types'
import { runPing } from './probes/ping'
import { runThroughput } from './probes/throughput/index'
import { getWifiInfo } from './probes/wifi/index'
import { insertMetrics, getLatestMetrics, getAnalysis } from './db'
import { runAnalysis } from './agent'
import { notifyDegradation } from './notifier'

const INTERVAL_AC = 60 * 60 * 1000  // 60 min
const INTERVAL_BATTERY = 120 * 60 * 1000  // 120 min

let timer: ReturnType<typeof setTimeout> | null = null
let currentInterval = INTERVAL_AC

function clamp(val: number): number {
  return Math.max(0, Math.min(100, Math.round(val)))
}

function scoreComponent(
  value: number | null,
  excellent: number,
  good: number,
  poor: number,
  higherIsBetter: boolean
): number {
  if (value == null) return 50 // neutral if no data

  if (higherIsBetter) {
    if (value >= excellent) return 100
    if (value >= good) return 75
    if (value >= poor) return 40
    return 20
  } else {
    if (value <= excellent) return 100
    if (value <= good) return 75
    if (value <= poor) return 40
    return 20
  }
}

function calculateScores(m: Partial<Metrics>): Scores {
  // Streaming: dl(40%), jitter(25%), loss(20%), latency(15%)
  const streaming = clamp(
    scoreComponent(m.dl_throughput_mbps ?? null, 25, 10, 5, true) * 0.4 +
    scoreComponent(m.ping_jitter_ms ?? null, 10, 30, 50, false) * 0.25 +
    scoreComponent(m.packet_loss_pct ?? null, 0.5, 2, 5, false) * 0.2 +
    scoreComponent(m.dl_latency_ms ?? m.ping_avg_ms ?? null, 50, 100, 200, false) * 0.15
  )

  // Gaming: latency(35%), jitter(30%), loss(25%), dl(10%)
  const gaming = clamp(
    scoreComponent(m.ping_avg_ms ?? null, 20, 50, 100, false) * 0.35 +
    scoreComponent(m.ping_jitter_ms ?? null, 5, 15, 30, false) * 0.3 +
    scoreComponent(m.packet_loss_pct ?? null, 0.1, 1, 3, false) * 0.25 +
    scoreComponent(m.dl_throughput_mbps ?? null, 10, 5, 3, true) * 0.1
  )

  // Video Calls: ul(25%), dl(20%), jitter(25%), latency(15%), loss(15%)
  const videocalls = clamp(
    scoreComponent(m.ul_throughput_mbps ?? null, 5, 2, 1, true) * 0.25 +
    scoreComponent(m.dl_throughput_mbps ?? null, 10, 5, 2, true) * 0.2 +
    scoreComponent(m.ping_jitter_ms ?? null, 10, 20, 40, false) * 0.25 +
    scoreComponent(m.ping_avg_ms ?? null, 30, 80, 150, false) * 0.15 +
    scoreComponent(m.packet_loss_pct ?? null, 0.5, 2, 5, false) * 0.15
  )

  return { streaming, gaming, videocalls }
}

async function runProbes(): Promise<Metrics> {
  const [ping, throughput, wifi] = await Promise.all([
    runPing(),
    runThroughput(),
    getWifiInfo()
  ])

  const partial: Partial<Metrics> = {
    ping_avg_ms: ping.avg_ms,
    ping_jitter_ms: ping.jitter_ms,
    packet_loss_pct: ping.packet_loss_pct,
    dl_throughput_mbps: throughput.dl_throughput_mbps,
    ul_throughput_mbps: throughput.ul_throughput_mbps,
    dl_responsiveness_rpm: throughput.dl_responsiveness_rpm,
    ul_responsiveness_rpm: throughput.ul_responsiveness_rpm,
    dl_latency_ms: throughput.dl_latency_ms,
    ul_latency_ms: throughput.ul_latency_ms,
    wifi_channel: wifi.channel,
    wifi_noise_dbm: wifi.noise_dbm,
    wifi_rssi_dbm: wifi.rssi_dbm,
    wifi_tx_rate_mbps: wifi.tx_rate_mbps,
    awdl_active: wifi.awdl_active
  }

  const scores = calculateScores(partial)

  const metrics: Metrics = {
    timestamp: new Date().toISOString(),
    ping_avg_ms: partial.ping_avg_ms ?? null,
    ping_jitter_ms: partial.ping_jitter_ms ?? null,
    packet_loss_pct: partial.packet_loss_pct ?? null,
    dl_throughput_mbps: partial.dl_throughput_mbps ?? null,
    ul_throughput_mbps: partial.ul_throughput_mbps ?? null,
    dl_responsiveness_rpm: partial.dl_responsiveness_rpm ?? null,
    ul_responsiveness_rpm: partial.ul_responsiveness_rpm ?? null,
    dl_latency_ms: partial.dl_latency_ms ?? null,
    ul_latency_ms: partial.ul_latency_ms ?? null,
    wifi_channel: partial.wifi_channel ?? null,
    wifi_noise_dbm: partial.wifi_noise_dbm ?? null,
    wifi_rssi_dbm: partial.wifi_rssi_dbm ?? null,
    wifi_tx_rate_mbps: partial.wifi_tx_rate_mbps ?? null,
    awdl_active: partial.awdl_active ?? null,
    score_streaming: scores.streaming,
    score_gaming: scores.gaming,
    score_videocalls: scores.videocalls,
    raw_json: JSON.stringify({ ping, throughput, wifi })
  }

  return metrics
}

async function probeCycle(win: BrowserWindow): Promise<void> {
  try {
    const metrics = await runProbes()
    const metricId = insertMetrics(metrics)
    metrics.id = metricId

    // Send to renderer
    if (!win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.METRICS_UPDATED, metrics)
    }

    // Run agent analysis
    const analysis = await runAnalysis(metricId)
    if (analysis) {
      notifyDegradation(analysis.status, analysis.summary)
      if (!win.isDestroyed()) {
        const allAnalysis = getAnalysis()
        win.webContents.send(IPC_CHANNELS.ANALYSIS_UPDATED, allAnalysis)
      }
    }
  } catch (err) {
    console.error('Probe cycle error:', err)
  }
}

function scheduleNext(win: BrowserWindow): void {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    probeCycle(win).finally(() => scheduleNext(win))
  }, currentInterval)
}

export function startScheduler(win: BrowserWindow): void {
  // Power-aware scheduling
  powerMonitor.on('on-ac', () => {
    currentInterval = INTERVAL_AC
  })
  powerMonitor.on('on-battery', () => {
    currentInterval = INTERVAL_BATTERY
  })

  // Run first probe immediately
  probeCycle(win).finally(() => scheduleNext(win))
}

export async function runProbeNow(win: BrowserWindow): Promise<void> {
  // Reset the timer
  if (timer) clearTimeout(timer)
  await probeCycle(win)
  scheduleNext(win)
}
