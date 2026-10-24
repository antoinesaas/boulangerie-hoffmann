import "server-only"

import { redirect } from "next/navigation"
import { cache } from "react"
import { ACCUEIL_PAR_ROLE, estRole } from "@/lib/roles"
import { createClient } from "@/lib/supabase/server"
import type { PointDeVente, Profil, Role } from "@/types"

export interface Session {
  profil: Profil & { role: Role }
  pointDeVente: Pick<PointDeVente, "id" | "nom"> | null
}

/** Profil de l'utilisateur connecté (null si non connecté ou sans rôle). Mémoïsé par requête. */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId) return null

  const { data: profil } = await supabase
    .from("profils")
    .select("*, point_de_vente:points_de_vente(id, nom)")
    .eq("id", userId)
    .maybeSingle()

  if (!profil || !profil.actif || !estRole(profil.role)) return null

  const { point_de_vente, ...reste } = profil as Profil & {
    point_de_vente: Pick<PointDeVente, "id" | "nom"> | null
  }
  return { profil: reste as Session["profil"], pointDeVente: point_de_vente }
})

/** À appeler en tête de page/action : redirige si le rôle n'est pas autorisé. */
export async function exigerRole(...roles: Role[]): Promise<Session> {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!roles.includes(session.profil.role)) redirect(ACCUEIL_PAR_ROLE[session.profil.role])
  return session
}
