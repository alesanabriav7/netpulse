import type { ThroughputResult } from '@shared/types'

// Cloudflare speed test endpoints
const DL_URL = 'https://speed.cloudflare.com/__down'
const UL_URL = 'https://speed.cloudflare.com/__up'

// Test with increasing payload sizes for accuracy
const DL_SIZES = [100_000, 1_000_000, 10_000_000]
const UL_SIZES = [100_000, 1_000_000]

interface DownloadResult {
  speed: number
  rtt_ms: number
}

async function measureDownload(bytes: number): Promise<DownloadResult | null> {
  try {
    const start = performance.now()
    const res = await fetch(`${DL_URL}?bytes=${bytes}`, {
      signal: AbortSignal.timeout(30_000)
    })
    if (!res.ok) return null
    // Consume the body to measure actual transfer time
    await res.arrayBuffer()
    const elapsed_ms = performance.now() - start
    if (elapsed_ms <= 0) return null
    const elapsed_s = elapsed_ms / 1000
    return {
      speed: (bytes * 8) / elapsed_s / 1_000_000, // Mbps
      rtt_ms: Math.round(elapsed_ms * 100) / 100
    }
  } catch {
    return null
  }
}

async function measureUpload(bytes: number): Promise<number | null> {
  try {
    const payload = new Uint8Array(bytes)
    const start = performance.now()
    const res = await fetch(UL_URL, {
      method: 'POST',
      body: payload,
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return null
    await res.text()
    const elapsed = (performance.now() - start) / 1000
    if (elapsed <= 0) return null
    return (bytes * 8) / elapsed / 1_000_000 // Mbps
  } catch {
    return null
  }
}

export async function runThroughputWindows(): Promise<ThroughputResult> {
  // Run download tests with increasing sizes
  const dlResults: DownloadResult[] = []
  for (const size of DL_SIZES) {
    const result = await measureDownload(size)
    if (result !== null) dlResults.push(result)
  }

  // Run upload tests with increasing sizes
  const ulResults: number[] = []
  for (const size of UL_SIZES) {
    const speed = await measureUpload(size)
    if (speed !== null) ulResults.push(speed)
  }

  // Take the maximum speed (largest payload gives most accurate result)
  const dl_throughput_mbps = dlResults.length > 0
    ? Math.round(Math.max(...dlResults.map((r) => r.speed)) * 100) / 100
    : null
  const ul_throughput_mbps = ulResults.length > 0
    ? Math.round(Math.max(...ulResults) * 100) / 100
    : null

  // Use RTT from smallest download (100KB) as latency — closest to pure RTT
  const dl_latency_ms = dlResults.length > 0 ? dlResults[0].rtt_ms : null

  return {
    dl_throughput_mbps,
    ul_throughput_mbps,
    dl_responsiveness_rpm: null,
    ul_responsiveness_rpm: null,
    dl_latency_ms,
    ul_latency_ms: null,
    raw: JSON.stringify({ dl: dlResults.map((r) => r.speed), ul: ulResults })
  }
}
