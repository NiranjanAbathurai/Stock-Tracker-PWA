// Netlify Scheduled Function: expiry-notification.js
//
// Runs daily to check for expired products and send:
// 1. Email notifications via EmailJS
// 2. Push notifications via Web Push API

try { require('dotenv').config(); } catch (e) {}

const { createClient } = require('@supabase/supabase-js');
const emailjs = require('@emailjs/nodejs');
const webpush = require('web-push');
const { SUPABASE_URL, SUPABASE_SERVICE_SECRET_KEY } = require('./supabase-config');

// EmailJS config
const EMAILJS_SERVICE_ID = 'service_jzegqtm';
const EMAILJS_TEMPLATE_ID = 'template_z4ips6l';
const EMAILJS_PUBLIC_KEY = 'rPoWSI2KJiDg4uFaI';
const EMAILJS_PRIVATE_KEY = 'bT2hT100y3cLHH83zsT7v';

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
    // 2. Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    console.log(`Checking for products expired before: ${today}`);

    // 3. Fetch all expired products from Supabase
    const { data: expiredProducts, error } = await supabase
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
      .eq('availability', 'Yes');

    if (error) throw new Error(`Supabase query failed: ${error.message}`);

    if (!expiredProducts || expiredProducts.length === 0) {
      console.log('No expired products found.');
      return { statusCode: 200, body: JSON.stringify({ message: 'No expired products found.' }) };
    }

    console.log(`Found ${expiredProducts.length} expired products. Processing notifications...`);

    // 4. Group expired products by user
    const userNotifications = {};

    for (const p of expiredProducts) {
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
            products: [],
          };
        }
        userNotifications[userId].products.push({
          productName: p.product,
          homeName: p.homes.name,
          expiryDate: p.expiry_date,
        });
      }
    }

    // 5. Send notifications per user
    for (const userId in userNotifications) {
      const notification = userNotifications[userId];
      const { email, username, products } = notification;

      // --- EMAIL NOTIFICATION (one email per user with all expired products) ---
      const productListHtml = products.map(p =>
        `<tr><td style="padding:4px 8px;border:1px solid #ddd;">${p.productName}</td><td style="padding:4px 8px;border:1px solid #ddd;">${p.homeName}</td><td style="padding:4px 8px;border:1px solid #ddd;">${p.expiryDate}</td></tr>`
      ).join('');

      const productTable = `<table style="border-collapse:collapse;width:100%;margin:10px 0;"><thead><tr style="background:#f44336;color:#fff;"><th style="padding:6px 8px;border:1px solid #ddd;">Product</th><th style="padding:6px 8px;border:1px solid #ddd;">Home</th><th style="padding:6px 8px;border:1px solid #ddd;">Expired On</th></tr></thead><tbody>${productListHtml}</tbody></table>`;

      const templateParams = {
        email: email,
        userName: username,
        productList: productTable,
        itemCount: products.length,
      };

      try {
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, {
          publicKey: EMAILJS_PUBLIC_KEY,
          privateKey: EMAILJS_PRIVATE_KEY,
        });
        console.log(`Email sent to ${email} (${products.length} expired products)`);
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
          const pushBody = products.length === 1
            ? `${products[0].productName} in "${products[0].homeName}" expired on ${products[0].expiryDate}`
            : `${products.length} products have expired across your homes`;

          const pushPayload = JSON.stringify({
            title: '⚠️ Stock Expired!',
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
              if (code === 410 || code === 404 || code === 401 || code === 403) {
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
      body: JSON.stringify({ message: `Processed ${Object.keys(userNotifications).length} user notifications.` }),
    };

  } catch (error) {
    console.error('An error occurred during the expiry check:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
