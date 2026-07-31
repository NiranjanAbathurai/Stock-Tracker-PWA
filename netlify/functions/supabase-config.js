// Supabase configuration for Netlify Functions
// Uses environment variables set in Netlify dashboard

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_SECRET_KEY = process.env.SUPABASE_SERVICE_SECRET_KEY;

module.exports = { SUPABASE_URL, SUPABASE_SERVICE_SECRET_KEY };
