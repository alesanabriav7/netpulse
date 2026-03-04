import type { ThroughputResult } from '@shared/types'
import { execProbe } from '../exec-probe'

export async function runThroughputMac(): Promise<ThroughputResult> {
  // Use -s for sequential (more accurate), -c for JSON output
  const raw = await execProbe('networkQuality -s -c', 120_000)
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

  try {
    const json = JSON.parse(raw)

    // dl_throughput and ul_throughput are in bits per second
    if (json.dl_throughput && json.dl_throughput > 0) {
      dl_throughput_mbps = Math.round((json.dl_throughput / 1_000_000) * 100) / 100
    }
    if (json.ul_throughput && json.ul_throughput > 0) {
      ul_throughput_mbps = Math.round((json.ul_throughput / 1_000_000) * 100) / 100
    }

    // Responsiveness in RPM
    dl_responsiveness_rpm = json.dl_responsiveness ? Math.round(json.dl_responsiveness) : null
    ul_responsiveness_rpm = json.ul_responsiveness ? Math.round(json.ul_responsiveness) : null

    // base_rtt is idle latency in ms
    dl_latency_ms = json.base_rtt ? Math.round(json.base_rtt * 100) / 100 : null
    ul_latency_ms = dl_latency_ms // networkQuality reports single base RTT
  } catch {
    // JSON parse failed — try parsing text output as fallback
    // networkQuality -s (without -c) outputs text like:
    // "Downlink capacity: 758.307 Mbps"
    // "Uplink capacity: 91.110 Mbps"
    const dlMatch = raw.match(/[Dd]ownlink\s+capacity:\s*([\d.]+)\s*Mbps/i)
    if (dlMatch) dl_throughput_mbps = parseFloat(dlMatch[1])

    const ulMatch = raw.match(/[Uu]plink\s+capacity:\s*([\d.]+)\s*Mbps/i)
    if (ulMatch) ul_throughput_mbps = parseFloat(ulMatch[1])

    const dlRespMatch = raw.match(/[Dd]ownlink\s+Responsiveness:.*?(\d+)\s*RPM/i)
    if (dlRespMatch) dl_responsiveness_rpm = parseInt(dlRespMatch[1])

    const ulRespMatch = raw.match(/[Uu]plink\s+Responsiveness:.*?(\d+)\s*RPM/i)
    if (ulRespMatch) ul_responsiveness_rpm = parseInt(ulRespMatch[1])

    const latencyMatch = raw.match(/[Ii]dle\s+[Ll]atency:\s*([\d.]+)\s*milliseconds/i)
    if (latencyMatch) dl_latency_ms = parseFloat(latencyMatch[1])
  }

  return {
    dl_throughput_mbps,
    ul_throughput_mbps,
    dl_responsiveness_rpm,
    ul_responsiveness_rpm,
    dl_latency_ms,
    ul_latency_ms,
    raw
  }
}
