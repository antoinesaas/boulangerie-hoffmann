"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env"

let client: SupabaseClient | undefined

/** Client navigateur (singleton) : requêtes RLS + Realtime avec la session de l'utilisateur. */
export function createClient(): SupabaseClient {
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  return client
}
