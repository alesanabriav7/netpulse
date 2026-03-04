import { getConfig, setConfig } from './config'

interface OllamaTagsResponse {
  models?: { name: string }[]
}

interface DiscoveryResult {
  provider: 'openai' | 'ollama' | null
  apiKey: string | null
  baseUrl: string | null
  model: string | null
  source: string
}

async function checkOllama(): Promise<{ available: boolean; models: string[] }> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch('http://localhost:11434/api/tags', { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) return { available: false, models: [] }
    const data = (await res.json()) as OllamaTagsResponse
    const models = (data.models ?? []).map((m) => m.name)
    return { available: models.length > 0, models }
  } catch {
    return { available: false, models: [] }
  }
}

export async function discoverLlm(): Promise<DiscoveryResult> {
  const config = getConfig()

  // 1. Existing manual config — keep it
  if (config.llmProvider && !config.llmAutoDetected) {
    return { provider: config.llmProvider === 'anthropic' ? null : config.llmProvider, apiKey: config.llmApiKey, baseUrl: config.llmBaseUrl, model: config.llmModel, source: 'manual' }
  }

  // 2. Explicit disable — skip
  if (config.llmEnabled === false) {
    return { provider: null, apiKey: null, baseUrl: null, model: null, source: 'disabled' }
  }

  // 3. Environment vars
  if (process.env.LLM_API_KEY) {
    return {
      provider: 'openai',
      apiKey: process.env.LLM_API_KEY,
      baseUrl: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
      model: process.env.LLM_MODEL || 'gpt-4o-mini',
      source: 'env',
    }
  }

  // 4. Ollama running locally
  const ollama = await checkOllama()
  if (ollama.available) {
    return {
      provider: 'ollama',
      apiKey: null,
      baseUrl: 'http://localhost:11434/v1',
      model: ollama.models[0],
      source: 'ollama',
    }
  }

  // 5. Nothing found
  return { provider: null, apiKey: null, baseUrl: null, model: null, source: 'none' }
}

export async function runDiscoveryAndApply(): Promise<DiscoveryResult> {
  const result = await discoverLlm()
  console.log(`LLM discovery: ${result.provider ?? 'none'} (${result.source})`)

  if (result.source === 'manual' || result.source === 'disabled') {
    return result
  }

  if (result.provider) {
    setConfig({
      llmProvider: result.provider,
      llmApiKey: result.apiKey,
      llmBaseUrl: result.baseUrl,
      llmModel: result.model,
      llmEnabled: true,
      llmAutoDetected: true,
    })
  }

  return result
}
