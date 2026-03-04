import type { ThroughputResult } from '@shared/types'
import { execProbe } from '../exec-probe'

export async function runThroughputMac(): Promise<ThroughputResult> {
  const raw = await execProbe('networkQuality -s -v', 120_000)
  if (!raw) {
    return {
      dl_throughput_mbps: null,
      ul_throughput_mbps: null,
      dl_responsiveness_rpm: null,
      ul_responsiveness_rpm: null,
      dl_latency_ms: null,
      ul_latency_ms: null,
      raw: ''
    }
  }

  let dl_throughput_mbps: number | null = null
  let ul_throughput_mbps: number | null = null
  let dl_responsiveness_rpm: number | null = null
  let ul_responsiveness_rpm: number | null = null
  let dl_latency_ms: number | null = null
  let ul_latency_ms: number | null = null

  // Try JSON parse first (networkQuality -s outputs JSON-like summary)
  try {
    const json = JSON.parse(raw)
    dl_throughput_mbps = json.dl_throughput ? json.dl_throughput / 1_000_000 : null
    ul_throughput_mbps = json.ul_throughput ? json.ul_throughput / 1_000_000 : null
    dl_responsiveness_rpm = json.dl_responsiveness ?? null
    ul_responsiveness_rpm = json.ul_responsiveness ?? null
    dl_latency_ms = json.dl_latency ?? null
    ul_latency_ms = json.ul_latency ?? null
  } catch {
    // Fallback: parse text output
    const dlMatch = raw.match(/Download capacity:\s*([\d.]+)\s*Mbps/)
    if (dlMatch) dl_throughput_mbps = parseFloat(dlMatch[1])

    const ulMatch = raw.match(/Upload capacity:\s*([\d.]+)\s*Mbps/)
    if (ulMatch) ul_throughput_mbps = parseFloat(ulMatch[1])

    const dlRespMatch = raw.match(/Download Responsiveness:\s*([\d.]+)\s*RPM/)
    if (dlRespMatch) dl_responsiveness_rpm = parseInt(dlRespMatch[1])

    const ulRespMatch = raw.match(/Upload Responsiveness:\s*([\d.]+)\s*RPM/)
    if (ulRespMatch) ul_responsiveness_rpm = parseInt(ulRespMatch[1])

    const dlLatMatch = raw.match(/Download Latency:\s*([\d.]+)\s*ms/)
    if (dlLatMatch) dl_latency_ms = parseFloat(dlLatMatch[1])

    const ulLatMatch = raw.match(/Upload Latency:\s*([\d.]+)\s*ms/)
    if (ulLatMatch) ul_latency_ms = parseFloat(ulLatMatch[1])
  }

  return {
    dl_throughput_mbps: dl_throughput_mbps !== null ? Math.round(dl_throughput_mbps * 100) / 100 : null,
    ul_throughput_mbps: ul_throughput_mbps !== null ? Math.round(ul_throughput_mbps * 100) / 100 : null,
    dl_responsiveness_rpm,
    ul_responsiveness_rpm,
    dl_latency_ms,
    ul_latency_ms,
    raw
  }
}
