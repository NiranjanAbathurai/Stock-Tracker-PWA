// Netlify Serverless Function: voice-command.js
// Handles voice commands for the Stock Tracker PWA
// Sends audio to Gemini AI and returns structured actions

try { require('dotenv').config(); } catch (e) {}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_BASE_URL = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const VOICE_COMMAND_SYSTEM_PROMPT = `You are a voice assistant for a Stock Tracker app. Users speak commands to manage their grocery/household stock inventory.


## Language Support:
- You ONLY support these languages: **English**, **Tamil** (தமிழ்), and **Hindi** (हिन्दी).
- Detect which of these 3 languages the user is speaking and respond in the SAME language.
- If the user speaks in Tamil, respond in Tamil. If Hindi, respond in Hindi. If English, respond in English.
- If the user mixes languages (Tanglish/Hinglish), respond in the same mixed style.
- If you cannot determine the language or it's none of the 3 supported ones, default to English.
- The "userTranscript" and "spokenResponse" fields must be in the user's detected language.
- However, the "product", "stockType", and "targetHome" fields in actions MUST always be in English for database consistency (translate if needed).

## Your Role:
Listen to the user's audio command and determine what action(s) they want to perform on their stock list.

## Available Actions:
1. **add** — Add a new product to a home's stock list
2. **delete** — Remove/delete a product from the list entirely
3. **update_availability** — Mark a product as unavailable (out of stock / finished) or available again

## Context You Receive:
- The user's homes (with names and IDs)
- Current products in each home (with names, quantities, stock types)
- Catalog categories for proper categorization

## Rules:
1. If the user says "add [item]" or "I bought [item]" → action = "add"
2. If the user says "remove [item]" or "delete [item]" → action = "delete"
3. If the user says "out of stock [item]" or "finished [item]" or "[item] is over" → action = "update_availability" with availability = "No"
4. If the user says "[item] is back" or "restocked [item]" → action = "update_availability" with availability = "Yes"
5. If there is only ONE home, automatically use that home as the target.
6. If there are MULTIPLE homes and the user doesn't specify which one, set needsMoreInfo = true and ask which home in your spokenResponse.
7. If you cannot understand the command, set needsMoreInfo = true and ask for clarification.
8. For quantity, if not specified, default to "1".
9. For stockType, try to match from the provided catalog categories. If unsure, use "Others".
10. The spokenResponse should be natural, friendly, and concise — it will be read aloud via text-to-speech.
11. When multiple items are mentioned, create separate action entries for each.
12. For delete actions, try to match the product name against existing products in the home (case-insensitive, partial match is fine).

## Output Format:
You MUST return ONLY a valid JSON object (no markdown, no extra text). Structure:
{
  "actions": [
    {
      "type": "add | delete | update_availability",
      "product": "product name",
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
- User: "Add 2 kg rice" (1 home: "Medavakkam") → add rice, qty "2 kg", target Medavakkam
- User: "Remove milk" (1 home) → delete milk from that home
- User: "Eggs are finished" (1 home) → update_availability, availability "No"
- User: "Add bread" (2 homes) → needsMoreInfo true, ask which home
- User: "Add bread to Medavakkam" (2 homes) → add bread to Medavakkam
`;

// Retry helper for transient errors
async function fetchWithRetry(url, options, maxRetries = 2) {
  const RETRYABLE = [429, 500, 503, 529];
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

  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your-gemini-api-key-here') {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Gemini API key not configured on the server.' })
    };
  }

  try {
    // Build context about the user's homes and products
    let contextText = '## Current User Context:\n\n';
    contextText += `### Homes (${(homes || []).length}):\n`;
    if (homes && homes.length > 0) {
      for (const home of homes) {
        contextText += `- **${home.name}** (ID: ${home.id})\n`;
        if (home.products && home.products.length > 0) {
          contextText += `  Products:\n`;
          for (const p of home.products) {
            contextText += `    - ${p.product || '(unnamed)'} | Qty: ${p.quantity || 'N/A'} | Type: ${p.stockType || 'N/A'} | Available: ${p.availability || 'N/A'}\n`;
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

    const apiUrl = `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetchWithRetry(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Gemini API Error (voice):", errorData);
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

    const data = await response.json();
    const candidate = data.candidates && data.candidates[0];

    if (!candidate || !candidate.content || !candidate.content.parts[0] || !candidate.content.parts[0].text) {
      console.error("Invalid Gemini Response (voice):", data);
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
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(parsedJson)
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
