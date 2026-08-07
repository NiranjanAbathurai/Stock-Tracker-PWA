// Netlify Scheduled Function: expiry-notification.js
//
// Runs daily to check for expired AND expiring-soon products and send:
// 1. Email notifications via EmailJS
// 2. Push notifications via Web Push API

try { require('dotenv').config(); } catch (e) {}

const { createClient } = require('@supabase/supabase-js');
const emailjs = require('@emailjs/nodejs');
const webpush = require('web-push');
const { SUPABASE_URL, SUPABASE_SERVICE_SECRET_KEY } = require('./supabase-config');
// Shared status derivation — invariant with src/utils/deriveStatus.ts
// eslint-disable-next-line no-unused-vars
const { deriveStatusFromAvailability } = require('./derive-status');

// EmailJS config — loaded from environment variables (never hardcode secrets!)
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY;
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY;

// VAPID config for Web Push
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@stocktracker.app';

exports.handler = async (event, context) => {
  console.log('Running daily expiry check...');

  // 1. Validate environment variables
  if (!SUPABASE_URL || !SUPABASE_SERVICE_SECRET_KEY) {
    const errorMessage = 'Missing required Supabase environment variables.';
    console.error(errorMessage);
    return { statusCode: 500, body: JSON.stringify({ error: errorMessage }) };
  }

  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY || !EMAILJS_PRIVATE_KEY) {
    const errorMessage = 'Missing required EmailJS environment variables (EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY).';
    console.error(errorMessage);
    return { statusCode: 500, body: JSON.stringify({ error: errorMessage }) };
  }

  // Configure web-push if VAPID keys are available
  let pushEnabled = false;
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT) {
     try {
      webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
      pushEnabled = true;
      console.log('Web Push notifications enabled.');
    } catch (vapidError) {
      console.error(
        'Failed to configure VAPID keys — push notifications disabled.',
        vapidError.message,
        '\nHint: VAPID keys must be URL-safe base64-encoded. Generate valid keys with: npx web-push generate-vapid-keys'
      );
    }
  } else {
    console.log('Web Push notifications disabled (missing VAPID keys).');
  }

  // Initialize Supabase client with service role key to bypass RLS
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // 2. Get today's date and 7 days from now in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    console.log(`Checking for products expired before: ${today}`);
    console.log(`Checking for products expiring between ${today} and ${sevenDaysFromNow}`);

    // 3a. Fetch all EXPIRED products (expiry_date < today)
    const { data: expiredProducts, error: expiredError } = await supabase
      .from('products')
      .select(`
        product,
        expiry_date,
        homes (
          name,
          user_id
        )
      `)
      .not('expiry_date', 'is', null)
      .lt('expiry_date', today)
      .in('availability_status', ['available', 'low']);

    if (expiredError) throw new Error(`Supabase expired query failed: ${expiredError.message}`);

    // 3b. Fetch all EXPIRING SOON products (today <= expiry_date <= today + 7 days)
    const { data: expiringSoonProducts, error: expiringSoonError } = await supabase
      .from('products')
      .select(`
        product,
        expiry_date,
        homes (
          name,
          user_id
        )
      `)
      .not('expiry_date', 'is', null)
      .gte('expiry_date', today)
      .lte('expiry_date', sevenDaysFromNow)
      .in('availability_status', ['available', 'low']);

    if (expiringSoonError) throw new Error(`Supabase expiring-soon query failed: ${expiringSoonError.message}`);

    const totalExpired = expiredProducts ? expiredProducts.length : 0;
    const totalExpiringSoon = expiringSoonProducts ? expiringSoonProducts.length : 0;

    if (totalExpired === 0 && totalExpiringSoon === 0) {
      console.log('No expired or expiring-soon products found.');
      return { statusCode: 200, body: JSON.stringify({ message: 'No expired or expiring-soon products found.' }) };
    }

    console.log(`Found ${totalExpired} expired and ${totalExpiringSoon} expiring-soon products. Processing notifications...`);

    // 4. Group products by user
    const userNotifications = {};

    // Helper to add products to user notifications
    const addToUserNotifications = async (products, category) => {
      for (const p of products) {
        if (p.homes && p.homes.user_id) {
          const userId = p.homes.user_id;
          if (!userNotifications[userId]) {
            const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
            if (userError || !user) {
              console.error(`Could not fetch user for ID ${userId}:`, userError?.message);
              continue;
            }
            userNotifications[userId] = {
              email: user.email,
              username: user.user_metadata?.username || user.email,
              expired: [],
              expiringSoon: [],
            };
          }
          userNotifications[userId][category].push({
            productName: p.product,
            homeName: p.homes.name,
            expiryDate: p.expiry_date,
          });
        }
      }
    };

    if (expiredProducts && expiredProducts.length > 0) {
      await addToUserNotifications(expiredProducts, 'expired');
    }
    if (expiringSoonProducts && expiringSoonProducts.length > 0) {
      await addToUserNotifications(expiringSoonProducts, 'expiringSoon');
    }

    // 5. Send notifications per user
    for (const userId in userNotifications) {
      const notification = userNotifications[userId];
      const { email, username, expired, expiringSoon } = notification;

      // --- BUILD EMAIL HTML ---
      let productListHtml = '';

      // Expired products table (red header)
      if (expired.length > 0) {
        const expiredRows = expired.map(p =>
          `<tr><td style="padding:6px 10px;border:1px solid #ddd;">${p.productName}</td><td style="padding:6px 10px;border:1px solid #ddd;">${p.homeName}</td><td style="padding:6px 10px;border:1px solid #ddd;">${p.expiryDate}</td></tr>`
        ).join('');

        productListHtml += `
          <h3 style="color:#EF4444;margin:16px 0 8px;">⚠️ Expired Products (${expired.length})</h3>
          <table style="border-collapse:collapse;width:100%;margin:0 0 16px;">
            <thead>
              <tr style="background:#EF4444;color:#fff;">
                <th style="padding:8px 10px;border:1px solid #ddd;text-align:left;">Product</th>
                <th style="padding:8px 10px;border:1px solid #ddd;text-align:left;">Home</th>
                <th style="padding:8px 10px;border:1px solid #ddd;text-align:left;">Expired On</th>
              </tr>
            </thead>
            <tbody>${expiredRows}</tbody>
          </table>`;
      }

      // Expiring soon products table (orange header)
      if (expiringSoon.length > 0) {
        const expiringSoonRows = expiringSoon.map(p => {
          const daysLeft = Math.ceil((new Date(p.expiryDate) - new Date(today)) / (1000 * 60 * 60 * 24));
          const daysLabel = daysLeft === 0 ? 'Today' : daysLeft === 1 ? '1 day' : `${daysLeft} days`;
          return `<tr><td style="padding:6px 10px;border:1px solid #ddd;">${p.productName}</td><td style="padding:6px 10px;border:1px solid #ddd;">${p.homeName}</td><td style="padding:6px 10px;border:1px solid #ddd;">${p.expiryDate}</td><td style="padding:6px 10px;border:1px solid #ddd;color:#F97316;font-weight:600;">${daysLabel}</td></tr>`;
        }).join('');

        productListHtml += `
          <h3 style="color:#F97316;margin:16px 0 8px;">⏰ Expiring Within 7 Days (${expiringSoon.length})</h3>
          <table style="border-collapse:collapse;width:100%;margin:0 0 16px;">
            <thead>
              <tr style="background:#F97316;color:#fff;">
                <th style="padding:8px 10px;border:1px solid #ddd;text-align:left;">Product</th>
                <th style="padding:8px 10px;border:1px solid #ddd;text-align:left;">Home</th>
                <th style="padding:8px 10px;border:1px solid #ddd;text-align:left;">Expires On</th>
                <th style="padding:8px 10px;border:1px solid #ddd;text-align:left;">Days Left</th>
              </tr>
            </thead>
            <tbody>${expiringSoonRows}</tbody>
          </table>`;
      }

      const totalItems = expired.length + expiringSoon.length;

      const templateParams = {
        email: email,
        userName: username,
        productList: productListHtml,
        itemCount: totalItems,
      };

      // --- SEND EMAIL ---
      try {
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, {
          publicKey: EMAILJS_PUBLIC_KEY,
          privateKey: EMAILJS_PRIVATE_KEY,
        });
        console.log(`Email sent to ${email} (${expired.length} expired, ${expiringSoon.length} expiring soon)`);
      } catch (emailError) {
        console.error(`Failed to send email to ${email}:`, emailError);
      }

      // --- PUSH NOTIFICATION ---
      if (pushEnabled) {
        try {
          // Fetch push subscriptions for this user
          const { data: subscriptions, error: subError } = await supabase
            .from('push_subscriptions')
            .select('id, endpoint, p256dh, auth')
            .eq('user_id', userId);

          if (subError) {
            console.error(`Failed to fetch push subscriptions for ${userId}:`, subError.message);
            continue;
          }

          if (!subscriptions || subscriptions.length === 0) {
            console.log(`No push subscriptions for user ${userId}`);
            continue;
          }

          // Build push payload
          let pushBody = '';
          if (expired.length > 0 && expiringSoon.length > 0) {
            pushBody = `${expired.length} expired & ${expiringSoon.length} expiring soon`;
          } else if (expired.length > 0) {
            pushBody = expired.length === 1
              ? `${expired[0].productName} in "${expired[0].homeName}" has expired`
              : `${expired.length} products have expired`;
          } else {
            pushBody = expiringSoon.length === 1
              ? `${expiringSoon[0].productName} in "${expiringSoon[0].homeName}" expires soon`
              : `${expiringSoon.length} products expiring within 7 days`;
          }

          const pushTitle = expired.length > 0 ? '⚠️ Stock Alert!' : '⏰ Expiring Soon!';

          const pushPayload = JSON.stringify({
            title: pushTitle,
            body: pushBody,
            icon: '/icons/icon-192x192.png',
            url: '/',
          });

          // Send to each subscription
          for (const sub of subscriptions) {
            const pushSubscription = {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            };

            try {
              await webpush.sendNotification(pushSubscription, pushPayload);
              console.log(`Push sent to subscription ${sub.id} for user ${userId}`);
            } catch (pushError) {
              const code = pushError.statusCode;
            if (code === 400 || code === 401 || code === 403 || code === 404 || code === 410) {
                // Subscription expired, invalid, or VAPID mismatch — remove from DB
                console.log(`Removing invalid subscription ${sub.id} (HTTP ${code})`);
                await supabase.from('push_subscriptions').delete().eq('id', sub.id);
              } else {
                console.error(`Push failed for subscription ${sub.id} (HTTP ${code}):`, pushError.message);
              }
            }
          }
        } catch (pushErr) {
          console.error(`Push notification error for user ${userId}:`, pushErr);
        }
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Processed ${Object.keys(userNotifications).length} user notifications (${totalExpired} expired, ${totalExpiringSoon} expiring soon).` }),
    };

  } catch (error) {
    console.error('An error occurred during the expiry check:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
