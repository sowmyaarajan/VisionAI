// LLM client — abstraction over Claude / OpenAI / OpenRouter / Azure / Gemini / Ollama / Custom
// Returns text response. Caller handles JSON parsing if structured.

const MODEL_PROVIDERS = {
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

async function callLLM({ provider, endpoint, apiKey, model, system, messages, maxTokens = 2048, temperature = 0.2, expectJson = false }) {
  const cfg = MODEL_PROVIDERS[provider] || MODEL_PROVIDERS.custom;
  const url = (endpoint || cfg.endpoint).trim();
  if (!url) throw new Error('Model endpoint URL is required.');

  // ─── Anthropic ───
  if (provider === 'claude') {
    if (!apiKey) throw new Error('Anthropic API key is required.');
    const body = {
      model: model || cfg.modelDefault,
      max_tokens: maxTokens,
      temperature,
      system: system || undefined,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data?.content?.[0]?.text || '';
  }

  // ─── Gemini ───
  if (provider === 'gemini') {
    if (!apiKey) throw new Error('Gemini API key is required.');
    const usedModel = model || cfg.modelDefault;
    const fullUrl = url.replace('{model}', usedModel) + `?key=${encodeURIComponent(apiKey)}`;
    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const body = {
      contents,
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      generationConfig: { maxOutputTokens: maxTokens, temperature, ...(expectJson ? { responseMimeType: 'application/json' } : {}) },
    };
    const res = await fetch(fullUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  // ─── Ollama ───
  if (provider === 'ollama') {
    const body = {
      model: model || cfg.modelDefault,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        ...messages,
      ],
      stream: false,
      options: { temperature, num_predict: maxTokens },
      ...(expectJson ? { format: 'json' } : {}),
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data?.message?.content || '';
  }

  // ─── OpenAI-compatible (OpenAI, OpenRouter, DeepSeek-via-OR, Azure, Custom) ───
  const isAzure = provider === 'azure';
  const headers = { 'content-type': 'application/json' };
  if (isAzure) {
    if (apiKey) headers['api-key'] = apiKey;
  } else {
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  }
  if (provider === 'openrouter' || provider === 'deepseek_openrouter') {
    headers['HTTP-Referer'] = window.location.origin || 'https://visionai.local';
    headers['X-Title'] = 'VisionAI IXP';
  }
  const body = {
    ...(model && cfg.needsModel ? { model } : {}),
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      ...messages,
    ],
    temperature,
    max_tokens: maxTokens,
    ...(expectJson ? { response_format: { type: 'json_object' } } : {}),
  };
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${cfg.label} ${res.status}: ${t.slice(0, 400)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

function extractJsonFromText(text) {
  if (!text) return null;
  // strip markdown fences
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  // find first { ... } block
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch {}
  }
  return null;
}

window.MODEL_PROVIDERS = MODEL_PROVIDERS;
window.callLLM = callLLM;
window.extractJsonFromText = extractJsonFromText;

window.DEFAULT_MODEL_SETTINGS = {
  provider: 'claude',
  endpoint: '',          // empty → uses provider default
  apiKey: '',
  model: '',
  saveLocally: true,
};
