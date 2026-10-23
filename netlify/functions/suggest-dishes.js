// Netlify Serverless Function: suggest-dishes.js
//
// On-demand API endpoint for AI-powered dish suggestions.
// Uses the EXACT same Groq/Gemini calling pattern as text-command.js
//
// SECURITY: Requires authenticated user (JWT), rate-limited (10 req/hour)

try { require('dotenv').config(); } catch (e) {}

const { verifyAuth, checkRateLimit, getOriginHeader, validatePayload } = require('./auth-helper');
const { getGroqModels, getGeminiModel, PROVIDER_FALLBACK_STATUSES } = require('./ai-models');

// ─── AI Provider Chain (same as text-command.js) ───
function buildProviderChain() {
  const chain = [];

  // Gemini Primary (tried first — same order as text-command.js)
  if (process.env.GEMINI_API_KEY_PRIMARY) {
    chain.push({
      provider: 'gemini',
      key: process.env.GEMINI_API_KEY_PRIMARY,
      model: process.env.GEMINI_MODEL_PRIMARY || process.env.GEMINI_MODEL || 'gemini-3.8-flash',
      baseUrl: process.env.GEMINI_BASE_URL_PRIMARY || 'https://generativelanguage.googleapis.com/v1beta',
      label: 'Gemini Primary',
    });
  }

  // Groq (free tier)
  if (process.env.GROQ_API_KEY) {
    chain.push({
      provider: 'groq',
      key: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
      baseUrl: 'https://api.groq.com/openai/v1',
      label: 'Groq',
    });
  }

  // Gemini Fallback
  if (process.env.GEMINI_API_KEY_FALLBACK) {
    chain.push({
      provider: 'gemini',
      key: process.env.GEMINI_API_KEY_FALLBACK,
      model: process.env.GEMINI_MODEL_FALLBACK || 'gemini-3.8-flash',
      baseUrl: process.env.GEMINI_BASE_URL_FALLBACK || 'https://generativelanguage.googleapis.com/v1beta',
      label: 'Gemini Fallback',
    });
  }

  // Legacy single Gemini key
  if (process.env.GEMINI_API_KEY && !chain.some(c => c.key === process.env.GEMINI_API_KEY)) {
    chain.push({
      provider: 'gemini',
      key: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
      baseUrl: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
      label: 'Gemini Legacy',
    });
  }

  return chain;
}

const PROVIDER_CHAIN = buildProviderChain();

// ─── System prompt for dish suggestions ───
const DISH_SYSTEM_PROMPT = `You are a helpful cooking assistant. Given a list of available food ingredients, suggest 5-8 dishes.

Rules:
- Only suggest dishes primarily made with the listed ingredients
- Mix of quick/easy and elaborate dishes
- Prefer Indian cuisine but include others if ingredients match
- For each dish, list which ingredients it uses
- Rate ingredient match 0-100
- Include a short cooking tip (1 line summary)
- Include detailed step-by-step cooking instructions (4-8 clear numbered steps)
- Each step should be concise but actionable (e.g. "Heat oil in a pan, add mustard seeds and let them splutter")
- Include prep time estimate

Respond with ONLY valid JSON:
{"dishes":[{"name":"Dish Name","emoji":"🍛","category":"Breakfast|Main Course|Snack|Side Dish|Beverage|Dessert","ingredients_used":["item1","item2"],"match_score":85,"quick_tip":"Short 1-line summary","prep_time":"15 mins","steps":["Step 1: Do this","Step 2: Do that","Step 3: Then this"]}]}`;

// ─── Retry helper (same as text-command.js) ───
async function fetchWithRetry(url, options, maxRetries = 1) {
  const RETRYABLE = [429, 500, 503, 529];
  let response;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    response = await fetch(url, options);
    if (response.ok || !RETRYABLE.includes(response.status) || attempt === maxRetries) return response;
    const delayMs = response.status === 429 ? 2000 * Math.pow(2, attempt) : 1000 * Math.pow(2, attempt);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return response;
}

// Model discovery is handled by shared ai-models.js utility

// ─── Call Gemini (same pattern as text-command.js) ───
async function callGemini(provider, userMessage) {
  const requestBody = {
    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.7,
      responseMimeType: 'application/json',
    },
    systemInstruction: { parts: [{ text: DISH_SYSTEM_PROMPT }] },
  };

  let modelToUse = provider.model;
  let apiUrl = `${provider.baseUrl}/models/${modelToUse}:generateContent?key=${provider.key}`;

  console.log(`[suggest-dishes] Trying ${provider.label} (${modelToUse})`);

  let response = await fetchWithRetry(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  // If model not found, discover available models
  if (!response.ok && response.status === 404) {
    console.warn(`[suggest-dishes] Gemini model "${modelToUse}" not found. Discovering...`);
    const discoveredModel = await getGeminiModel(provider);
    if (discoveredModel && discoveredModel !== modelToUse) {
      modelToUse = discoveredModel;
      apiUrl = `${provider.baseUrl}/models/${modelToUse}:generateContent?key=${provider.key}`;
      console.log(`[suggest-dishes] Retrying with discovered model: ${modelToUse}`);
      response = await fetchWithRetry(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
    }
  }

  if (!response.ok) {
    const errText = await response.text();
    const errMsg = `Gemini ${response.status} (${modelToUse}): ${errText.substring(0, 200)}`;
    console.warn(`[suggest-dishes] ${errMsg}`);
    if (PROVIDER_FALLBACK_STATUSES.includes(response.status)) {
      const err = new Error(errMsg);
      err.retryable = true;
      throw err;
    }
    throw new Error(errMsg);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (content) {
    console.log(`[suggest-dishes] ${provider.label} succeeded (${content.length} chars)`);
  }
  return content || null;
}

// ─── Call Groq (same pattern as text-command.js) ───
async function callGroq(provider, userMessage) {
  const messages = [
    { role: 'system', content: DISH_SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ];

  const modelsToTry = await getGroqModels(provider.key);

  for (const model of modelsToTry) {
    console.log(`[suggest-dishes] Trying Groq model: ${model}`);
    const response = await fetchWithRetry(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.key}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 2048,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`[suggest-dishes] Groq success with model: ${model}`);
      return data.choices?.[0]?.message?.content || null;
    }

    const errText = await response.text();
    if (response.status === 400 || response.status === 404) {
      console.warn(`[suggest-dishes] Groq model "${model}" unavailable, trying next...`);
      continue;
    }

    if (PROVIDER_FALLBACK_STATUSES.includes(response.status)) {
      const err = new Error(`Groq ${response.status}: ${errText.substring(0, 100)}`);
      err.retryable = true;
      throw err;
    }

    throw new Error(`Groq ${response.status}: ${errText.substring(0, 100)}`);
  }

  const err = new Error('All Groq models unavailable');
  err.retryable = true;
  throw err;
}

// ─── Parse AI response ───
function parseAIResponse(rawContent) {
  try {
    const cleaned = rawContent.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.dishes && Array.isArray(parsed.dishes) && parsed.dishes.length > 0) {
      return parsed.dishes.map(d => ({
        name: d.name || 'Unknown Dish',
        emoji: d.emoji || '🍽️',
        category: d.category || 'Main Course',
        ingredients_used: Array.isArray(d.ingredients_used) ? d.ingredients_used : [],
        match_score: typeof d.match_score === 'number' ? Math.min(100, Math.max(0, d.match_score)) : 50,
        quick_tip: d.quick_tip || '',
        prep_time: d.prep_time || '',
        steps: Array.isArray(d.steps) ? d.steps : [],
      }));
    }
    console.warn('[suggest-dishes] Parsed but no dishes:', JSON.stringify(parsed).substring(0, 200));
    return null;
  } catch (err) {
    console.warn(`[suggest-dishes] JSON parse error: ${err.message}`);
    console.warn(`[suggest-dishes] Raw: ${rawContent.substring(0, 300)}`);
    return null;
  }
}

// ─── Main Handler ───
exports.handler = async (event) => {
  const origin = getOriginHeader(event);
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { user, error: authError } = await verifyAuth(event);
  if (authError) {
    return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: authError }) };
  }

  const { allowed, remaining } = checkRateLimit(user.id, 10, 60 * 60 * 1000);
  if (!allowed) {
    return { statusCode: 429, headers: corsHeaders, body: JSON.stringify({ error: 'Too many requests. Try again later.' }) };
  }

  const { valid, error: validError } = validatePayload(event, 50 * 1024);
  if (!valid) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: validError }) };
  }

  try {
    const body = JSON.parse(event.body);
    const items = body.items;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing or empty "items" array.' }) };
    }

    const sanitizedItems = items.slice(0, 50).map(i => String(i).trim().substring(0, 100)).filter(Boolean);
    if (sanitizedItems.length === 0) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'No valid items.' }) };
    }

    if (PROVIDER_CHAIN.length === 0) {
      console.error('[suggest-dishes] No AI providers! Check env vars.');
      return { statusCode: 503, headers: corsHeaders, body: JSON.stringify({ error: 'No AI providers configured.' }) };
    }

    console.log(`[suggest-dishes] User: ${user.email} | Items: ${sanitizedItems.join(', ')} | Providers: ${PROVIDER_CHAIN.map(p => p.label).join(' → ')}`);

    const hour = new Date().getHours();
    const mealContext = hour < 11 ? 'Morning/Breakfast' : hour < 16 ? 'Lunch' : 'Evening/Dinner';
    const userMessage = `Available ingredients: ${sanitizedItems.join(', ')}\nMeal context: ${mealContext}\n\nSuggest dishes I can make.`;

    // Try each provider (same pattern as text-command.js)
    for (let i = 0; i < PROVIDER_CHAIN.length; i++) {
      const provider = PROVIDER_CHAIN[i];
      const isLastProvider = (i === PROVIDER_CHAIN.length - 1);

      try {
        let rawContent = null;

        if (provider.provider === 'gemini') {
          rawContent = await callGemini(provider, userMessage);
        } else if (provider.provider === 'groq') {
          rawContent = await callGroq(provider, userMessage);
        }

        if (!rawContent) {
          if (!isLastProvider) continue;
          return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: 'AI returned empty response.' }) };
        }

        const dishes = parseAIResponse(rawContent);
        if (dishes) {
          return {
            statusCode: 200,
            headers: { ...corsHeaders, 'X-RateLimit-Remaining': String(remaining) },
            body: JSON.stringify({ dishes, provider: provider.label, generated_at: new Date().toISOString() }),
          };
        }

        // Parsed but no dishes — try next provider
        if (!isLastProvider) continue;
        return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: 'AI response could not be parsed.' }) };

      } catch (providerError) {
        console.warn(`[suggest-dishes] ${provider.label} failed:`, providerError.message);
        if (!isLastProvider) continue;
        return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: 'AI providers unavailable. Try again later.' }) };
      }
    }

    return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: 'All AI providers failed.' }) };
  } catch (err) {
    console.error('[suggest-dishes] Error:', err);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Internal server error.' }) };
  }
};
