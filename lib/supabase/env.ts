// Accepte les nouvelles clés "publishable" (sb_publishable_…) comme les anciennes clés anon.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

export const supabaseConfigure = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY)
