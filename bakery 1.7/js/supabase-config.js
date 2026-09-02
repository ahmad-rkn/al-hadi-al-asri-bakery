/* =========================================================================
   SUPABASE CONFIG — DO NOT put real credentials in this file by hand.
   =========================================================================
   On Netlify, build.js generates this file automatically at deploy time
   from the SUPABASE_URL and SUPABASE_ANON_KEY environment variables you
   set in the Netlify dashboard (Site settings → Environment variables).
   See SUPABASE_SETUP.md for the exact steps.

   The values below are intentionally empty. As long as they're empty,
   the site simply uses the built-in menu from js/config.js — nothing
   breaks, there's no error, the admin panel just won't have anything to
   connect to yet.

   The Supabase "anon" key is NOT a secret — it's meant to be public and
   is safe in browser code; your data is protected by Row Level Security
   (RLS) in the database, not by hiding this key. Still, we keep it out of
   this tracked file and inject it at build time so it's easy to change
   per environment (e.g. a staging vs. production Supabase project)
   without editing code.
   ========================================================================= */
window.SUPABASE_URL = "";
window.SUPABASE_ANON_KEY = "";
