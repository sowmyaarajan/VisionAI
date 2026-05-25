// LLM client: now proxied through the FastAPI backend (avoids browser CORS).
// Same shape as the prototype's window.callLLM so component code stays similar.

export const MODEL_PROVIDERS = {
  claude: {
    label: 'Claude (Anthropic)',
    endpoint: 'https://api.anthropic.com/v1/messages',
    modelDefault: 'claude-sonnet-4-5',
    modelHint: 'claude-sonnet-4-5, claude-opus-4-5, claude-haiku-4-5',
    keyLabel: 'x-api-key',
    needsModel: true,
  },
  openai: {
    label: 'OpenAI / GPT',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    modelDefault: 'gpt-4o',
    modelHint: 'gpt-4o, gpt-4o-mini, gpt-4-turbo',
    keyLabel: 'Bearer token',
    needsModel: true,
  },
  openrouter: {
    label: 'OpenRouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    modelDefault: 'deepseek/deepseek-chat-v3.1',
    modelHint: 'deepseek/deepseek-chat-v3.1, anthropic/claude-sonnet-4.5, openai/gpt-4o',
    keyLabel: 'Bearer token',
    needsModel: true,
  },
  deepseek_openrouter: {
    label: 'DeepSeek via OpenRouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    modelDefault: 'deepseek/deepseek-chat-v3.1',
    modelHint: 'deepseek/deepseek-chat-v3.1, deepseek/deepseek-r1',
    keyLabel: 'Bearer token',
    needsModel: true,
  },
  azure: {
    label: 'Azure OpenAI',
    endpoint: 'https://YOUR-RESOURCE.openai.azure.com/openai/deployments/YOUR-DEPLOYMENT/chat/completions?api-version=2024-10-21',
    modelDefault: '',
    modelHint: 'Deployment name is in the URL; leave model blank',
    keyLabel: 'api-key',
    needsModel: false,
  },
  gemini: {
    label: 'Google Gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
    modelDefault: 'gemini-2.0-flash',
    modelHint: 'gemini-2.0-flash, gemini-2.5-pro',
    keyLabel: 'api key (query param)',
    needsModel: true,
  },
  ollama: {
    label: 'Ollama (local)',
    endpoint: 'http://localhost:11434/api/chat',
    modelDefault: 'llama3.1',
    modelHint: 'llama3.1, mistral, qwen2.5',
    keyLabel: 'no key required',
    needsModel: true,
  },
  custom: {
    label: 'Custom endpoint (OpenAI-compatible)',
    endpoint: '',
    modelDefault: '',
    modelHint: 'assumes OpenAI /chat/completions shape',
    keyLabel: 'Bearer token',
    needsModel: true,
  },
};

export const DEFAULT_MODEL_SETTINGS = {
  provider: 'claude',
  endpoint: '',
  apiKey: '',
  model: '',
  saveLocally: true,
};

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try { detail = JSON.parse(text).detail || text; } catch {}
    throw new Error(detail);
  }
  try { return JSON.parse(text); } catch { return { text }; }
}

export async function callLLM({ provider, endpoint, apiKey, model, system, messages, maxTokens = 2048, temperature = 0.2, expectJson = false }) {
  const data = await postJson('/api/llm/chat', {
    provider, endpoint, apiKey, model, system, messages, maxTokens, temperature, expectJson,
  });
  return data.text || '';
}

export async function testLLM(opts) {
  return postJson('/api/llm/test', opts);
}

export function extractJsonFromText(text) {
  if (!text) return null;
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch {}
  }
  return null;
}
