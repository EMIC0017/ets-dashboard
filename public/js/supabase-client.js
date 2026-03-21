/* ─────────────────────────────────────────────
   supabase-client.js — Supabase singleton
   ───────────────────────────────────────────── */

const SUPABASE_URL = 'https://dhydigvxccpupeljqlqv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeWRpZ3Z4Y2NwdXBlbGpxbHF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNzU2ODcsImV4cCI6MjA4OTY1MTY4N30.VLvLdxiwXYTzvoJe6JNNdB3wtuGBvBjwzQj8C4pKn3w';

// Created after the Supabase CDN script loads (see index.html)
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
