import type { ThroughputResult } from '@shared/types'
import { execProbe } from '../exec-probe'

export async function runThroughputWindows(): Promise<ThroughputResult> {
  // Download test using curl against Cloudflare
  const dlRaw = await execProbe(
    'curl -o NUL -w "%{speed_download}" https://speed.cloudflare.com/__down?bytes=10000000',
    60_000
  )

  // Upload test using curl against Cloudflare
  const ulRaw = await execProbe(
    'curl -X POST -o NUL -w "%{speed_upload}" --data-binary @NUL https://speed.cloudflare.com/__up',
    60_000
  )

  let dl_throughput_mbps: number | null = null
  let ul_throughput_mbps: number | null = null

  if (dlRaw) {
    const bytesPerSec = parseFloat(dlRaw)
    if (!isNaN(bytesPerSec) && bytesPerSec > 0) {
      dl_throughput_mbps = Math.round((bytesPerSec * 8) / 1_000_000 * 100) / 100
    }
  }

  if (ulRaw) {
    const bytesPerSec = parseFloat(ulRaw)
    if (!isNaN(bytesPerSec) && bytesPerSec > 0) {
      ul_throughput_mbps = Math.round((bytesPerSec * 8) / 1_000_000 * 100) / 100
    }
  }

  return {
    dl_throughput_mbps,
    ul_throughput_mbps,
    dl_responsiveness_rpm: null,
    ul_responsiveness_rpm: null,
    dl_latency_ms: null,
    ul_latency_ms: null,
    raw: `dl: ${dlRaw}, ul: ${ulRaw}`
  }
}
