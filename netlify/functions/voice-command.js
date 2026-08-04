// Netlify Serverless Function: voice-command.js
// Handles voice commands for the Stock Tracker PWA
// Sends audio to Gemini AI and returns structured actions

try { require('dotenv').config(); } catch (e) {}

// Multi-key fallback configuration
// Priority: GEMINI_API_KEY_PRIMARY (Jio Pro) → GEMINI_API_KEY_FALLBACK (free tier from AI Studio)
// If only GEMINI_API_KEY is set (legacy), it will be used as the single key.
const GEMINI_KEYS = buildKeyChain();

function buildKeyChain() {
  const chain = [];
  const usedKeys = new Set();

  // Primary key (Jio Gemini Pro subscription)
  if (process.env.GEMINI_API_KEY_PRIMARY) {
    chain.push({
      key: process.env.GEMINI_API_KEY_PRIMARY,
      model: process.env.GEMINI_MODEL_PRIMARY || 'gemini-2.0-flash',
      baseUrl: process.env.GEMINI_BASE_URL_PRIMARY || 'https://generativelanguage.googleapis.com/v1beta',
      label: 'Primary'
    });
    usedKeys.add(process.env.GEMINI_API_KEY_PRIMARY);
  }

  // Fallback key (free Google AI Studio key)
  if (process.env.GEMINI_API_KEY_FALLBACK) {
    chain.push({
      key: process.env.GEMINI_API_KEY_FALLBACK,
      model: process.env.GEMINI_MODEL_FALLBACK || 'gemini-2.0-flash',
      baseUrl: process.env.GEMINI_BASE_URL_FALLBACK || 'https://generativelanguage.googleapis.com/v1beta',
      label: 'Fallback'
    });
    usedKeys.add(process.env.GEMINI_API_KEY_FALLBACK);
  }

  // Legacy key — always included as last resort (unless it's the same key already in the chain)
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

const VOICE_COMMAND_SYSTEM_PROMPT = `You are a smart voice assistant for a Stock Tracker app. Users speak commands to manage their grocery/household stock inventory AND ask intelligent questions about their stock.



## Language Support:
- You support these languages: **English**, **Tamil** (தமிழ்).
- Detect which language the user is speaking and respond in the SAME language.
- If the user speaks in Tamil, respond in **proper, natural Tamil** (தமிழ்). Write Tamil responses using Tamil script (Unicode), NOT transliterated English. Use natural spoken Tamil like a native Tamil speaker would — not formal/literary Tamil, but everyday conversational Tamil.
  - Example GOOD Tamil response: "சரி! முட்டை சேர்த்துவிட்டேன். இப்போ உங்க மேடவாக்கம் வீட்ல 6 முட்டை இருக்கு."
  - Example BAD Tamil response: "Done! Muttai add panniten." (This is Tanglish, not Tamil)
- If the user speaks in English, respond in English.
- If the user speaks in Tanglish (Tamil words in English script like "muttai add pannu"), respond in Tanglish the same way.
- If you cannot determine the language, default to English.
- The "userTranscript" field must be the exact transcription of what the user said (in whatever language/script they spoke).
- The "spokenResponse" field must be in the detected language using proper script (Tamil script for Tamil, English for English).
- However, the "product", "stockType", and "targetHome" fields in actions MUST always be in English for database consistency (translate if needed).

### Tamil Response Guidelines:
- Use everyday spoken Tamil (பேச்சு தமிழ்), not formal written Tamil (எழுத்து தமிழ்)
- Keep responses short and friendly — they will be read aloud
- Use Tamil numbers when natural (ஒரு, ரெண்டு) or digits (2 kg) as appropriate
- For product names that are commonly said in English (like "pasta", "coffee"), you can keep them in English within the Tamil sentence
- Example: "உங்க வீட்ல pasta இல்ல, shopping list-ல சேர்க்கலாம்!"

## Your Role:
Listen to the user's audio command and determine what action(s) they want to perform on their stock list, OR answer intelligent questions about their inventory.

## Available Actions:
1. **add** — Add a new product to a home's stock list
2. **delete** — Remove/delete a product from the list entirely
3. **update_availability** — Mark a product as unavailable (out of stock / finished) or available again
4. **query** — Answer a question about the user's stock (no data modification). Use this for informational requests.

## Query Intelligence (action type = "query"):
When the user asks questions about their stock, analyze their inventory data and provide helpful answers.

### Stock Lookup Queries:
- "Do I have maggi?" / "Do I have oil?" → Check if the product exists and its availability status
- "How much rice do I have?" → Check quantity of a specific product
- "Is paracetamol available?" → Check medicine availability
- "What medicines do I have?" → List all items in the Medicines/Health category
- "What's in my fridge?" / "Show me my groceries" → List products by category

### Expiry & Health Queries:
- "What's expiring soon?" → List products with expiry dates within the next 7 days
- "Any expired items?" → List items past their expiry date
- "Which medicines are expiring?" → List medicines near expiry (important for health!)
- "Is my milk still good?" → Check expiry date of a specific product

### Shopping & Restock Queries:
- "What do I need to buy?" / "What's out of stock?" → List all products marked as unavailable
- "Give me a shopping list" → Compile all out-of-stock items as a shopping list
- "What should I restock?" → Suggest items that are out of stock or low quantity

### Recipe & Cooking Suggestions:
- "What can I cook with what I have?" → Look at available food items (vegetables, grains, spices, oils, etc.) and suggest 2-3 simple recipes that can be made with those ingredients
- "What can I make for dinner?" → Suggest dinner recipes based on available stock
- "I have rice and dal, what can I cook?" → Suggest recipes using those specific items
- "Any quick meal ideas?" → Suggest quick recipes from available ingredients
- For recipe suggestions, consider Indian cooking (since the app supports Tamil) and suggest practical, everyday meals. Be creative but realistic — only suggest recipes where the user has most key ingredients available.

### Inventory Summary Queries:
- "How many items do I have?" → Count total products
- "Compare my homes" → Compare stock between homes
- "What's available in [category]?" → List available items in a specific category
- "What did I add recently?" → Mention recently added items if context allows

For query actions, provide a detailed, helpful spokenResponse with the answer. The actions array should contain one entry with type "query" and no product modifications.

## Context You Receive:
- The user's homes (with names and IDs)
- Current products in each home (with names, quantities, stock types, availability, and expiry dates)
- Catalog categories for proper categorization
- Today's date for expiry calculations

## Rules:
1. **Adding items** — Trigger "add" for phrases like:
   - "Add [item]", "I bought [item]", "Got [item]", "Picked up [item]", "We have [item] now", "Just got [item] from the store"
   
2. **Removing/Deleting items** — Trigger "delete" for phrases like:
   - "Remove [item]", "Delete [item]", "Take off [item]", "Remove expired medicines", "Clear out [item]", "Get rid of [item]"
   - "Remove all expired items" → delete all products that are past expiry date
   
3. **Marking as out of stock** — Trigger "update_availability" (availability = "No") for phrases like:
   - "We're out of [item]", "[item] is finished", "[item] is over", "Mark [item] as finished"
   - "No more [item]", "[item] got over", "Used up all the [item]", "[item] khatam ho gaya"
   - "Oil got expired" / "[item] expired" → mark as unavailable
   - "Sugar is done", "We ran out of [item]", "[item] is empty"
   
4. **Marking as available/restocked** — Trigger "update_availability" (availability = "Yes") for phrases like:
   - "[item] is back", "Restocked [item]", "Got [item] again", "We have [item] now"
   - "Bought more [item]", "[item] refilled"
   
5. If the user asks a QUESTION about their stock (what's expiring, what to buy, how much, do I have X, what can I cook, etc.) → action = "query"
6. If there is only ONE home, automatically use that home as the target.
7. If there are MULTIPLE homes and the user doesn't specify which one for a modification action, set needsMoreInfo = true and ask which home in your spokenResponse. For query actions, include data from ALL homes.
8. If you cannot understand the command, set needsMoreInfo = true and ask for clarification.
9. For quantity, if not specified, default to "1".
10. For stockType, try to match from the provided catalog categories. If unsure, use "Others".
11. The spokenResponse should be natural, friendly, and concise — it will be read aloud via text-to-speech.
12. When multiple items are mentioned, create separate action entries for each.
13. For delete actions, try to match the product name against existing products in the home (case-insensitive, partial match is fine).
14. For query responses, be specific with product names, quantities, and dates. Format lists clearly.
15. If the user asks "what should I buy" or "shopping list", compile ALL out-of-stock items across all homes into a clear list.
16. **Batch operations**: If user says "remove all expired items" or "mark all expired as finished", process ALL matching products (create multiple actions).
17. **Context-aware**: If user says "the oil expired" and there's only one oil product, match it automatically. If multiple oils exist, ask which one.

## Output Format:
You MUST return ONLY a valid JSON object (no markdown, no extra text). Structure:
{
  "actions": [
    {
      "type": "add | delete | update_availability | query",
      "product": "product name (null for query)",
      "quantity": "quantity string",
      "stockType": "category name",
      "targetHome": "home name or null",
      "targetHomeId": null,
      "availability": "Yes or No (only for update_availability)"
    }
  ],
  "needsMoreInfo": false,
  "spokenResponse": "Done! I have added eggs to Medavakkam.",
  "userTranscript": "Add eggs to Medavakkam",
  "followUpQuestion": null
}

## IMPORTANT:
- The "userTranscript" field MUST contain the exact text transcription of what the user said in the audio. This is critical for the chat UI.

## Examples:
### Modification Actions:
- User: "Add 2 kg rice" (1 home: "Medavakkam") → add rice, qty "2 kg", target Medavakkam
- User: "Remove milk" (1 home) → delete milk from that home
- User: "Eggs are finished" (1 home) → update_availability, availability "No"
- User: "Add bread" (2 homes) → needsMoreInfo true, ask which home
- User: "Add bread to Medavakkam" (2 homes) → add bread to Medavakkam

### Query Actions:
- User: "What's expiring soon?" → query, spokenResponse lists items expiring within 7 days
- User: "What do I need to buy?" → query, spokenResponse lists all out-of-stock items
- User: "Give me a shopping list" → query, spokenResponse is a formatted shopping list
- User: "How much rice do I have?" → query, spokenResponse tells the quantity of rice
- User: "Any expired items?" → query, spokenResponse lists items past expiry date
- User: "Do I have maggi?" → query, check if maggi exists in inventory and respond with its status/quantity
- User: "Do I have oil?" → query, check all oil products and list them with quantities
- User: "Is paracetamol available?" → query, check medicine availability and expiry
- User: "Which medicines are expiring?" → query, list medicines near or past expiry
- User: "What can I cook with what I have?" → query, look at available food items (rice, dal, vegetables, spices, oil, etc.) and suggest 2-3 practical recipes. Consider Indian cooking. Only suggest recipes where user has most key ingredients.
- User: "What can I make for dinner?" → query, suggest dinner recipes based on available ingredients
- User: "Any quick meal ideas?" → query, suggest quick recipes from available stock
`;

// Retry helper for transient errors (single attempt with retries)
async function fetchWithRetry(url, options, maxRetries = 1) {
  const RETRYABLE = [500, 503, 529];
  let response;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    response = await fetch(url, options);
    if (response.ok || !RETRYABLE.includes(response.status) || attempt === maxRetries) {
      return response;
    }
    const delayMs = 1000 * Math.pow(2, attempt);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return response;
}

// Statuses that indicate quota/rate limit exhaustion or model not found → should fallback to next key
const FALLBACK_STATUSES = [429, 403, 404, 503];

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const body = JSON.parse(event.body || '{}');
  const { audio, mimeType, homes, conversationHistory, catalogCategories } = body;

  if (!audio) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'No audio data provided.' }) };
  }

  if (GEMINI_KEYS.length === 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'No Gemini API key configured. Set GEMINI_API_KEY_PRIMARY or GEMINI_API_KEY_FALLBACK in environment variables.' })
    };
  }

  try {
    // Build context about the user's homes and products
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    let contextText = `## Current User Context:\n\n`;
    contextText += `**Today's Date:** ${today}\n\n`;
    contextText += `### Homes (${(homes || []).length}):\n`;
    if (homes && homes.length > 0) {
      for (const home of homes) {
        contextText += `- **${home.name}** (ID: ${home.id})\n`;
        if (home.products && home.products.length > 0) {
          contextText += `  Products:\n`;
          for (const p of home.products) {
            const expiryInfo = p.expiryDate ? `Expiry: ${p.expiryDate}` : 'Expiry: N/A';
            contextText += `    - ${p.product || '(unnamed)'} | Qty: ${p.quantity || 'N/A'} | Type: ${p.stockType || 'N/A'} | Available: ${p.availability || 'N/A'} | ${expiryInfo}\n`;
          }
        } else {
          contextText += `  (No products yet)\n`;
        }
      }
    } else {
      contextText += '(No homes created yet)\n';
    }

    if (catalogCategories && catalogCategories.length > 0) {
      contextText += `\n### Available Stock Categories:\n`;
      contextText += catalogCategories.map(c => c.name || c).join(', ') + '\n';
    }

    // Build conversation history for multi-turn
    const geminiContents = [];

    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory) {
        geminiContents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.text }]
        });
      }
    }

    // Add the current audio message
    const audioMime = mimeType || 'audio/webm';
    geminiContents.push({
      role: 'user',
      parts: [
        {
          inlineData: {
            mimeType: audioMime,
            data: audio
          }
        },
        { text: contextText + '\n\nPlease process the audio command above and return the JSON response.' }
      ]
    });

    // Try each key in the chain until one succeeds
    let lastError = null;
    let lastStatus = 500;

    for (let i = 0; i < GEMINI_KEYS.length; i++) {
      const keyConfig = GEMINI_KEYS[i];
      const isLastKey = (i === GEMINI_KEYS.length - 1);

      const requestBody = {
        contents: geminiContents,
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.3,
          responseMimeType: "application/json",
        },
        systemInstruction: {
          parts: [{ text: VOICE_COMMAND_SYSTEM_PROMPT }]
        }
      };

      const apiUrl = `${keyConfig.baseUrl}/models/${keyConfig.model}:generateContent?key=${keyConfig.key}`;

      console.log(`[voice-command] Trying ${keyConfig.label} (model: ${keyConfig.model})...`);

      const response = await fetchWithRetry(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.text();
        lastError = errorData;
        lastStatus = response.status;
        console.warn(`[voice-command] ${keyConfig.label} failed (${response.status}): ${errorData.substring(0, 200)}`);

        // If this is a quota/rate-limit error and we have more keys, try the next one
        if (FALLBACK_STATUSES.includes(response.status) && !isLastKey) {
          console.log(`[voice-command] Falling back to next key...`);
          continue;
        }

        // No more keys to try — return error
        if (response.status === 503 || response.status === 429) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              actions: [],
              needsMoreInfo: true,
              spokenResponse: 'The AI is busy right now. Please try again in a few seconds.',
              followUpQuestion: null
            })
          };
        }
        return {
          statusCode: response.status,
          headers,
          body: JSON.stringify({ error: `Gemini API Error: ${errorData}` })
        };
      }

      // Success! Parse the response
      const data = await response.json();
      const candidate = data.candidates && data.candidates[0];

      if (!candidate || !candidate.content || !candidate.content.parts[0] || !candidate.content.parts[0].text) {
        console.error("Invalid Gemini Response (voice):", JSON.stringify(data).substring(0, 300));
        // If invalid response but we have more keys, try next
        if (!isLastKey) {
          console.log(`[voice-command] Invalid response from ${keyConfig.label}, trying next key...`);
          continue;
        }
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            actions: [],
            needsMoreInfo: true,
            spokenResponse: 'Sorry, I could not understand that. Could you please repeat?',
            followUpQuestion: null
          })
        };
      }

      let jsonText = candidate.content.parts[0].text;

      // Defensive cleanup
      const jsonMatch = jsonText.match(/(\{.*\})/s);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      const parsedJson = JSON.parse(jsonText);
      console.log(`[voice-command] Success using ${keyConfig.label}`);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(parsedJson)
      };
    }

    // If we exhausted all keys without returning
    console.error("[voice-command] All keys exhausted. Last error:", lastError);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        actions: [],
        needsMoreInfo: true,
        spokenResponse: 'All AI services are currently unavailable. Please try again later.',
        followUpQuestion: null
      })
    };

  } catch (error) {
    console.error("Server error in voice-command:", error);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        actions: [],
        needsMoreInfo: true,
        spokenResponse: 'Sorry, something went wrong. Please try again.',
        followUpQuestion: null
      })
    };
  }
};
