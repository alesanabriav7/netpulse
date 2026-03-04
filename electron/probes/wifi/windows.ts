import type { WifiInfo } from '@shared/types'
import { execProbe } from '../exec-probe'

export async function getWifiInfoWindows(): Promise<WifiInfo & { awdl_active: boolean | null }> {
  const raw = await execProbe('netsh wlan show interfaces', 10_000)

  const result: WifiInfo & { awdl_active: boolean | null } = {
    channel: null,
    noise_dbm: null,
    rssi_dbm: null,
    tx_rate_mbps: null,
    ssid: null,
    bssid: null,
    security: null,
    awdl_active: null // AWDL is macOS-only
  }

  if (!raw) return result

  const getValue = (key: string): string | null => {
    const match = raw.match(new RegExp(`${key}\\s*:\\s*(.+)`, 'i'))
    return match ? match[1].trim() : null
  }

  result.ssid = getValue('SSID') ?? getValue('\\bSSID')
  result.bssid = getValue('BSSID')
  result.channel = getValue('Channel')
  result.security = getValue('Authentication')

  const signal = getValue('Signal')
  if (signal) {
    // Windows reports signal as percentage, convert to approximate dBm
    const pct = parseInt(signal.replace('%', ''))
    if (!isNaN(pct)) {
      result.rssi_dbm = Math.round(pct / 2 - 100)
    }
  }

  const txRate = getValue('Receive rate \\(Mbps\\)') ?? getValue('Transmit rate \\(Mbps\\)')
  if (txRate) {
    const rate = parseFloat(txRate)
    if (!isNaN(rate)) result.tx_rate_mbps = rate
  }

  return result
}
