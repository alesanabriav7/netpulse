import type { PingResult } from '@shared/types'
import { execProbe } from './exec-probe'

const CF_URL = 'https://speed.cloudflare.com/__down?bytes=0'
const HTTP_REQUESTS = 10
const HTTP_TIMEOUT = 5_000

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

function stddev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

async function measureHttpRtt(): Promise<PingResult> {
  const rtts: number[] = []
  let failures = 0

  for (let i = 0; i < HTTP_REQUESTS; i++) {
    try {
      const start = performance.now()
      const res = await fetch(CF_URL, { signal: AbortSignal.timeout(HTTP_TIMEOUT) })
      if (!res.ok) {
        failures++
        continue
      }
      await res.text()
      const rtt = performance.now() - start
      // Discard first request (TCP/TLS cold start)
      if (i > 0) rtts.push(rtt)
    } catch {
      failures++
    }
  }

  if (rtts.length === 0) {
    return { avg_ms: null, jitter_ms: null, packet_loss_pct: null, raw: '' }
  }

  const avg_ms = Math.round(median(rtts) * 100) / 100
  const jitter_ms = Math.round(stddev(rtts) * 100) / 100
  const packet_loss_pct = Math.round((failures / HTTP_REQUESTS) * 100 * 100) / 100

  return {
    avg_ms,
    jitter_ms,
    packet_loss_pct,
    raw: JSON.stringify({ method: 'http', rtts: rtts.map((r) => Math.round(r * 100) / 100) })
  }
}

async function measureIcmpPing(): Promise<PingResult> {
  const isWin = process.platform === 'win32'
  const cmd = isWin ? 'ping -n 10 1.1.1.1' : 'ping -c 10 1.1.1.1'

  const raw = await execProbe(cmd, 30_000)
  if (!raw) {
    return { avg_ms: null, jitter_ms: null, packet_loss_pct: null, raw: '' }
  }

  let avg_ms: number | null = null
  let jitter_ms: number | null = null
  let packet_loss_pct: number | null = null

  if (isWin) {
    const lossMatch = raw.match(/(\d+)%\s+loss/)
    if (lossMatch) packet_loss_pct = parseFloat(lossMatch[1])

    const avgMatch = raw.match(/Average\s*=\s*(\d+)ms/)
    if (avgMatch) avg_ms = parseFloat(avgMatch[1])

    const times = [...raw.matchAll(/time[=<](\d+)ms/g)].map((m) => parseFloat(m[1]))
    if (times.length > 1 && avg_ms !== null) {
      const mean = times.reduce((a, b) => a + b, 0) / times.length
      const variance = times.reduce((sum, t) => sum + (t - mean) ** 2, 0) / times.length
      jitter_ms = Math.round(Math.sqrt(variance) * 100) / 100
    }
  } else {
    const lossMatch = raw.match(/([\d.]+)% packet loss/)
    if (lossMatch) packet_loss_pct = parseFloat(lossMatch[1])

    const rttMatch = raw.match(/[\d.]+\/([\d.]+)\/[\d.]+\/([\d.]+)\s*ms/)
    if (rttMatch) {
      avg_ms = parseFloat(rttMatch[1])
      jitter_ms = parseFloat(rttMatch[2])
    }
  }

  return { avg_ms, jitter_ms, packet_loss_pct, raw }
}

export async function runPing(): Promise<PingResult> {
  const httpResult = await measureHttpRtt()
  if (httpResult.avg_ms !== null) return httpResult
  // Fallback to ICMP if HTTP measurement failed entirely
  return measureIcmpPing()
}
