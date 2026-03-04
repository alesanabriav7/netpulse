import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import path from 'path'
import type { AppConfig, SafeAppConfig } from '@shared/types'

const VALID_INTERVALS = [15, 30, 60] as const

const defaults: AppConfig = {
  probeIntervalMinutes: 60,
  llmProvider: null,
  llmApiKey: null,
  llmBaseUrl: null,
  llmModel: null,
  llmEnabled: null,
  llmAutoDetected: false,
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
    if (!VALID_INTERVALS.includes(configCache.probeIntervalMinutes as any)) {
      configCache.probeIntervalMinutes = defaults.probeIntervalMinutes
    }
    return configCache!
  } catch {
    configCache = { ...defaults }
    return configCache
  }
}

export function getSafeConfig(): SafeAppConfig {
  const { llmApiKey, ...rest } = getConfig()
  return { ...rest, hasLlmApiKey: !!llmApiKey }
}

export function setConfig(partial: Partial<AppConfig>): AppConfig {
  if (partial.probeIntervalMinutes != null && !VALID_INTERVALS.includes(partial.probeIntervalMinutes)) {
    partial = { ...partial, probeIntervalMinutes: defaults.probeIntervalMinutes }
  }
  const current = getConfig()
  const updated = { ...current, ...partial }
  configCache = updated
  writeFileSync(configPath(), JSON.stringify(updated, null, 2), 'utf-8')
  return updated
}
