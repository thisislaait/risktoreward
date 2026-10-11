'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL, authEnabled } from './config';

let client: SupabaseClient | null = null;

/** The browser Supabase client, or null in local mode. Sessions live in cookies shared with the proxy. */
export function getSupabase(): SupabaseClient | null {
  if (!authEnabled) return null;
  if (!client) client = createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
  return client;
}
