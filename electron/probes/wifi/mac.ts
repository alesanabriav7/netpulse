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
          result.ssid = currentNetwork.spairport_network_name ?? null
          result.bssid = currentNetwork.spairport_network_bssid ?? null
          result.security = currentNetwork.spairport_security_mode ?? null

          const channel = currentNetwork.spairport_network_channel
          if (channel) result.channel = String(channel)

          result.noise_dbm = currentNetwork.spairport_network_noise != null
            ? parseInt(currentNetwork.spairport_network_noise)
            : null

          result.rssi_dbm = currentNetwork.spairport_signal_noise != null
            ? parseInt(currentNetwork.spairport_signal_noise)
            : null

          result.tx_rate_mbps = currentNetwork.spairport_network_rate != null
            ? parseInt(currentNetwork.spairport_network_rate)
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
