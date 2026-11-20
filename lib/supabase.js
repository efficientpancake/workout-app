"use client";

import { createBrowserClient } from "@supabase/ssr";

// Uses the two public values set in Vercel (and .env.local for localhost).
// Never put the service_role / secret key here.
export const authConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

let client = null;

export function supabaseBrowser() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }
  return client;
}
