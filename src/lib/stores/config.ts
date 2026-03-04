import { writable } from 'svelte/store'
import type { AppConfig, SafeAppConfig } from '../../../shared/types'

export const appConfig = writable<SafeAppConfig | null>(null)

export async function loadConfig(): Promise<void> {
  const config = await window.api.getConfig()
  appConfig.set(config)
}

export async function saveConfig(partial: Partial<AppConfig>): Promise<void> {
  const updated = await window.api.setConfig(partial)
  appConfig.set(updated)
}

export function initConfigStore(): () => void {
  loadConfig()
  return window.api.onConfigUpdate((config) => {
    appConfig.set(config)
  })
}
