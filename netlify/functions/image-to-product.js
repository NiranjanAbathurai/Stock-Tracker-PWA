// Netlify Serverless Function: image-to-product.js
// Takes an image (photo of product/bill/receipt) and uses Gemini Vision AI
// to extract product details (name, category, quantity, expiry date)

try { require('dotenv').config(); } catch (e) {}

// Reuse the same multi-key fallback logic as voice-command
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

const IMAGE_SYSTEM_PROMPT = `You are a product extraction AI for a Stock Tracker app. The user will send you an image of a product, grocery item, bill, receipt, or packaging.

Your job is to extract product information from the image and return structured JSON.

## What to extract:
1. **product** — The product name (e.g., "Milk", "Rice", "Paracetamol", "Dish Soap")
2. **category** — One of these categories: Grocery, Vegetables, Fruits, Dairy, Snacks, Beverages, Cleaning, Personal Care, Medicine, Spices, Frozen, Bakery, Others
3. **quantity** — The quantity/weight/volume if visible (e.g., "1 liter", "500g", "2 packs"). If not visible, use "1"
4. **expiryDate** — The expiry date if visible on the packaging, in YYYY-MM-DD format. If not visible, use ""
5. **confidence** — How confident you are in the extraction: "high", "medium", or "low"

## Rules:
- If the image shows a RECEIPT or BILL with multiple items, extract ALL items as an array
- If the image shows a SINGLE product, return an array with one item
- If you cannot identify the product at all, return an empty array with an error message
- Product names should be in English
- Be practical — if you see "Amul Taaza" extract it as product: "Amul Taaza Milk", category: "Dairy"
- For medicines, try to read the generic name and brand name
- If expiry date is in DD/MM/YYYY or MM/YYYY format, convert to YYYY-MM-DD

## Output Format:
Return ONLY valid JSON (no markdown, no extra text):
{
  "products": [
    {
      "product": "Product Name",
      "category": "Category",
      "quantity": "1 kg",
      "expiryDate": "2025-06-15",
      "confidence": "high"
    }
  ],
  "message": "Found 1 product in the image"
}

If you cannot extract anything:
{
  "products": [],
  "message": "Could not identify any products in this image. Please try a clearer photo."
}
`;

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

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const body = JSON.parse(event.body || '{}');
  const { image, mimeType } = body;

  if (!image) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'No image data provided.' }) };
  }

  if (GEMINI_KEYS.length === 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'No Gemini API key configured.' })
    };
  }

  try {
    const imageMime = mimeType || 'image/jpeg';

    const geminiContents = [{
      role: 'user',
      parts: [
        {
          inlineData: {
            mimeType: imageMime,
            data: image
          }
        },
        { text: 'Please analyze this image and extract product information. Return the JSON response.' }
      ]
    }];

    // Try each key in the chain
    for (let i = 0; i < GEMINI_KEYS.length; i++) {
      const keyConfig = GEMINI_KEYS[i];
      const isLastKey = (i === GEMINI_KEYS.length - 1);

      const requestBody = {
        contents: geminiContents,
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.2,
          responseMimeType: "application/json",
        },
        systemInstruction: {
          parts: [{ text: IMAGE_SYSTEM_PROMPT }]
        }
      };

      const apiUrl = `${keyConfig.baseUrl}/models/${keyConfig.model}:generateContent?key=${keyConfig.key}`;

      console.log(`[image-to-product] Trying ${keyConfig.label} (model: ${keyConfig.model})...`);

      const response = await fetchWithRetry(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.warn(`[image-to-product] ${keyConfig.label} failed (${response.status}): ${errorData.substring(0, 200)}`);

        if (FALLBACK_STATUSES.includes(response.status) && !isLastKey) {
          console.log(`[image-to-product] Falling back to next key...`);
          continue;
        }

        if (response.status === 503 || response.status === 429) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              products: [],
              message: 'AI is busy right now. Please try again in a few seconds.'
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
        if (!isLastKey) {
          continue;
        }
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            products: [],
            message: 'Could not process the image. Please try a clearer photo.'
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
      console.log(`[image-to-product] Success using ${keyConfig.label}`);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(parsedJson)
      };
    }

    // All keys exhausted
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        products: [],
        message: 'All AI services are currently unavailable. Please try again later.'
      })
    };

  } catch (error) {
    console.error("Server error in image-to-product:", error);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        products: [],
        message: 'Something went wrong. Please try again.'
      })
    };
  }
};
