// Netlify Serverless Function: suggest-dishes.js
//
// On-demand API endpoint for AI-powered dish suggestions.
// Called by the frontend when:
//   1. No cached suggestions exist in Supabase (first load)
//   2. User manually refreshes suggestions
//
// SECURITY: Requires authenticated user (JWT), rate-limited (10 req/hour)
// AI PROVIDER CHAIN: Groq (free) → Gemini Primary → Gemini Fallback
// Token usage: ~150 input + ~200 output = ~350 tokens per call

try { require('dotenv').config(); } catch (e) {}

const { verifyAuth, checkRateLimit, getOriginHeader, validatePayload } = require('./auth-helper');

// ─── AI Provider Chain ───
function buildProviderChain() {
  const chain = [];

  if (process.env.GROQ_API_KEY) {
    chain.push({
      provider: 'groq',
      key: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      baseUrl: 'https://api.groq.com/openai/v1',
      label: 'Groq',
    });
  }

  if (process.env.GEMINI_API_KEY_PRIMARY) {
    chain.push({
      provider: 'gemini',
      key: process.env.GEMINI_API_KEY_PRIMARY,
      model: process.env.GEMINI_MODEL_PRIMARY || process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      baseUrl: process.env.GEMINI_BASE_URL_PRIMARY || 'https://generativelanguage.googleapis.com/v1beta',
      label: 'Gemini Primary',
    });
  }

  if (process.env.GEMINI_API_KEY_FALLBACK) {
    chain.push({
      provider: 'gemini',
      key: process.env.GEMINI_API_KEY_FALLBACK,
      model: process.env.GEMINI_MODEL_FALLBACK || 'gemini-2.5-flash',
      baseUrl: process.env.GEMINI_BASE_URL_FALLBACK || 'https://generativelanguage.googleapis.com/v1beta',
      label: 'Gemini Fallback',
    });
  }

  return chain;
}

const PROVIDER_CHAIN = buildProviderChain();
const PROVIDER_FALLBACK_STATUSES = [429, 403, 404, 500, 503, 529];

const GROQ_MODEL_FALLBACKS = [
  'llama-3.3-70b-versatile',
  'llama-3.3-70b-specdec',
  'llama-3.1-70b-versatile',
  'llama-3.1-8b-instant',
  'llama3-70b-8192',
  'llama3-8b-8192',
  'gemma2-9b-it',
  'mixtral-8x7b-32768',
];

// ─── AI Prompt ───
function buildPrompt(items) {
  const hour = new Date().getHours();
  const mealContext = hour < 11 ? 'Morning/Breakfast time' : hour < 16 ? 'Lunch time' : 'Evening/Dinner time';

  return `You are a helpful cooking assistant. Based on the available ingredients below, suggest 5-8 dishes that can be made.

## Available Ingredients:
${items.join(', ')}

## Meal Context: ${mealContext}

## Rules:
- Only suggest dishes that can be primarily made with the listed ingredients
- Include a mix of quick/easy and more elaborate dishes
- Prefer Indian cuisine but include other cuisines if ingredients match
- For each dish, mention which available ingredients it uses
- Rate how well the ingredients match (percentage)
- Include a short, helpful cooking tip for each dish

## Output (JSON only, no markdown fences):
{
  "dishes": [
    {
      "name": "Dish Name",
      "emoji": "🍛",
      "category": "Breakfast|Main Course|Snack|Side Dish|Beverage|Dessert",
      "ingredients_used": ["item1", "item2"],
      "match_score": 85,
      "quick_tip": "Short cooking tip or note"
    }
  ]
}`;
}

// ─── Groq API Call ───
async function callGroq(provider, prompt) {
  const modelsToTry = [provider.model, ...GROQ_MODEL_FALLBACKS.filter(m => m !== provider.model)];

  for (const model of modelsToTry) {
    try {
      const response = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${provider.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'You are a cooking assistant. Always respond with valid JSON only, no markdown.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 1024,
          response_format: { type: 'json_object' },
        }),
      });

      if (PROVIDER_FALLBACK_STATUSES.includes(response.status)) continue;
      if (!response.ok) continue;

      const data = await response.json();
      return data.choices?.[0]?.message?.content || null;
    } catch {
      continue;
    }
  }
  return null;
}

// ─── Gemini API Call ───
async function callGemini(provider, prompt) {
  try {
    const url = `${provider.baseUrl}/models/${provider.model}:generateContent?key=${provider.key}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch {
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

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Auth check
  const { user, error: authError } = await verifyAuth(event);
  if (authError) {
    return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: authError }) };
  }

  // Rate limit: 10 dish suggestion requests per hour
  const { allowed, remaining } = checkRateLimit(user.id, 10, 60 * 60 * 1000);
  if (!allowed) {
    return {
      statusCode: 429,
      headers: { ...corsHeaders, 'X-RateLimit-Remaining': '0' },
      body: JSON.stringify({ error: 'Too many requests. Try again later.' }),
    };
  }

  // Validate payload
  const { valid, error: validError } = validatePayload(event, 50 * 1024); // 50KB max
  if (!valid) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: validError }) };
  }

  try {
    const body = JSON.parse(event.body);
    const items = body.items;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing or empty "items" array.' }),
      };
    }

    // Cap at 50 items to prevent prompt injection / token abuse
    const sanitizedItems = items
      .slice(0, 50)
      .map(i => String(i).trim().substring(0, 100))
      .filter(Boolean);

    if (sanitizedItems.length === 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'No valid items provided.' }),
      };
    }

    if (PROVIDER_CHAIN.length === 0) {
      return {
        statusCode: 503,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'No AI providers configured.' }),
      };
    }

    // Call AI with provider chain
    const prompt = buildPrompt(sanitizedItems);
    let dishes = null;
    let usedProvider = null;

    for (const provider of PROVIDER_CHAIN) {
      let rawContent = null;

      if (provider.provider === 'groq') {
        rawContent = await callGroq(provider, prompt);
      } else if (provider.provider === 'gemini') {
        rawContent = await callGemini(provider, prompt);
      }

      if (!rawContent) continue;

      try {
        const cleaned = rawContent.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        const parsed = JSON.parse(cleaned);

        if (parsed.dishes && Array.isArray(parsed.dishes) && parsed.dishes.length > 0) {
          dishes = parsed.dishes.map(d => ({
            name: d.name || 'Unknown Dish',
            emoji: d.emoji || '🍽️',
            category: d.category || 'Main Course',
            ingredients_used: Array.isArray(d.ingredients_used) ? d.ingredients_used : [],
            match_score: typeof d.match_score === 'number' ? Math.min(100, Math.max(0, d.match_score)) : 50,
            quick_tip: d.quick_tip || '',
          }));
          usedProvider = provider.label;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!dishes) {
      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'AI providers unavailable. Try again later.' }),
      };
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'X-RateLimit-Remaining': String(remaining) },
      body: JSON.stringify({
        dishes,
        provider: usedProvider,
        generated_at: new Date().toISOString(),
      }),
    };
  } catch (err) {
    console.error('[suggest-dishes] Error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error.' }),
    };
  }
};
