import "server-only"

import { createClient } from "@supabase/supabase-js"
import { SUPABASE_URL } from "./env"

const SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""

export const adminConfigure = Boolean(SUPABASE_URL && SECRET_KEY)

/**
 * Client "service role" : contourne la RLS. Uniquement pour la gestion des comptes
 * (création, mot de passe, suppression), après vérification du rôle admin.
 */
export function createAdminClient() {
  if (!adminConfigure) {
    throw new Error("SUPABASE_SECRET_KEY manquante : la gestion des comptes est désactivée.")
  }
  return createClient(SUPABASE_URL, SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
