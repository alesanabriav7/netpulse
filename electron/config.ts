import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import path from 'path'
import type { AppConfig } from '@shared/types'

const defaults: AppConfig = {
  probeIntervalMinutes: 60,
  llmProvider: null,
  llmApiKey: null,
  llmBaseUrl: null,
  llmModel: null,
  minimizeToTray: false,
}

let configCache: AppConfig | null = null

function configPath(): string {
  return path.join(app.getPath('userData'), 'config.json')
}

export function getConfig(): AppConfig {
  if (configCache) return configCache
  const p = configPath()
  if (!existsSync(p)) {
    configCache = { ...defaults }
    return configCache
  }
  try {
    const raw = readFileSync(p, 'utf-8')
    configCache = { ...defaults, ...JSON.parse(raw) }
    return configCache!
  } catch {
    configCache = { ...defaults }
    return configCache
  }
}

export function setConfig(partial: Partial<AppConfig>): AppConfig {
  const current = getConfig()
  const updated = { ...current, ...partial }
  configCache = updated
  writeFileSync(configPath(), JSON.stringify(updated, null, 2), 'utf-8')
  return updated
}
