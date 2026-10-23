// ai-models.js — Shared AI model discovery & selection utility
//
// Dynamically discovers available models from Groq and Gemini APIs at runtime.
// Uses in-memory caching (TTL-based) so repeated calls within the same Lambda
// invocation don't re-fetch. The static fallback lists are only used if the
// discovery API itself is unreachable.
//
// Usage:
//   const { getGroqModels, getGeminiModel, PROVIDER_FALLBACK_STATUSES } = require('./ai-models');
//   const models = await getGroqModels(apiKey);          // string[]
//   const model  = await getGeminiModel(provider);       // string | null

// ─── Cache ───
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes (covers a full cron run)
const cache = {
  groq: { models: null, ts: 0 },
  gemini: new Map(), // keyed by provider.key
};

// ─── Statuses that should trigger fallback to the next provider ───
const PROVIDER_FALLBACK_STATUSES = [429, 403, 404, 500, 503, 529];

// ─── Minimal static fallbacks (only used when discovery API is down) ───
const GROQ_STATIC_FALLBACKS = [
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'compound-beta',
  'compound-beta-mini',
  'llama-3.3-70b-versatile',
  'llama-3.3-70b-specdec',
  'llama-3.1-8b-instant',
];

const GROQ_WHISPER_STATIC_FALLBACKS = [
  'whisper-large-v3-turbo',
  'whisper-large-v3',
  'distil-whisper-large-v3-en',
];

// ─── Groq model discovery ───

/**
 * Discover available Groq models dynamically via the /models endpoint.
 * Returns an array of model IDs suitable for chat completions.
 * Falls back to the static list if the API call fails.
 *
 * @param {string} apiKey - Groq API key
 * @param {'llm'|'whisper'} [type='llm'] - Filter for LLM or Whisper models
 * @returns {Promise<string[]>} Array of model IDs to try, in order
 */
async function getGroqModels(apiKey, type = 'llm') {
  // Return cached result if fresh
  const now = Date.now();
  if (cache.groq.models && (now - cache.groq.ts) < CACHE_TTL_MS) {
    return filterGroqModels(cache.groq.models, type);
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      console.warn(`[ai-models] Groq /models returned ${response.status}, using static fallbacks`);
      return type === 'whisper' ? GROQ_WHISPER_STATIC_FALLBACKS : GROQ_STATIC_FALLBACKS;
    }

    const data = await response.json();
    if (data && data.data && Array.isArray(data.data)) {
      const allModels = data.data.map(m => m.id).filter(Boolean);
      cache.groq.models = allModels;
      cache.groq.ts = now;
      console.log(`[ai-models] Groq discovered ${allModels.length} models`);
      return filterGroqModels(allModels, type);
    }

    return type === 'whisper' ? GROQ_WHISPER_STATIC_FALLBACKS : GROQ_STATIC_FALLBACKS;
  } catch (err) {
    console.warn(`[ai-models] Groq model discovery failed: ${err.message}`);
    return type === 'whisper' ? GROQ_WHISPER_STATIC_FALLBACKS : GROQ_STATIC_FALLBACKS;
  }
}

/**
 * Filter discovered Groq models by type.
 * LLM models: exclude whisper, tts, guard models
 * Whisper models: only include whisper models
 */
function filterGroqModels(allModels, type) {
  if (type === 'whisper') {
    const whisperModels = allModels.filter(id => id.includes('whisper'));
    return whisperModels.length > 0 ? whisperModels : GROQ_WHISPER_STATIC_FALLBACKS;
  }

  // LLM: exclude non-chat models
  const llmModels = allModels.filter(id =>
    !id.includes('whisper') &&
    !id.includes('tts') &&
    !id.includes('guard')
  );
  return llmModels.length > 0 ? llmModels : GROQ_STATIC_FALLBACKS;
}

// ─── Gemini model discovery ───

/**
 * Discover the best available Gemini model for a given provider/key.
 * Prefers flash models (non-thinking), then pro, then any available.
 * Returns null if discovery fails entirely.
 *
 * @param {{ baseUrl: string, key: string }} provider - Gemini provider config
 * @returns {Promise<string|null>} Best model name or null
 */
async function getGeminiModel(provider) {
  const cacheKey = provider.key;
  const now = Date.now();
  const cached = cache.gemini.get(cacheKey);
  if (cached && (now - cached.ts) < CACHE_TTL_MS) {
    return cached.model;
  }

  try {
    const response = await fetch(`${provider.baseUrl}/models?key=${provider.key}`);
    if (!response.ok) {
      console.warn(`[ai-models] Gemini /models returned ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data || !data.models || !Array.isArray(data.models)) return null;

    const models = data.models
      .filter(m =>
        m.name &&
        m.supportedGenerationMethods &&
        m.supportedGenerationMethods.includes('generateContent')
      )
      .map(m => m.name.replace('models/', ''));

    // Prefer: newest flash (non-thinking) → pro → first available
    // Sort flash models by version number descending so we pick the newest
    const flashModels = models
      .filter(m => m.includes('flash') && !m.includes('thinking'))
      .sort((a, b) => {
        // Extract version numbers (e.g. "gemini-3.8-flash" → 3.8, "gemini-2.5-flash" → 2.5)
        const vA = parseFloat((a.match(/(\d+\.?\d*)-flash/) || [])[1]) || 0;
        const vB = parseFloat((b.match(/(\d+\.?\d*)-flash/) || [])[1]) || 0;
        return vB - vA; // Descending — newest first
      });
    const flashModel = flashModels[0] || null;
    const proModel = models.find(m => m.includes('pro'));
    const chosen = flashModel || proModel || models[0] || null;

    console.log(`[ai-models] Gemini discovered ${models.length} models → chosen: ${chosen}`);

    cache.gemini.set(cacheKey, { model: chosen, ts: now });
    return chosen;
  } catch (err) {
    console.warn(`[ai-models] Gemini model discovery failed: ${err.message}`);
    return null;
  }
}

// ─── Exports ───
module.exports = {
  getGroqModels,
  getGeminiModel,
  PROVIDER_FALLBACK_STATUSES,
  GROQ_STATIC_FALLBACKS,
  GROQ_WHISPER_STATIC_FALLBACKS,
};
