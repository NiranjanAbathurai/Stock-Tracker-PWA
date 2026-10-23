// Netlify Scheduled Function: dish-suggestions.js
//
// Uses AI (Groq/Gemini) to suggest dishes based on each user's available
// inventory items. Stores results in the `dish_suggestions` Supabase table
// AND sends a push notification so the user knows new suggestions are ready.
//
// TIMEZONE-AWARE: Runs every hour. For each user, checks their IANA timezone
// and only processes if it's 7:00 AM or 5:00 PM local time (meal planning times).
//
// AI PROVIDER CHAIN: Groq (free) → Gemini Primary → Gemini Fallback
// Token usage: ~150 input + ~200 output = ~350 tokens per user (negligible cost)
//
// Schedule: "15 * * * *" (every hour at :15)

try { require('dotenv').config(); } catch (e) {}

const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');
const { deriveStatusFromAvailability } = require('./derive-status');
const { getLocalHour, getUserTimezone } = require('./timezone-utils');
const { getGroqModels, getGeminiModel, PROVIDER_FALLBACK_STATUSES } = require('./ai-models');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_SECRET_KEY = process.env.SUPABASE_SERVICE_SECRET_KEY;

// VAPID config for Web Push (same keys as expiry-notification.js)
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@stocktracker.app';

// ─── AI Provider Chain (same pattern as text-command.js) ───
function buildProviderChain() {
  const chain = [];

  // Groq (free tier: 30 req/min, 14,400 req/day)
  if (process.env.GROQ_API_KEY) {
    chain.push({
      provider: 'groq',
      key: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
      baseUrl: 'https://api.groq.com/openai/v1',
      label: 'Groq',
    });
  }

  // Gemini Primary
  if (process.env.GEMINI_API_KEY_PRIMARY) {
    chain.push({
      provider: 'gemini',
      key: process.env.GEMINI_API_KEY_PRIMARY,
      model: process.env.GEMINI_MODEL_PRIMARY || process.env.GEMINI_MODEL || 'gemini-3.8-flash',
      baseUrl: process.env.GEMINI_BASE_URL_PRIMARY || 'https://generativelanguage.googleapis.com/v1beta',
      label: 'Gemini Primary',
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

  return chain;
}

const PROVIDER_CHAIN = buildProviderChain();

// ─── AI Prompt ───
function buildDishSuggestionPrompt(availableItems, mealType) {
  return `You are a helpful cooking assistant. Based on the available ingredients below, suggest 5-8 dishes that can be made.

## Available Ingredients:
${availableItems.join(', ')}

## Meal Context: ${mealType === 'breakfast' ? 'Morning/Breakfast time' : 'Evening/Dinner time'}

## Rules:
- Only suggest dishes that can be primarily made with the listed ingredients
- Include a mix of quick/easy and more elaborate dishes
- Prefer Indian cuisine but include other cuisines if ingredients match
- For each dish, mention which available ingredients it uses
- Rate how well the ingredients match (percentage)
- Include a short 1-line cooking tip
- Include detailed step-by-step cooking instructions (4-8 clear numbered steps)
- Each step should be concise but actionable (e.g. "Heat oil in a pan, add mustard seeds and let them splutter")
- Include prep time estimate

## Output (JSON only, no markdown fences):
{
  "dishes": [
    {
      "name": "Dish Name",
      "emoji": "🍛",
      "category": "Breakfast|Main Course|Snack|Side Dish|Beverage|Dessert",
      "ingredients_used": ["item1", "item2"],
      "match_score": 85,
      "quick_tip": "Short 1-line summary",
      "prep_time": "15 mins",
      "steps": ["Step 1: Do this", "Step 2: Do that", "Step 3: Then this"]
    }
  ]
}`;
}

// ─── Groq API Call (uses shared ai-models.js for dynamic discovery) ───
async function callGroq(provider, prompt) {
  const modelsToTry = await getGroqModels(provider.key);

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
          max_tokens: 2048,
          response_format: { type: 'json_object' },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) continue;
        console.log(`[dish-suggestions] Groq ${model} succeeded`);
        return content;
      }

      // Decommissioned (400) or not found (404) → try next model
      if (response.status === 400 || response.status === 404) {
        console.warn(`[dish-suggestions] Groq model "${model}" unavailable (${response.status}), trying next...`);
        continue;
      }

      if (PROVIDER_FALLBACK_STATUSES.includes(response.status)) {
        console.warn(`[dish-suggestions] Groq model ${model} returned ${response.status}, trying next...`);
        continue;
      }

      const errText = await response.text();
      console.warn(`[dish-suggestions] Groq ${model} error: ${response.status} ${errText}`);
      continue;
    } catch (err) {
      console.warn(`[dish-suggestions] Groq ${model} exception: ${err.message}`);
      continue;
    }
  }

  return null; // All Groq models failed
}

// ─── Gemini API Call (uses shared ai-models.js for discovery on 404) ───
async function callGemini(provider, prompt) {
  try {
    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    };

    let modelToUse = provider.model;
    let url = `${provider.baseUrl}/models/${modelToUse}:generateContent?key=${provider.key}`;

    console.log(`[dish-suggestions] Trying ${provider.label} (${modelToUse})`);

    let response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    // If model not found, discover available models and retry
    if (!response.ok && response.status === 404) {
      console.warn(`[dish-suggestions] Gemini model "${modelToUse}" not found. Discovering...`);
      const discoveredModel = await getGeminiModel(provider);
      if (discoveredModel && discoveredModel !== modelToUse) {
        modelToUse = discoveredModel;
        url = `${provider.baseUrl}/models/${modelToUse}:generateContent?key=${provider.key}`;
        console.log(`[dish-suggestions] Retrying with discovered model: ${modelToUse}`);
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
      }
    }

    if (PROVIDER_FALLBACK_STATUSES.includes(response.status)) {
      console.warn(`[dish-suggestions] ${provider.label} returned ${response.status}`);
      return null;
    }

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[dish-suggestions] ${provider.label} error: ${response.status} ${errText}`);
      return null;
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) return null;

    console.log(`[dish-suggestions] ${provider.label} succeeded (${modelToUse})`);
    return content;
  } catch (err) {
    console.warn(`[dish-suggestions] ${provider.label} exception: ${err.message}`);
    return null;
  }
}

// ─── Call AI with provider chain fallback ───
async function getAIDishSuggestions(availableItems, mealType) {
  const prompt = buildDishSuggestionPrompt(availableItems, mealType);

  for (const provider of PROVIDER_CHAIN) {
    let rawContent = null;

    if (provider.provider === 'groq') {
      rawContent = await callGroq(provider, prompt);
    } else if (provider.provider === 'gemini') {
      rawContent = await callGemini(provider, prompt);
    }

    if (!rawContent) continue;

    // Parse JSON response
    try {
      // Strip markdown fences if present
      const cleaned = rawContent.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(cleaned);

      if (parsed.dishes && Array.isArray(parsed.dishes) && parsed.dishes.length > 0) {
        return {
          dishes: parsed.dishes.map(d => ({
            name: d.name || 'Unknown Dish',
            emoji: d.emoji || '🍽️',
            category: d.category || 'Main Course',
            ingredients_used: d.ingredients_used || [],
            match_score: typeof d.match_score === 'number' ? d.match_score : 50,
            quick_tip: d.quick_tip || '',
            prep_time: d.prep_time || '',
            steps: Array.isArray(d.steps) ? d.steps : [],
          })),
          provider: provider.label,
        };
      }
    } catch (parseErr) {
      console.warn(`[dish-suggestions] Failed to parse ${provider.label} response: ${parseErr.message}`);
      console.warn(`[dish-suggestions] Raw content: ${rawContent.substring(0, 300)}`);
      continue;
    }
  }

  return null; // All providers failed
}

/**
 * Determine if it's a dish suggestion window for the user.
 * We suggest dishes at:
 *   7:00–7:59 AM local  → breakfast/morning planning
 *   5:00–5:59 PM local  → dinner planning
 *
 * NOTE: The cron runs at :15 past every UTC hour. For half-hour offset
 * timezones (e.g. IST = UTC+5:30), the local time when the cron fires
 * is :45 past the local hour. So we match the full hour window (7 or 17)
 * to ensure users in all timezones are covered.
 */
function isDishSuggestionTime(localHour) {
  return localHour === 7 || localHour === 17;
}

function getMealLabel(localHour) {
  if (localHour === 7) return 'breakfast';
  if (localHour === 17) return 'dinner';
  return 'dinner'; // default
}

exports.handler = async (event, context) => {
  // Support ?force=true to bypass time check (for manual testing)
  const params = event.queryStringParameters || {};
  const forceRun = params.force === 'true';

  console.log(`[dish-suggestions] Running AI dish suggestion cron...${forceRun ? ' (FORCE MODE)' : ''}`);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_SECRET_KEY) {
    console.error('[dish-suggestions] Missing Supabase env vars.');
    return { statusCode: 500, body: JSON.stringify({ error: 'Missing Supabase config' }) };
  }

  if (PROVIDER_CHAIN.length === 0) {
    console.error('[dish-suggestions] No AI providers configured. Set GROQ_API_KEY or GEMINI_API_KEY_PRIMARY.');
    return { statusCode: 200, body: JSON.stringify({ message: 'No AI providers configured.' }) };
  }

  // Configure web-push if VAPID keys are available
  let pushEnabled = false;
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT) {
    try {
      webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
      pushEnabled = true;
      console.log('[dish-suggestions] Push notifications enabled.');
    } catch (vapidError) {
      console.warn('[dish-suggestions] Failed to configure VAPID — push disabled:', vapidError.message);
    }
  } else {
    console.log('[dish-suggestions] Push notifications disabled (missing VAPID keys).');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // Get all distinct user IDs from homes table
    const { data: homeRows, error: homeError } = await supabase
      .from('homes')
      .select('user_id')
      .not('user_id', 'is', null);

    if (homeError) throw new Error(`Failed to fetch homes: ${homeError.message}`);
    if (!homeRows || homeRows.length === 0) {
      console.log('[dish-suggestions] No users with homes found.');
      return { statusCode: 200, body: JSON.stringify({ message: 'No users to process.' }) };
    }

    const userIds = [...new Set(homeRows.map(h => h.user_id))];
    let usersProcessed = 0;
    let usersSkipped = 0;
    let pushSent = 0;

    for (const userId of userIds) {
      try {
        // Fetch user to get their timezone
        const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
        if (userError || !user) {
          console.warn(`[dish-suggestions] Could not fetch user ${userId}: ${userError?.message}`);
          continue;
        }

        const timezone = getUserTimezone(user);
        const localHour = getLocalHour(timezone);

        console.log(`[dish-suggestions] User ${user.email} | TZ: ${timezone} | Local hour: ${localHour} | isDishTime: ${isDishSuggestionTime(localHour)} | force: ${forceRun}`);

        if (!forceRun && !isDishSuggestionTime(localHour)) {
          usersSkipped++;
          continue;
        }

        const mealLabel = forceRun ? (localHour < 12 ? 'breakfast' : 'dinner') : getMealLabel(localHour);
        console.log(`[dish-suggestions] Processing ${user.email} for ${mealLabel} suggestions...`);

        // Get user's available products
        const { data: homes, error: homesError } = await supabase
          .from('homes')
          .select('name, products(product, quantity, expiry_date, availability, availability_status, stock_type)')
          .eq('user_id', userId);

        if (homesError || !homes) continue;

        const allProducts = homes.flatMap(h =>
          (h.products || []).map(p => ({ ...p, homeName: h.name }))
        );

        // Filter to only available items
        const availableProducts = allProducts.filter(p => {
          const status = p.availability_status || deriveStatusFromAvailability(p.availability || 'Yes');
          return status !== 'out_of_stock';
        });

        if (availableProducts.length === 0) {
          console.log(`[dish-suggestions] User ${user.email} has no available products, skipping.`);
          continue;
        }

        const availableItems = availableProducts.map(p => p.product);

        // Call AI for dish suggestions
        const result = await getAIDishSuggestions(availableItems, mealLabel);

        if (!result) {
          console.warn(`[dish-suggestions] AI failed for user ${userId}, skipping.`);
          continue;
        }

        // Upsert suggestions into the dish_suggestions table
        const { error: upsertError } = await supabase
          .from('dish_suggestions')
          .upsert(
            {
              user_id: userId,
              suggestions: result.dishes,
              available_items: availableItems,
              meal_type: mealLabel,
              ai_provider: result.provider,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );

        if (upsertError) {
          console.warn(`[dish-suggestions] Failed to upsert for user ${userId}: ${upsertError.message}`);
        } else {
          usersProcessed++;
          console.log(`[dish-suggestions] Stored ${result.dishes.length} AI suggestions for user ${userId} via ${result.provider}`);
        }

        // ─── Send Push Notification ───
        if (pushEnabled) {
          try {
            const { data: subscriptions, error: subError } = await supabase
              .from('push_subscriptions')
              .select('id, endpoint, p256dh, auth')
              .eq('user_id', userId);

            if (subError) {
              console.warn(`[dish-suggestions] Failed to fetch push subs for ${userId}: ${subError.message}`);
            } else if (subscriptions && subscriptions.length > 0) {
              // Pick top dish for the notification body
              const topDish = result.dishes[0];
              const dishCount = result.dishes.length;
              const mealEmoji = mealLabel === 'breakfast' ? '🌅' : '🌆';
              const pushBody = dishCount === 1
                ? `${topDish.emoji} Try making ${topDish.name}!`
                : `${topDish.emoji} ${topDish.name} and ${dishCount - 1} more ${mealLabel} ideas!`;

              const pushPayload = JSON.stringify({
                title: `${mealEmoji} ${mealLabel === 'breakfast' ? 'Breakfast' : 'Dinner'} Ideas Ready!`,
                body: pushBody,
                icon: '/icons/icon-192x192.png',
                url: '/',
              });

              for (const sub of subscriptions) {
                const pushSubscription = {
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.p256dh, auth: sub.auth },
                };

                try {
                  await webpush.sendNotification(pushSubscription, pushPayload);
                  pushSent++;
                  console.log(`[dish-suggestions] Push sent to sub ${sub.id} for user ${userId}`);
                } catch (pushError) {
                  const code = pushError.statusCode;
                  if (code === 400 || code === 401 || code === 403 || code === 404 || code === 410) {
                    // Subscription is invalid/expired — clean it up
                    console.log(`[dish-suggestions] Removing invalid push sub ${sub.id} (HTTP ${code})`);
                    await supabase.from('push_subscriptions').delete().eq('id', sub.id);
                  } else {
                    console.warn(`[dish-suggestions] Push failed for sub ${sub.id} (HTTP ${code}):`, pushError.message);
                  }
                }
              }
            } else {
              console.log(`[dish-suggestions] No push subscriptions for user ${userId}`);
            }
          } catch (pushErr) {
            console.warn(`[dish-suggestions] Push error for user ${userId}:`, pushErr.message);
          }
        }
      } catch (userError) {
        console.error(`[dish-suggestions] Error processing user ${userId}:`, userError.message);
      }
    }

    console.log(`[dish-suggestions] Done! Processed ${usersProcessed} users. Push sent: ${pushSent}. Skipped ${usersSkipped} users.`);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Processed ${usersProcessed} users. Push: ${pushSent}. Skipped ${usersSkipped}.` }),
    };
  } catch (error) {
    console.error('[dish-suggestions] Fatal error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
