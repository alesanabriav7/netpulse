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

export async function chatCompletion(
  messages: ChatMessage[],
  tools?: ToolDef[]
): Promise<ChatResponse | null> {
  const baseUrl = process.env.LLM_BASE_URL || 'https://api.openai.com/v1'
  const apiKey = process.env.LLM_API_KEY
  const model = process.env.LLM_MODEL || 'gpt-4o-mini'

  if (!apiKey) return null

  try {
    const body: Record<string, unknown> = { model, messages }
    if (tools && tools.length > 0) body.tools = tools

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    })

    if (!res.ok) return null
    return (await res.json()) as ChatResponse
  } catch {
    return null
  }
}
