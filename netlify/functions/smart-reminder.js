// Netlify Scheduled Function: smart-reminder.js
//
// Sends smart push notifications three times daily with contextual messages:
// Priority 1: Expiring/expired products → "⚠️ 3 items expiring today!"
// Priority 2: Out of stock items → "🛒 5 items are out of stock. Time to restock?"
// Priority 3: All good → "✅ All stocked up! What shall we cook tonight?" (evening only)
//
// Schedule (netlify.toml): 2:30 UTC = 8:00 AM IST (morning),
//                          8:30 UTC = 2:00 PM IST (afternoon),
//                         13:30 UTC = 7:00 PM IST (evening)

try { require('dotenv').config(); } catch (e) {}

const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');
const { deriveStatusFromAvailability } = require('./derive-status');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_SECRET_KEY = process.env.SUPABASE_SERVICE_SECRET_KEY;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@stocktracker.app';

exports.handler = async (event, context) => {
  console.log('[smart-reminder] Running smart reminder check...');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_SECRET_KEY) {
    console.error('[smart-reminder] Missing Supabase env vars.');
    return { statusCode: 500, body: JSON.stringify({ error: 'Missing Supabase config' }) };
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error('[smart-reminder] Missing VAPID keys. Push disabled.');
    return { statusCode: 200, body: JSON.stringify({ message: 'Push notifications disabled (no VAPID keys).' }) };
  }

  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch (vapidError) {
    console.error('[smart-reminder] Invalid VAPID keys:', vapidError.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Invalid VAPID configuration' }) };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const today = new Date().toISOString().split('T')[0];
    const currentHourUTC = new Date().getUTCHours();
    // Schedule: 2:30 UTC = 8:00 AM IST (morning), 8:30 UTC = 2:00 PM IST (afternoon), 13:30 UTC = 7:00 PM IST (evening)
    const isMorning = currentHourUTC < 5;                              // 2:30 UTC → true
    const isAfternoon = currentHourUTC >= 5 && currentHourUTC < 11;    // 8:30 UTC → true
    const isEvening = currentHourUTC >= 11;                            // 13:30 UTC → true
    const timeLabel = isMorning ? 'morning' : isAfternoon ? 'afternoon' : 'evening';

    console.log(`[smart-reminder] Time: ${timeLabel} | Today: ${today}`);

    // Get all users who have push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('user_id, endpoint, p256dh, auth');

    if (subError) throw new Error(`Failed to fetch subscriptions: ${subError.message}`);
    if (!subscriptions || subscriptions.length === 0) {
      console.log('[smart-reminder] No push subscriptions found.');
      return { statusCode: 200, body: JSON.stringify({ message: 'No subscribers.' }) };
    }

    // Group subscriptions by user
    const userSubscriptions = {};
    for (const sub of subscriptions) {
      if (!userSubscriptions[sub.user_id]) {
        userSubscriptions[sub.user_id] = [];
      }
      userSubscriptions[sub.user_id].push(sub);
    }

    let notificationsSent = 0;

    // Process each user
    for (const userId of Object.keys(userSubscriptions)) {
      try {
        // Get user's products with expiry dates
        const { data: homes, error: homesError } = await supabase
          .from('homes')
          .select('name, products(product, quantity, expiry_date, availability, availability_status, stock_type)')
          .eq('user_id', userId);

        if (homesError || !homes) continue;

        const allProducts = homes.flatMap(h => 
          (h.products || []).map(p => ({ ...p, homeName: h.name }))
        );

        if (allProducts.length === 0) continue; // Skip users with no products

        // Analyze inventory
        const expiringSoon = []; // Expiring within 3 days
        const expired = [];
        const outOfStock = [];
        const lowStock = [];
        const availableFood = [];

        for (const p of allProducts) {
          if (p.expiry_date) {
            const expiryDate = new Date(p.expiry_date);
            const daysUntilExpiry = Math.ceil((expiryDate.getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysUntilExpiry < 0) {
              expired.push(p);
            } else if (daysUntilExpiry <= 3) {
              expiringSoon.push({ ...p, daysLeft: daysUntilExpiry });
            }
          }

          // Use availability_status (persisted) with fallback to availability (legacy)
            const status = p.availability_status || deriveStatusFromAvailability(p.availability || 'Yes');
          if (status === 'out_of_stock') {
            outOfStock.push(p);
          } else if (status === 'low') {
            lowStock.push(p);
          } else {
            availableFood.push(p);
          }
        }

        // Build notification message based on priority
        let title = '';
        let body = '';
        let shouldSend = false;

        if (expired.length > 0 || expiringSoon.length > 0) {
          // PRIORITY 1: Expiry alerts
          shouldSend = true;
          const totalExpiry = expired.length + expiringSoon.length;
          
          if (expired.length > 0 && expiringSoon.length > 0) {
            title = '⚠️ Expiry Alert!';
            body = `${expired.length} item(s) expired, ${expiringSoon.length} expiring soon. Check your stock!`;
          } else if (expired.length > 0) {
            title = '🚨 Items Expired!';
            const names = expired.slice(0, 3).map(p => p.product).join(', ');
            body = expired.length <= 3 
              ? `${names} ${expired.length === 1 ? 'has' : 'have'} expired. Remove or replace them.`
              : `${expired.length} items expired including ${names}. Time to clean up!`;
          } else {
            title = '⏰ Expiring Soon!';
            const names = expiringSoon.slice(0, 3).map(p => `${p.product} (${p.daysLeft}d)`).join(', ');
            body = expiringSoon.length <= 3
              ? `${names} — use them before they expire!`
              : `${expiringSoon.length} items expiring within 3 days. Check your inventory!`;
          }
        } else if (outOfStock.length > 0) {
          // PRIORITY 2: Out of stock reminder
          shouldSend = true;
          title = '🛒 Restock Reminder';
          const names = outOfStock.slice(0, 4).map(p => p.product).join(', ');
          body = outOfStock.length <= 4
            ? `Out of stock: ${names}. Add to your shopping list!`
            : `${outOfStock.length} items out of stock including ${names}. Time to shop!`;
        } else if (lowStock.length > 0) {
          // PRIORITY 2.5: Low stock nudge
          shouldSend = true;
          title = '⚠️ Running Low';
          const names = lowStock.slice(0, 4).map(p => p.product).join(', ');
          body = lowStock.length <= 4
            ? `Running low: ${names}. Restock soon?`
            : `${lowStock.length} items running low including ${names}. Time to restock!`;
        } else if (isEvening && availableFood.length > 3) {
          // PRIORITY 3: Evening "what to cook" (only if everything is stocked)
          shouldSend = true;
          title = '🍳 All Stocked Up!';
          const foodItems = availableFood
            .filter(p => ['Grocery', 'Vegetables', 'Dairy', 'Grains & Rice', 'Pulses & Lentils'].some(cat => 
              (p.stock_type || '').toLowerCase().includes(cat.toLowerCase())
            ))
            .slice(0, 3)
            .map(p => p.product);
          
          if (foodItems.length > 0) {
            body = `You have ${foodItems.join(', ')} and more. What shall we cook tonight? 🧑‍🍳`;
          } else {
            body = `Your pantry is well-stocked! Open the app to plan tonight's meal. 🧑‍🍳`;
          }
        } else if (isMorning && allProducts.length > 0) {
          // Morning: Quick status
          shouldSend = true;
          title = '📦 Good Morning!';
          const issues = [];
          if (outOfStock.length > 0) issues.push(`${outOfStock.length} out of stock`);
          if (lowStock.length > 0) issues.push(`${lowStock.length} running low`);
          body = `You have ${allProducts.length} items tracked. ${issues.length > 0 ? issues.join(', ') + '.' : 'Everything looks good! ✅'}`;
        }

        // Send notification if we have something to say
        if (shouldSend) {
          const payload = JSON.stringify({
            title,
            body,
            icon: '/icons/icon-192x192.png',
            url: '/',
          });

          for (const sub of userSubscriptions[userId]) {
            try {
              await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                payload
              );
              notificationsSent++;
            } catch (pushError) {
              const code = pushError.statusCode;
              if (code === 400 || code === 401 || code === 403 || code === 404 || code === 410) {
                // Remove invalid subscription
                await supabase.from('push_subscriptions').delete()
                  .eq('user_id', userId).eq('endpoint', sub.endpoint);
                console.log(`[smart-reminder] Removed invalid subscription for user ${userId}`);
              }
            }
          }
        }
      } catch (userError) {
        console.error(`[smart-reminder] Error processing user ${userId}:`, userError.message);
      }
    }

    console.log(`[smart-reminder] Done! Sent ${notificationsSent} notifications.`);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Sent ${notificationsSent} smart reminders (${timeLabel}).` })
    };

  } catch (error) {
    console.error('[smart-reminder] Fatal error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
