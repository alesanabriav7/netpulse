import { getConfig } from './config'

const TRUSTED_HOSTS = [
  'api.openai.com',
  'api.anthropic.com',
  'localhost',
  '127.0.0.1',
]

function isBaseUrlSafe(url: string, apiKey: string | null): boolean {
  if (!apiKey) return true // No key to steal
  try {
    const parsed = new URL(url)
    return TRUSTED_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))
  } catch {
    return false
  }
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_call_id?: string
  tool_calls?: ToolCall[]
}

interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

interface ToolDef {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

interface ChatResponse {
  choices: {
    message: ChatMessage
    finish_reason: string
  }[]
}

function getProviderConfig(): { provider: string; baseUrl: string; apiKey: string | null; model: string } {
  const config = getConfig()

  // Config takes priority over env vars
  if (config.llmProvider) {
    const provider = config.llmProvider
    let baseUrl = config.llmBaseUrl || ''
    let apiKey = config.llmApiKey
    let model = config.llmModel || ''

    if (provider === 'openai') {
      baseUrl = baseUrl || 'https://api.openai.com/v1'
      model = model || 'gpt-4o-mini'
    } else if (provider === 'anthropic') {
      baseUrl = baseUrl || 'https://api.anthropic.com'
      model = model || 'claude-sonnet-4-20250514'
    } else if (provider === 'ollama') {
      baseUrl = baseUrl || 'http://localhost:11434/v1'
      apiKey = null
      model = model || 'llama3.2'
    }

    if (!isBaseUrlSafe(baseUrl, apiKey)) {
      console.warn(`Refusing to send API key to untrusted URL: ${baseUrl}`)
      apiKey = null
    }

    return { provider, baseUrl, apiKey, model }
  }

  // Fall back to env vars (backwards compat)
  const envKey = process.env.LLM_API_KEY
  if (!envKey) return { provider: 'none', baseUrl: '', apiKey: null, model: '' }

  const baseUrl = process.env.LLM_BASE_URL || 'https://api.openai.com/v1'
  let apiKey: string | null = envKey

  if (!isBaseUrlSafe(baseUrl, apiKey)) {
    console.warn(`Refusing to send API key to untrusted URL: ${baseUrl}`)
    apiKey = null
  }

  return {
    provider: 'openai',
    baseUrl,
    apiKey,
    model: process.env.LLM_MODEL || 'gpt-4o-mini',
  }
}

async function chatCompletionOpenAI(
  baseUrl: string, apiKey: string | null, model: string,
  messages: ChatMessage[], tools?: ToolDef[]
): Promise<ChatResponse | null> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

  const body: Record<string, unknown> = { model, messages }
  if (tools && tools.length > 0) body.tools = tools

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!res.ok) return null
  return (await res.json()) as ChatResponse
}

async function chatCompletionAnthropic(
  baseUrl: string, apiKey: string, model: string,
  messages: ChatMessage[], tools?: ToolDef[]
): Promise<ChatResponse | null> {
  // Extract system message
  const systemMsg = messages.find(m => m.role === 'system')
  const nonSystemMessages = messages.filter(m => m.role !== 'system')

  // Convert messages to Anthropic format
  const anthropicMessages = nonSystemMessages.map(m => {
    if (m.role === 'tool') {
      return {
        role: 'user' as const,
        content: [{
          type: 'tool_result' as const,
          tool_use_id: m.tool_call_id,
          content: m.content,
        }],
      }
    }
    if (m.tool_calls && m.tool_calls.length > 0) {
      return {
        role: 'assistant' as const,
        content: [
          ...(m.content ? [{ type: 'text' as const, text: m.content }] : []),
          ...m.tool_calls.map(tc => ({
            type: 'tool_use' as const,
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments || '{}'),
          })),
        ],
      }
    }
    return { role: m.role as 'user' | 'assistant', content: m.content }
  })

  // Convert tools to Anthropic format
  const anthropicTools = tools?.map(t => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }))

  const body: Record<string, unknown> = {
    model,
    max_tokens: 1024,
    messages: anthropicMessages,
  }
  if (systemMsg) body.system = systemMsg.content
  if (anthropicTools && anthropicTools.length > 0) body.tools = anthropicTools

  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) return null
  const data = await res.json() as { content: { type: string; text?: string; id?: string; name?: string; input?: unknown }[]; stop_reason: string }

  // Convert Anthropic response to OpenAI format
  const textParts = data.content.filter(c => c.type === 'text')
  const toolParts = data.content.filter(c => c.type === 'tool_use')

  const responseMessage: ChatMessage = {
    role: 'assistant',
    content: textParts.map(t => t.text).join(''),
  }

  if (toolParts.length > 0) {
    responseMessage.tool_calls = toolParts.map(t => ({
      id: t.id!,
      type: 'function' as const,
      function: {
        name: t.name!,
        arguments: JSON.stringify(t.input || {}),
      },
    }))
  }

  return {
    choices: [{
      message: responseMessage,
      finish_reason: data.stop_reason === 'tool_use' ? 'tool_calls' : 'stop',
    }],
  }
}

export async function chatCompletion(
  messages: ChatMessage[],
  tools?: ToolDef[]
): Promise<ChatResponse | null> {
  const { provider, baseUrl, apiKey, model } = getProviderConfig()

  if (provider === 'none') return null

  try {
    if (provider === 'anthropic') {
      if (!apiKey) return null
      return await chatCompletionAnthropic(baseUrl, apiKey, model, messages, tools)
    }
    // OpenAI and Ollama use the same API format
    return await chatCompletionOpenAI(baseUrl, apiKey, model, messages, tools)
  } catch {
    return null
  }
}
