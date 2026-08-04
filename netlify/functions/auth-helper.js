/**
 * Auth Helper for Netlify Functions
 * Verifies Supabase JWT tokens to ensure only authenticated users can call AI functions.
 *
 * SECURITY: This prevents unauthorized access to expensive AI endpoints.
 */

try { require('dotenv').config(); } catch (e) {}

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_SECRET_KEY = process.env.SUPABASE_SERVICE_SECRET_KEY;

/**
 * Extract and verify the JWT token from the request.
 * Returns the authenticated user or null if invalid.
 *
 * @param {object} event - Netlify function event
 * @returns {{ user: object | null, error: string | null }}
 */
async function verifyAuth(event) {
  // Extract Bearer token from Authorization header
  const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return { user: null, error: 'Missing authorization token. Please log in.' };
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_SECRET_KEY) {
    console.error('[auth-helper] Missing SUPABASE_URL or SUPABASE_SERVICE_SECRET_KEY');
    return { user: null, error: 'Server configuration error.' };
  }

  try {
    // Use service role client to verify the token
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return { user: null, error: 'Invalid or expired token. Please log in again.' };
    }

    return { user, error: null };
  } catch (err) {
    console.error('[auth-helper] Token verification failed:', err.message);
    return { user: null, error: 'Authentication failed.' };
  }
}

// ─── Rate Limiting (in-memory, per-function instance) ───

// Simple in-memory rate limiter (resets when function cold-starts)
// For production at scale, use Redis or a database-backed solution
const rateLimitStore = new Map();

/**
 * Check if a user has exceeded their rate limit.
 *
 * @param {string} userId - The user's ID
 * @param {number} maxRequests - Max requests allowed in the window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {{ allowed: boolean, remaining: number, resetIn: number }}
 */
function checkRateLimit(userId, maxRequests = 20, windowMs = 60 * 60 * 1000) {
  const now = Date.now();
  const key = userId;

  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: maxRequests - 1, resetIn: windowMs };
  }

  const entry = rateLimitStore.get(key);

  // Reset window if expired
  if (now - entry.windowStart > windowMs) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: maxRequests - 1, resetIn: windowMs };
  }

  // Increment count
  entry.count += 1;

  if (entry.count > maxRequests) {
    const resetIn = windowMs - (now - entry.windowStart);
    return { allowed: false, remaining: 0, resetIn };
  }

  return { allowed: true, remaining: maxRequests - entry.count, resetIn: windowMs - (now - entry.windowStart) };
}

// ─── CORS Helper ───

/**
 * Get CORS headers restricted to the app's domain.
 * Falls back to '*' only in development.
 */
function getCorsHeaders() {
  const appUrl = process.env.APP_URL || '';

  // In production, restrict to the app's domain
  // Allow multiple origins (deployed + localhost for dev)
  const allowedOrigins = appUrl
    ? appUrl.split(',').map(u => u.trim())
    : ['*'];

  return {
    'Access-Control-Allow-Origin': allowedOrigins[0] || '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

/**
 * Check if the request origin is allowed.
 * @param {object} event - Netlify function event
 * @returns {string} The appropriate Access-Control-Allow-Origin value
 */
function getOriginHeader(event) {
  const appUrl = process.env.APP_URL || '';
  if (!appUrl) return '*'; // Dev mode — allow all

  const allowedOrigins = appUrl.split(',').map(u => u.trim());
  const requestOrigin = event.headers?.origin || '';

  if (allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  // Default to first allowed origin
  return allowedOrigins[0];
}

// ─── Input Validation ───

/**
 * Validate request payload size and basic structure.
 *
 * @param {object} event - Netlify function event
 * @param {number} maxSizeBytes - Maximum allowed body size (default 5MB)
 * @returns {{ valid: boolean, error: string | null }}
 */
function validatePayload(event, maxSizeBytes = 5 * 1024 * 1024) {
  const body = event.body || '';

  // Check size
  const bodySize = Buffer.byteLength(body, 'utf8');
  if (bodySize > maxSizeBytes) {
    return { valid: false, error: `Payload too large (${Math.round(bodySize / 1024)}KB). Maximum allowed: ${Math.round(maxSizeBytes / 1024)}KB.` };
  }

  // Check if it's valid JSON
  try {
    JSON.parse(body);
  } catch {
    return { valid: false, error: 'Invalid JSON payload.' };
  }

  return { valid: true, error: null };
}

module.exports = {
  verifyAuth,
  checkRateLimit,
  getCorsHeaders,
  getOriginHeader,
  validatePayload,
};
