import type { PingResult } from '@shared/types'
import { execProbe } from './exec-probe'

export async function runPing(): Promise<PingResult> {
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

    // Windows ping doesn't report stddev — parse individual times for jitter
    const times = [...raw.matchAll(/time[=<](\d+)ms/g)].map((m) => parseFloat(m[1]))
    if (times.length > 1 && avg_ms !== null) {
      const mean = times.reduce((a, b) => a + b, 0) / times.length
      const variance = times.reduce((sum, t) => sum + (t - mean) ** 2, 0) / times.length
      jitter_ms = Math.round(Math.sqrt(variance) * 100) / 100
    }
  } else {
    const lossMatch = raw.match(/([\d.]+)% packet loss/)
    if (lossMatch) packet_loss_pct = parseFloat(lossMatch[1])

    // macOS/Linux: rtt min/avg/max/mdev = 12.345/15.678/20.123/2.456 ms
    const rttMatch = raw.match(/[\d.]+\/([\d.]+)\/[\d.]+\/([\d.]+)\s*ms/)
    if (rttMatch) {
      avg_ms = parseFloat(rttMatch[1])
      jitter_ms = parseFloat(rttMatch[2])
    }
  }

  return { avg_ms, jitter_ms, packet_loss_pct, raw }
}
