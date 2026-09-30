// Netlify Serverless Function: voice-command.js
// Handles voice commands for the Stock Tracker PWA
//
// ARCHITECTURE (v2 — Groq Primary):
//   1. PRIMARY: Groq Whisper (STT) + Groq LLM (command processing) — fast & free
//   2. FALLBACK: Gemini multimodal (audio + LLM in one shot)
//
// SECURITY: Requires authenticated user (JWT), rate-limited, input-validated

try { require('dotenv').config(); } catch (e) {}

const { verifyAuth, checkRateLimit, getOriginHeader, validatePayload } = require('./auth-helper');

// ─── Provider Chain Configuration ───
function buildProviderChain() {
  const chain = [];

  // PRIMARY: Groq (Whisper STT + LLM)
  if (process.env.GROQ_API_KEY) {
    chain.push({
      provider: 'groq',
      key: process.env.GROQ_API_KEY,
      whisperModel: process.env.GROQ_WHISPER_MODEL || 'whisper-large-v3-turbo',
      llmModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      baseUrl: 'https://api.groq.com/openai/v1',
      label: 'Groq (Whisper+LLM)'
    });
  }

  // FALLBACK 1: Gemini Primary
  if (process.env.GEMINI_API_KEY_PRIMARY) {
    chain.push({
      provider: 'gemini',
      key: process.env.GEMINI_API_KEY_PRIMARY,
      model: process.env.GEMINI_MODEL_PRIMARY || process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      baseUrl: process.env.GEMINI_BASE_URL_PRIMARY || 'https://generativelanguage.googleapis.com/v1beta',
      label: 'Gemini Primary'
    });
  }

  // FALLBACK 2: Gemini Fallback key
  if (process.env.GEMINI_API_KEY_FALLBACK) {
    chain.push({
      provider: 'gemini',
      key: process.env.GEMINI_API_KEY_FALLBACK,
      model: process.env.GEMINI_MODEL_FALLBACK || 'gemini-2.5-flash',
      baseUrl: process.env.GEMINI_BASE_URL_FALLBACK || 'https://generativelanguage.googleapis.com/v1beta',
      label: 'Gemini Fallback'
    });
  }

  // FALLBACK 3: Legacy Gemini key
  const usedKeys = new Set(chain.filter(c => c.provider === 'gemini').map(c => c.key));
  if (process.env.GEMINI_API_KEY && !usedKeys.has(process.env.GEMINI_API_KEY)) {
    chain.push({
      provider: 'gemini',
      key: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      baseUrl: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
      label: 'Gemini Legacy'
    });
  }

  return chain;
}

const PROVIDER_CHAIN = buildProviderChain();

// ─── System Prompt (shared by both Groq LLM and Gemini) ───
const VOICE_COMMAND_SYSTEM_PROMPT = `You are a smart voice assistant for a Stock Tracker app. Users speak commands to manage their grocery/household stock inventory AND ask intelligent questions about their stock.

## Language Support:
- Support: English, Tamil (Unicode script), Tanglish
- Detect language and respond in the SAME language
- Tamil: use everyday spoken Tamil, not formal. Example: "சரி! முட்டை சேர்த்துவிட்டேன்."
- Tanglish: respond in Tanglish if user uses it
- product/stockType/targetHome fields MUST always be in English for DB consistency

## Available Actions:
1. **add** — Add product. Triggers: "Add X", "I bought X", "Got X"
2. **delete** — Remove product. Triggers: "Remove X", "Delete X"
3. **update_availability** — Mark finished (No) or restocked (Yes). Triggers: "X is finished/over/done" → No; "X is back/restocked" → Yes
4. **query** — Answer questions about stock (no modification)

## Query Types:
- Stock lookup: "Do I have X?", "How much rice?"
- Expiry: "What's expiring soon?", "Any expired items?"
- Shopping: "What do I need to buy?", "Shopping list"
- Recipes: "What can I cook?" → suggest 2-3 recipes from available items
- Summary: "How many items?", "Compare homes"

## Rules:
1. ONE home → use it automatically. MULTIPLE homes + not specified → needsMoreInfo=true
2. Default quantity: "1". Match stockType from categories or "Others"
3. Multiple items → separate action entries for each
4. spokenResponse: natural, friendly, concise (read aloud via TTS)
5. For delete: match product name case-insensitive, partial match OK
6. Batch ops: "remove all expired" → multiple actions
7. Context-aware: "the oil expired" + only one oil → match it
8. userTranscript MUST be the exact transcription of what user said

## Expiry Date Rules:
- If user says "today expiry" or "expires today" → set expiryDate to today's date (YYYY-MM-DD from Today field)
- If user says "expires tomorrow" → calculate tomorrow's date
- If user says "expires in 3 days" → calculate the date
- If user says "expiry Oct 15" → convert to YYYY-MM-DD
- If no expiry mentioned → set expiryDate to ""

## Output (JSON only, no markdown):
{
  "actions": [{"type":"add|delete|update_availability|query","product":"name or null","quantity":"1","stockType":"category","targetHome":"name or null","targetHomeId":null,"availability":"Yes|No","expiryDate":"YYYY-MM-DD or empty string"}],
  "needsMoreInfo": false,
  "spokenResponse": "Done! Added eggs to Medavakkam.",
  "userTranscript": "Add eggs to Medavakkam",
  "followUpQuestion": null
}`;

// ─── Retry helper ───
async function fetchWithRetry(url, options, maxRetries = 1) {
  const RETRYABLE = [429, 500, 503, 529];
  let response;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    response = await fetch(url, options);
    if (response.ok || !RETRYABLE.includes(response.status) || attempt === maxRetries) return response;
    // Backoff: longer for 429 rate limits
    const delayMs = response.status === 429 ? 2000 * Math.pow(2, attempt) : 1000 * Math.pow(2, attempt);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return response;
}

// Statuses that should trigger fallback to the next provider (not fatal)
const PROVIDER_FALLBACK_STATUSES = [429, 403, 404, 500, 503, 529];

// Model fallback lists (updated 2026-09: Groq frequently rotates free-tier models)
const GROQ_LLM_FALLBACKS = [
  'llama-3.3-70b-versatile',
  'llama-3.3-70b-specdec',
  'llama-3.1-70b-versatile',
  'llama-3.1-8b-instant',
  'llama3-70b-8192',
  'llama3-8b-8192',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'compound-beta',
  'compound-beta-mini',
  'gemma2-9b-it',
  'mixtral-8x7b-32768',
];
const GROQ_WHISPER_FALLBACKS = ['whisper-large-v3-turbo', 'whisper-large-v3', 'distil-whisper-large-v3-en'];

/**
 * Discover available Groq models dynamically.
 * Falls back to the static list if the API call fails.
 */
async function discoverGroqModels(apiKey, type = 'llm') {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (data && data.data && Array.isArray(data.data)) {
      if (type === 'whisper') {
        const whisperModels = data.data
          .filter(m => m.id && m.id.includes('whisper'))
          .map(m => m.id);
        console.log(`[voice-command] Groq whisper models: ${whisperModels.join(', ')}`);
        return whisperModels.length > 0 ? whisperModels : null;
      }
      // Filter for chat-capable models
      const chatModels = data.data
        .filter(m => m.id && !m.id.includes('whisper') && !m.id.includes('tts') && !m.id.includes('guard'))
        .map(m => m.id);
      console.log(`[voice-command] Groq LLM models: ${chatModels.join(', ')}`);
      return chatModels.length > 0 ? chatModels : null;
    }
    return null;
  } catch (err) {
    console.warn('[voice-command] Failed to discover Groq models:', err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// GROQ: Speech-to-Text via Whisper API
// ═══════════════════════════════════════════════════════════════
async function groqTranscribeAudio(provider, audioBase64, mimeType) {
  const audioBuffer = Buffer.from(audioBase64, 'base64');
  const extMap = { 'audio/webm': 'webm', 'audio/mp4': 'mp4', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/flac': 'flac' };
  const ext = extMap[mimeType] || extMap[mimeType.split(';')[0]] || 'webm';
  const filename = `audio.${ext}`;
  const boundary = '----FormBoundary' + Date.now().toString(36) + Math.random().toString(36).slice(2);

  // Try dynamic discovery for whisper models, fall back to static list
  const discoveredWhisper = await discoverGroqModels(provider.key, 'whisper');
  const modelsToTry = discoveredWhisper
    ? discoveredWhisper
    : [provider.whisperModel, ...GROQ_WHISPER_FALLBACKS.filter(m => m !== provider.whisperModel)];

  for (const model of modelsToTry) {
    const bodyBuffer = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType.split(';')[0]}\r\n\r\n`, 'utf-8'),
      audioBuffer,
      Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\n${model}\r\n`, 'utf-8'),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\njson\r\n`, 'utf-8'),
      Buffer.from(`--${boundary}--\r\n`, 'utf-8'),
    ]);

    const response = await fetch(`${provider.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${provider.key}`, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: bodyBuffer,
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`[voice-command] Whisper (${model}) OK: "${(data.text || '').substring(0, 50)}..."`);
      return data.text || '';
    }

    const errText = await response.text();
    if (response.status === 400 || response.status === 404) {
      console.warn(`[voice-command] Whisper model "${model}" unavailable: ${errText.substring(0, 80)}`);
      continue;
    }
    // For rate limit (429) or server errors — tag as retryable
    if (PROVIDER_FALLBACK_STATUSES.includes(response.status)) {
      const err = new Error(`Whisper ${response.status}: ${errText.substring(0, 120)}`);
      err.retryable = true;
      throw err;
    }
    throw new Error(`Whisper ${response.status}: ${errText.substring(0, 120)}`);
  }
  const err = new Error('All Groq Whisper models unavailable');
  err.retryable = true;
  throw err;
}

// ═══════════════════════════════════════════════════════════════
// GROQ: LLM Command Processing
// ═══════════════════════════════════════════════════════════════
async function groqProcessCommand(provider, transcript, contextText, conversationHistory) {
  const messages = [{ role: 'system', content: VOICE_COMMAND_SYSTEM_PROMPT }];

  if (conversationHistory && conversationHistory.length > 0) {
    for (const msg of conversationHistory.slice(-4)) {
      messages.push({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.text });
    }
  }

  messages.push({
    role: 'user',
    content: `User said: "${transcript}"\n\n${contextText}\n\nProcess this and return JSON. Set "userTranscript" to: "${transcript}"`
  });

  // Try dynamic discovery for LLM models, fall back to static list
  const discoveredLLM = await discoverGroqModels(provider.key, 'llm');
  const modelsToTry = discoveredLLM
    ? discoveredLLM
    : [provider.llmModel, ...GROQ_LLM_FALLBACKS.filter(m => m !== provider.llmModel)];

  for (const model of modelsToTry) {
    const response = await fetchWithRetry(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${provider.key}` },
      body: JSON.stringify({ model, messages, max_tokens: 2048, temperature: 0.3, response_format: { type: 'json_object' } })
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`[voice-command] Groq LLM (${model}) OK`);
      return data.choices?.[0]?.message?.content || null;
    }

    const errText = await response.text();
    if (response.status === 400 || response.status === 404) {
      console.warn(`[voice-command] Groq LLM "${model}" unavailable: ${errText.substring(0, 80)}`);
      continue;
    }
    // For rate limit (429) or server errors — tag as retryable so outer loop
    // can fall through to the next PROVIDER (e.g. Gemini)
    if (PROVIDER_FALLBACK_STATUSES.includes(response.status)) {
      const err = new Error(`Groq LLM ${response.status}: ${errText.substring(0, 120)}`);
      err.retryable = true;
      throw err;
    }
    throw new Error(`Groq LLM ${response.status}: ${errText.substring(0, 120)}`);
  }
  const err = new Error('All Groq LLM models unavailable');
  err.retryable = true;
  throw err;
}

/**
 * Discover available Gemini models dynamically.
 */
async function discoverGeminiModel(provider) {
  try {
    const response = await fetch(`${provider.baseUrl}/models?key=${provider.key}`);
    if (!response.ok) return null;
    const data = await response.json();
    if (data && data.models && Array.isArray(data.models)) {
      const models = data.models
        .filter(m => m.name && m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
        .map(m => m.name.replace('models/', ''));
      const flashModel = models.find(m => m.includes('flash') && !m.includes('thinking'));
      const proModel = models.find(m => m.includes('pro'));
      const chosen = flashModel || proModel || models[0];
      console.log(`[voice-command] Gemini discovered models: ${models.slice(0, 8).join(', ')}... | Chosen: ${chosen}`);
      return chosen || null;
    }
    return null;
  } catch (err) {
    console.warn('[voice-command] Failed to discover Gemini models:', err.message);
    return null;
  }
}

// Helper: make a Gemini generateContent call with auto-discovery on 404
async function callGeminiWithDiscovery(provider, requestBody) {
  let modelToUse = provider.model;
  let apiUrl = `${provider.baseUrl}/models/${modelToUse}:generateContent?key=${provider.key}`;

  let response = await fetchWithRetry(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  // If model not found, discover and retry
  if (!response.ok && response.status === 404) {
    console.warn(`[voice-command] Gemini model "${modelToUse}" not found. Discovering...`);
    const discovered = await discoverGeminiModel(provider);
    if (discovered && discovered !== modelToUse) {
      modelToUse = discovered;
      apiUrl = `${provider.baseUrl}/models/${modelToUse}:generateContent?key=${provider.key}`;
      console.log(`[voice-command] Retrying with: ${modelToUse}`);
      response = await fetchWithRetry(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
    }
  }

  if (!response.ok) {
    const errText = await response.text();
    const errMsg = `Gemini ${response.status} (${modelToUse}): ${errText.substring(0, 120)}`;
    if (PROVIDER_FALLBACK_STATUSES.includes(response.status)) {
      const err = new Error(errMsg);
      err.retryable = true;
      throw err;
    }
    throw new Error(errMsg);
  }

  return response;
}

// ═══════════════════════════════════════════════════════════════
// GEMINI: Multimodal audio processing (fallback)
// ═══════════════════════════════════════════════════════════════
async function geminiProcessAudio(provider, audioBase64, audioMime, contextText, conversationHistory) {
  const geminiContents = [];

  if (conversationHistory && conversationHistory.length > 0) {
    for (const msg of conversationHistory.slice(-4)) {
      geminiContents.push({ role: msg.role === 'assistant' ? 'model' : 'user', parts: [{ text: msg.text }] });
    }
  }

  geminiContents.push({
    role: 'user',
    parts: [
      { inlineData: { mimeType: audioMime, data: audioBase64 } },
      { text: contextText + '\n\nProcess the audio command above and return JSON.' }
    ]
  });

  const response = await callGeminiWithDiscovery(provider, {
    contents: geminiContents,
    generationConfig: { maxOutputTokens: 2048, temperature: 0.3, responseMimeType: "application/json" },
    systemInstruction: { parts: [{ text: VOICE_COMMAND_SYSTEM_PROMPT }] }
  });

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Invalid Gemini response — no text in candidate');
  return text;
}

// ═══════════════════════════════════════════════════════════════
// GEMINI: Text-only processing (fallback for text input)
// ═══════════════════════════════════════════════════════════════
async function geminiProcessText(provider, userText, contextText, conversationHistory) {
  const geminiContents = [];

  if (conversationHistory && conversationHistory.length > 0) {
    for (const msg of conversationHistory.slice(-4)) {
      geminiContents.push({ role: msg.role === 'assistant' ? 'model' : 'user', parts: [{ text: msg.text }] });
    }
  }

  geminiContents.push({
    role: 'user',
    parts: [{ text: `User command: "${userText}"\n\n${contextText}\n\nProcess and return JSON. Set "userTranscript" to the exact text.` }]
  });

  const response = await callGeminiWithDiscovery(provider, {
    contents: geminiContents,
    generationConfig: { maxOutputTokens: 2048, temperature: 0.3, responseMimeType: "application/json" },
    systemInstruction: { parts: [{ text: VOICE_COMMAND_SYSTEM_PROMPT }] }
  });

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Invalid Gemini response — no text');
  return text;
}

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════
exports.handler = async (event) => {
  const origin = getOriginHeader(event);
  const headers = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  // Auth
  const { user, error: authError } = await verifyAuth(event);
  if (authError) return { statusCode: 401, headers, body: JSON.stringify({ error: authError }) };

  // Rate limit (20 voice commands/hour)
  const { allowed, remaining, resetIn } = checkRateLimit(user.id, 20, 60 * 60 * 1000);
  if (!allowed) {
    const resetMinutes = Math.ceil(resetIn / 60000);
    return {
      statusCode: 429,
      headers: { ...headers, 'Retry-After': String(Math.ceil(resetIn / 1000)) },
      body: JSON.stringify({
        actions: [], needsMoreInfo: true,
        spokenResponse: `Too many voice commands. Wait ${resetMinutes} minutes.`,
        followUpQuestion: null
      })
    };
  }

  // Input validation
  const { valid, error: validationError } = validatePayload(event, 5 * 1024 * 1024);
  if (!valid) return { statusCode: 400, headers, body: JSON.stringify({ error: validationError }) };

  const body = JSON.parse(event.body || '{}');
  const { audio, text, mimeType, homes, conversationHistory, catalogCategories } = body;

  if (!audio && !text) return { statusCode: 400, headers, body: JSON.stringify({ error: 'No audio or text provided.' }) };

  const audioMime = mimeType || 'audio/webm';
  if (audio && !audioMime.startsWith('audio/')) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid audio MIME type.' }) };
  if (homes && homes.length > 50) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Too many homes.' }) };

  if (PROVIDER_CHAIN.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'No AI provider configured. Set GROQ_API_KEY or GEMINI_API_KEY_PRIMARY.' }) };
  }

  try {
    // Build context
    const today = new Date().toISOString().split('T')[0];
    let contextText = `Today: ${today}\n`;
    if (homes && homes.length > 0) {
      contextText += `Homes (${homes.length}):\n`;
      for (const home of homes) {
        contextText += `- ${home.name} (ID:${home.id}): `;
        if (home.products && home.products.length > 0) {
          contextText += home.products.map(p =>
            `${p.product || '?'}[qty:${p.quantity || '?'},avail:${p.availability || '?'}${p.expiryDate ? ',exp:' + p.expiryDate : ''}]`
          ).join(', ');
        } else {
          contextText += '(empty)';
        }
        contextText += '\n';
      }
    } else {
      contextText += 'No homes yet.\n';
    }
    if (catalogCategories && catalogCategories.length > 0) {
      contextText += `Categories: ${catalogCategories.map(c => c.name || c).join(', ')}\n`;
    }

    // ─── TEXT INPUT (no Whisper needed) ───
    if (text && !audio) {
      for (let i = 0; i < PROVIDER_CHAIN.length; i++) {
        const provider = PROVIDER_CHAIN[i];
        const isLast = (i === PROVIDER_CHAIN.length - 1);
        try {
          let responseText;
          if (provider.provider === 'groq') {
            responseText = await groqProcessCommand(provider, text, contextText, conversationHistory);
          } else {
            responseText = await geminiProcessText(provider, text, contextText, conversationHistory);
          }
          if (!responseText) { if (!isLast) continue; }
          const jsonMatch = (responseText || '').match(/(\{.*\})/s);
          const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
          if (!parsed.userTranscript) parsed.userTranscript = text;
          console.log(`[voice-command] Text OK via ${provider.label} | User: ${user.email}`);
          return { statusCode: 200, headers, body: JSON.stringify(parsed) };
        } catch (err) {
          console.warn(`[voice-command] ${provider.label} text failed (retryable=${!!err.retryable}):`, err.message);
          if (!isLast) {
            console.log(`[voice-command] Falling back to next provider...`);
            continue;
          }
          break;
        }
      }
      const isRateLimit = true; // If we got here, all providers failed
      return { statusCode: 200, headers, body: JSON.stringify({ actions: [], needsMoreInfo: true, spokenResponse: 'All AI services are temporarily unavailable. Please try again in a few seconds.', userTranscript: text, followUpQuestion: null }) };
    }

    // ─── AUDIO INPUT (Groq Whisper+LLM primary, Gemini multimodal fallback) ───
    for (let i = 0; i < PROVIDER_CHAIN.length; i++) {
      const provider = PROVIDER_CHAIN[i];
      const isLast = (i === PROVIDER_CHAIN.length - 1);

      try {
        let responseText;

        if (provider.provider === 'groq') {
          // GROQ: 2-step (Whisper STT → LLM)
          console.log(`[voice-command] User: ${user.email} | Trying ${provider.label} | Remaining: ${remaining}`);

          const transcript = await groqTranscribeAudio(provider, audio, audioMime);
          if (!transcript || !transcript.trim()) {
            console.warn(`[voice-command] Whisper empty transcript`);
            if (!isLast) continue;
            return { statusCode: 200, headers, body: JSON.stringify({ actions: [], needsMoreInfo: true, spokenResponse: 'Could not hear anything. Please try again.', userTranscript: '', followUpQuestion: null }) };
          }

          responseText = await groqProcessCommand(provider, transcript, contextText, conversationHistory);
        } else {
          // GEMINI: 1-step multimodal (audio direct)
          console.log(`[voice-command] User: ${user.email} | Trying ${provider.label} (multimodal) | Remaining: ${remaining}`);
          responseText = await geminiProcessAudio(provider, audio, audioMime, contextText, conversationHistory);
        }

        if (!responseText) {
          if (!isLast) continue;
          return { statusCode: 200, headers, body: JSON.stringify({ actions: [], needsMoreInfo: true, spokenResponse: 'Could not understand. Please repeat.', userTranscript: '', followUpQuestion: null }) };
        }

        // Parse JSON
        const jsonMatch = responseText.match(/(\{.*\})/s);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);

        console.log(`[voice-command] Audio OK via ${provider.label} | User: ${user.email}`);
        return { statusCode: 200, headers, body: JSON.stringify(parsed) };

      } catch (err) {
        console.warn(`[voice-command] ${provider.label} audio failed (retryable=${!!err.retryable}):`, err.message);
        if (isLast) {
          // All providers exhausted
          const isRateLimit = err.message.includes('429');
          return { statusCode: 200, headers, body: JSON.stringify({ actions: [], needsMoreInfo: true, spokenResponse: isRateLimit ? 'AI rate limit reached. Please wait a minute and try again.' : 'All AI services are temporarily unavailable. Please try again in a few seconds.', userTranscript: '', followUpQuestion: null }) };
        }
        console.log(`[voice-command] Falling back to next provider...`);
      }
    }

    // Should not reach here, but safety net
    return { statusCode: 200, headers, body: JSON.stringify({ actions: [], needsMoreInfo: true, spokenResponse: 'Something went wrong. Please try again.', userTranscript: '', followUpQuestion: null }) };

  } catch (error) {
    console.error("[voice-command] Fatal error:", error);
    return { statusCode: 200, headers, body: JSON.stringify({ actions: [], needsMoreInfo: true, spokenResponse: 'Sorry, something went wrong. Please try again.', userTranscript: text || '', followUpQuestion: null }) };
  }
};
