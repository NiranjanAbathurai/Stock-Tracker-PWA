// Netlify Serverless Function: text-command.js
// Handles TEXT-based commands for the Stock Tracker PWA chatbot.
// Lighter than voice-command (no audio processing, smaller prompt, fewer tokens).
//
// SECURITY: Requires authenticated user (JWT), rate-limited, input-validated

try { require('dotenv').config(); } catch (e) {}

const { verifyAuth, checkRateLimit, getOriginHeader, validatePayload } = require('./auth-helper');

// Multi-key fallback
function buildKeyChain() {
  const chain = [];
  const usedKeys = new Set();

  if (process.env.GEMINI_API_KEY_PRIMARY) {
    chain.push({
      key: process.env.GEMINI_API_KEY_PRIMARY,
      model: process.env.GEMINI_MODEL_PRIMARY || 'gemini-2.0-flash',
      baseUrl: process.env.GEMINI_BASE_URL_PRIMARY || 'https://generativelanguage.googleapis.com/v1beta',
      label: 'Primary'
    });
    usedKeys.add(process.env.GEMINI_API_KEY_PRIMARY);
  }

  if (process.env.GEMINI_API_KEY_FALLBACK) {
    chain.push({
      key: process.env.GEMINI_API_KEY_FALLBACK,
      model: process.env.GEMINI_MODEL_FALLBACK || 'gemini-2.0-flash',
      baseUrl: process.env.GEMINI_BASE_URL_FALLBACK || 'https://generativelanguage.googleapis.com/v1beta',
      label: 'Fallback'
    });
    usedKeys.add(process.env.GEMINI_API_KEY_FALLBACK);
  }

  if (process.env.GEMINI_API_KEY && !usedKeys.has(process.env.GEMINI_API_KEY)) {
    chain.push({
      key: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
      baseUrl: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
      label: 'Legacy'
    });
  }

  return chain;
}

const GEMINI_KEYS = buildKeyChain();
const FALLBACK_STATUSES = [429, 403, 404, 503];

// Shorter system prompt for text commands (saves tokens!)
const TEXT_COMMAND_SYSTEM_PROMPT = `You are a stock tracker assistant. Process the user's text command to manage their home inventory.

## Actions:
1. **add** — Add product(s). E.g. "Add milk, eggs 6, rice 2kg"
2. **delete** — Remove product(s). E.g. "Remove milk"
3. **update_availability** — Mark as finished/available. E.g. "Milk is finished" or "Eggs are back"
4. **query** — Answer questions. E.g. "What's expiring?" or "Shopping list"

## Rules:
- Multiple items in one command → create separate actions for each
- If only ONE home exists, use it automatically
- If multiple homes and not specified, set needsMoreInfo=true
- Default quantity: "1". Match stockType from categories or use "Others"
- For "finished/over/done/empty" → update_availability with availability="No"
- For "back/restocked/bought" → update_availability with availability="Yes"
- Product names in actions must be in English
- spokenResponse should be short and friendly

## Output (JSON only, no markdown):
{
  "actions": [{ "type": "add|delete|update_availability|query", "product": "name", "quantity": "1", "stockType": "category", "targetHome": "home name or null", "targetHomeId": null, "availability": "Yes|No" }],
  "needsMoreInfo": false,
  "spokenResponse": "Done! Added 3 items.",
  "userTranscript": "the exact text user typed",
  "followUpQuestion": null
}`;

async function fetchWithRetry(url, options, maxRetries = 1) {
  const RETRYABLE = [500, 503, 529];
  let response;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    response = await fetch(url, options);
    if (response.ok || !RETRYABLE.includes(response.status) || attempt === maxRetries) {
      return response;
    }
    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
  }
  return response;
}

exports.handler = async (event) => {
  const origin = getOriginHeader(event);
  const headers = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Auth check
  const { user, error: authError } = await verifyAuth(event);
  if (authError) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: authError }) };
  }

  // Rate limit (40 text commands per hour — more generous than voice since it's cheaper)
  const { allowed, remaining, resetIn } = checkRateLimit(`txt-${user.id}`, 40, 60 * 60 * 1000);
  if (!allowed) {
    const resetMinutes = Math.ceil(resetIn / 60000);
    return {
      statusCode: 429,
      headers,
      body: JSON.stringify({
        actions: [],
        needsMoreInfo: true,
        spokenResponse: `Rate limit reached. Try again in ${resetMinutes} minutes.`,
        userTranscript: '',
        followUpQuestion: null
      })
    };
  }

  // Input validation
  const { valid, error: validationError } = validatePayload(event, 100 * 1024); // 100KB max for text
  if (!valid) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: validationError }) };
  }

  const body = JSON.parse(event.body || '{}');
  const { text, homes, conversationHistory, catalogCategories } = body;

  if (!text || !text.trim()) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'No text command provided.' }) };
  }

  if (GEMINI_KEYS.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'No Gemini API key configured.' }) };
  }

  try {
    // Build compact context (less tokens than voice-command)
    const today = new Date().toISOString().split('T')[0];
    let context = `Today: ${today}\n`;

    if (homes && homes.length > 0) {
      context += `Homes:\n`;
      for (const home of homes) {
        context += `- ${home.name} (ID:${home.id}): `;
        if (home.products && home.products.length > 0) {
          context += home.products.map(p =>
            `${p.product}[${p.quantity || '?'},${p.availability || '?'}${p.expiryDate ? ',exp:' + p.expiryDate : ''}]`
          ).join(', ');
        } else {
          context += '(empty)';
        }
        context += '\n';
      }
    }

    if (catalogCategories && catalogCategories.length > 0) {
      context += `Categories: ${catalogCategories.map(c => c.name || c).join(', ')}\n`;
    }

    // Build conversation
    const geminiContents = [];
    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory.slice(-4)) { // Only last 4 messages for text
        geminiContents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.text }]
        });
      }
    }

    geminiContents.push({
      role: 'user',
      parts: [{ text: `Command: "${text}"\n\n${context}\nProcess this and return JSON.` }]
    });

    // Try each key
    for (let i = 0; i < GEMINI_KEYS.length; i++) {
      const keyConfig = GEMINI_KEYS[i];
      const isLastKey = (i === GEMINI_KEYS.length - 1);

      const requestBody = {
        contents: geminiContents,
        generationConfig: {
          maxOutputTokens: 1024, // Less than voice (2048) — text responses are shorter
          temperature: 0.2,
          responseMimeType: "application/json",
        },
        systemInstruction: {
          parts: [{ text: TEXT_COMMAND_SYSTEM_PROMPT }]
        }
      };

      const apiUrl = `${keyConfig.baseUrl}/models/${keyConfig.model}:generateContent?key=${keyConfig.key}`;
      console.log(`[text-command] User: ${user.email} | ${keyConfig.label} | Remaining: ${remaining}`);

      const response = await fetchWithRetry(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.warn(`[text-command] ${keyConfig.label} failed (${response.status})`);

        if (FALLBACK_STATUSES.includes(response.status) && !isLastKey) {
          continue;
        }

        if (response.status === 503 || response.status === 429) {
          return {
            statusCode: 200, headers,
            body: JSON.stringify({
              actions: [], needsMoreInfo: true,
              spokenResponse: 'AI is busy. Try again in a few seconds.',
              userTranscript: text, followUpQuestion: null
            })
          };
        }
        return { statusCode: response.status, headers, body: JSON.stringify({ error: `AI Error: ${errorData}` }) };
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];

      if (!candidate?.content?.parts?.[0]?.text) {
        if (!isLastKey) continue;
        return {
          statusCode: 200, headers,
          body: JSON.stringify({
            actions: [], needsMoreInfo: true,
            spokenResponse: 'Could not understand. Please try again.',
            userTranscript: text, followUpQuestion: null
          })
        };
      }

      let jsonText = candidate.content.parts[0].text;
      const jsonMatch = jsonText.match(/(\{.*\})/s);
      if (jsonMatch) jsonText = jsonMatch[0];

      const parsedJson = JSON.parse(jsonText);
      // Ensure userTranscript is set
      if (!parsedJson.userTranscript) parsedJson.userTranscript = text;

      console.log(`[text-command] Success via ${keyConfig.label} for ${user.email}`);
      return { statusCode: 200, headers, body: JSON.stringify(parsedJson) };
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        actions: [], needsMoreInfo: true,
        spokenResponse: 'All AI services unavailable. Try again later.',
        userTranscript: text, followUpQuestion: null
      })
    };

  } catch (error) {
    console.error("[text-command] Error:", error);
    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        actions: [], needsMoreInfo: true,
        spokenResponse: 'Something went wrong. Please try again.',
        userTranscript: text, followUpQuestion: null
      })
    };
  }
};
