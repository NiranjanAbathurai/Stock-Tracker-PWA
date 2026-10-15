// Netlify Scheduled Function: expiry-notification.js
//
// TIMEZONE-AWARE: Runs every hour (netlify.toml: "31 * * * *").
// For each user, checks their IANA timezone and only sends the daily
// expiry digest when it's midnight (hour 0) in their local timezone.
//
// Sends:
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
const { isMidnightLocal, getLocalDateString, getUserTimezone } = require('./timezone-utils');

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
  console.log('[expiry-notification] Running timezone-aware hourly expiry check...');

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
      console.log('[expiry-notification] Web Push notifications enabled.');
    } catch (vapidError) {
      console.error(
        '[expiry-notification] Failed to configure VAPID keys — push notifications disabled.',
        vapidError.message,
        '\nHint: VAPID keys must be URL-safe base64-encoded. Generate valid keys with: npx web-push generate-vapid-keys'
      );
    }
  } else {
    console.log('[expiry-notification] Web Push notifications disabled (missing VAPID keys).');
  }

  // Initialize Supabase client with service role key to bypass RLS
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // 2. Get all unique user IDs that have homes with products
    const { data: homeOwners, error: ownersError } = await supabase
      .from('homes')
      .select('user_id')
      .not('user_id', 'is', null);

    if (ownersError) throw new Error(`Failed to fetch home owners: ${ownersError.message}`);
    if (!homeOwners || homeOwners.length === 0) {
      console.log('[expiry-notification] No home owners found.');
      return { statusCode: 200, body: JSON.stringify({ message: 'No users with homes.' }) };
    }

    // Deduplicate user IDs
    const uniqueUserIds = [...new Set(homeOwners.map(h => h.user_id))];
    console.log(`[expiry-notification] Found ${uniqueUserIds.length} unique users with homes.`);

    let emailsSent = 0;
    let pushSent = 0;
    let usersSkipped = 0;

    // 3. Process each user — only send if it's midnight in their timezone
    for (const userId of uniqueUserIds) {
      try {
        // Fetch user to get their timezone
        const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
        if (userError || !user) {
          console.warn(`[expiry-notification] Could not fetch user ${userId}: ${userError?.message}`);
          continue;
        }

        const timezone = getUserTimezone(user);

        // Only send at midnight in the user's local timezone
        if (!isMidnightLocal(timezone)) {
          usersSkipped++;
          continue;
        }

        const email = user.email;
        const username = user.user_metadata?.username || user.user_metadata?.full_name || email;
        const today = getLocalDateString(timezone);

        console.log(`[expiry-notification] Processing user ${email} | TZ: ${timezone} | Local date: ${today}`);

        // Calculate 7 days from today in the user's local timezone
        const todayDate = new Date(today + 'T00:00:00');
        const sevenDaysDate = new Date(todayDate);
        sevenDaysDate.setDate(sevenDaysDate.getDate() + 7);
        const sevenDaysFromNow = sevenDaysDate.toISOString().split('T')[0];

        // 4a. Fetch EXPIRED products for this user
        const { data: expiredProducts, error: expiredError } = await supabase
          .from('products')
          .select(`
            product,
            expiry_date,
            homes!inner (
              name,
              user_id
            )
          `)
          .eq('homes.user_id', userId)
          .not('expiry_date', 'is', null)
          .lt('expiry_date', today)
          .in('availability_status', ['available', 'low']);

        if (expiredError) {
          console.error(`[expiry-notification] Expired query failed for ${userId}: ${expiredError.message}`);
          continue;
        }

        // 4b. Fetch EXPIRING SOON products for this user
        const { data: expiringSoonProducts, error: expiringSoonError } = await supabase
          .from('products')
          .select(`
            product,
            expiry_date,
            homes!inner (
              name,
              user_id
            )
          `)
          .eq('homes.user_id', userId)
          .not('expiry_date', 'is', null)
          .gte('expiry_date', today)
          .lte('expiry_date', sevenDaysFromNow)
          .in('availability_status', ['available', 'low']);

        if (expiringSoonError) {
          console.error(`[expiry-notification] Expiring-soon query failed for ${userId}: ${expiringSoonError.message}`);
          continue;
        }

        const expired = expiredProducts || [];
        const expiringSoon = expiringSoonProducts || [];

        if (expired.length === 0 && expiringSoon.length === 0) {
          continue; // Nothing to notify about
        }

        console.log(`[expiry-notification] User ${email}: ${expired.length} expired, ${expiringSoon.length} expiring soon`);

        // 5. Build email HTML
        let productListHtml = '';

        if (expired.length > 0) {
          const expiredRows = expired.map(p =>
            `<tr><td style="padding:6px 10px;border:1px solid #ddd;">${p.product}</td><td style="padding:6px 10px;border:1px solid #ddd;">${p.homes.name}</td><td style="padding:6px 10px;border:1px solid #ddd;">${p.expiry_date}</td></tr>`
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

        if (expiringSoon.length > 0) {
          const expiringSoonRows = expiringSoon.map(p => {
            const daysLeft = Math.ceil((new Date(p.expiry_date) - new Date(today)) / (1000 * 60 * 60 * 24));
            const daysLabel = daysLeft === 0 ? 'Today' : daysLeft === 1 ? '1 day' : `${daysLeft} days`;
            return `<tr><td style="padding:6px 10px;border:1px solid #ddd;">${p.product}</td><td style="padding:6px 10px;border:1px solid #ddd;">${p.homes.name}</td><td style="padding:6px 10px;border:1px solid #ddd;">${p.expiry_date}</td><td style="padding:6px 10px;border:1px solid #ddd;color:#F97316;font-weight:600;">${daysLabel}</td></tr>`;
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

        // 6. Send email
        try {
          await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, {
            publicKey: EMAILJS_PUBLIC_KEY,
            privateKey: EMAILJS_PRIVATE_KEY,
          });
          emailsSent++;
          console.log(`[expiry-notification] Email sent to ${email}`);
        } catch (emailError) {
          console.error(`[expiry-notification] Failed to send email to ${email}:`, emailError);
        }

        // 7. Send push notification
        if (pushEnabled) {
          try {
            const { data: subscriptions, error: subError } = await supabase
              .from('push_subscriptions')
              .select('id, endpoint, p256dh, auth')
              .eq('user_id', userId);

            if (subError) {
              console.error(`[expiry-notification] Failed to fetch push subscriptions for ${userId}:`, subError.message);
              continue;
            }

            if (!subscriptions || subscriptions.length === 0) {
              continue;
            }

            // Build push payload
            let pushBody = '';
            if (expired.length > 0 && expiringSoon.length > 0) {
              pushBody = `${expired.length} expired & ${expiringSoon.length} expiring soon`;
            } else if (expired.length > 0) {
              pushBody = expired.length === 1
                ? `${expired[0].product} in "${expired[0].homes.name}" has expired`
                : `${expired.length} products have expired`;
            } else {
              pushBody = expiringSoon.length === 1
                ? `${expiringSoon[0].product} in "${expiringSoon[0].homes.name}" expires soon`
                : `${expiringSoon.length} products expiring within 7 days`;
            }

            const pushTitle = expired.length > 0 ? '⚠️ Stock Alert!' : '⏰ Expiring Soon!';

            const pushPayload = JSON.stringify({
              title: pushTitle,
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
                console.log(`[expiry-notification] Push sent to subscription ${sub.id} for user ${userId}`);
              } catch (pushError) {
                const code = pushError.statusCode;
                if (code === 400 || code === 401 || code === 403 || code === 404 || code === 410) {
                  console.log(`[expiry-notification] Removing invalid subscription ${sub.id} (HTTP ${code})`);
                  await supabase.from('push_subscriptions').delete().eq('id', sub.id);
                } else {
                  console.error(`[expiry-notification] Push failed for subscription ${sub.id} (HTTP ${code}):`, pushError.message);
                }
              }
            }
          } catch (pushErr) {
            console.error(`[expiry-notification] Push notification error for user ${userId}:`, pushErr);
          }
        }
      } catch (userProcessError) {
        console.error(`[expiry-notification] Error processing user ${userId}:`, userProcessError.message);
      }
    }

    console.log(`[expiry-notification] Done! Emails: ${emailsSent}, Push: ${pushSent}, Skipped: ${usersSkipped} (not midnight in their TZ)`);
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Processed: ${emailsSent} emails, ${pushSent} push notifications. Skipped ${usersSkipped} users (not midnight in their timezone).`
      }),
    };

  } catch (error) {
    console.error('[expiry-notification] An error occurred:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
