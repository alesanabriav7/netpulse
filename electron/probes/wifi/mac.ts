import type { WifiInfo } from '@shared/types'
import { execProbe } from '../exec-probe'

export async function getWifiInfoMac(): Promise<WifiInfo & { awdl_active: boolean | null }> {
  const raw = await execProbe('system_profiler SPAirPortDataType -json', 15_000)

  const result: WifiInfo & { awdl_active: boolean | null } = {
    channel: null,
    noise_dbm: null,
    rssi_dbm: null,
    tx_rate_mbps: null,
    ssid: null,
    bssid: null,
    security: null,
    awdl_active: null
  }

  if (raw) {
    try {
      const json = JSON.parse(raw)
      const airportData = json?.SPAirPortDataType?.[0]
      const interfaces = airportData?.spairport_airport_interfaces

      if (interfaces && interfaces.length > 0) {
        const iface = interfaces[0]
        const currentNetwork = iface?.spairport_current_network_information

        if (currentNetwork) {
          result.ssid = currentNetwork._name ?? null
          result.security = currentNetwork.spairport_security_mode ?? null

          const channel = currentNetwork.spairport_network_channel
          if (channel) result.channel = String(channel)

          // spairport_signal_noise is formatted as "-37 dBm / -93 dBm" (rssi / noise)
          const signalNoise = currentNetwork.spairport_signal_noise
          if (typeof signalNoise === 'string') {
            const parts = signalNoise.split('/')
            if (parts.length === 2) {
              const rssi = parseInt(parts[0])
              const noise = parseInt(parts[1])
              if (!isNaN(rssi)) result.rssi_dbm = rssi
              if (!isNaN(noise)) result.noise_dbm = noise
            }
          }

          result.tx_rate_mbps = currentNetwork.spairport_network_rate != null
            ? Number(currentNetwork.spairport_network_rate)
            : null
        }
      }
    } catch {
      // JSON parse failed, try regex fallback on raw text
    }
  }

  // Check AWDL status
  const awdlRaw = await execProbe('ifconfig awdl0', 5_000)
  if (awdlRaw) {
    result.awdl_active = awdlRaw.includes('status: active')
  }

  return result
}
