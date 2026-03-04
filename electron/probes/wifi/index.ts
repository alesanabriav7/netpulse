import type { WifiInfo } from '@shared/types'

export async function getWifiInfo(): Promise<WifiInfo & { awdl_active: boolean | null }> {
  if (process.platform === 'darwin') {
    const { getWifiInfoMac } = await import('./mac')
    return getWifiInfoMac()
  } else {
    const { getWifiInfoWindows } = await import('./windows')
    return getWifiInfoWindows()
  }
}
