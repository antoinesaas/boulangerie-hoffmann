import type { Metadata } from "next"
import { GestionUtilisateurs } from "@/components/utilisateurs/GestionUtilisateurs"
import { exigerRole } from "@/lib/auth"
import { adminConfigure, createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import type { PointDeVente, Profil } from "@/types"

export const metadata: Metadata = { title: "Utilisateurs" }

export default async function PageUtilisateurs() {
  const { profil: moi } = await exigerRole("admin")
  const supabase = await createClient()
  const [profils, pdv] = await Promise.all([
    supabase.from("profils").select("*").order("nom"),
    supabase.from("points_de_vente").select("id, nom").order("ordre").order("nom"),
  ])

  // Dernière connexion (optionnel : nécessite la clé secrète).
  const connexions: Record<string, string | null> = {}
  if (adminConfigure) {
    const { data } = await createAdminClient().auth.admin.listUsers({ perPage: 1000 })
    for (const u of data?.users ?? []) connexions[u.id] = u.last_sign_in_at ?? null
  }

  return (
    <GestionUtilisateurs
      moiId={moi.id}
      profils={(profils.data ?? []) as Profil[]}
      pointsDeVente={(pdv.data ?? []) as Pick<PointDeVente, "id" | "nom">[]}
      connexions={connexions}
      gestionActive={adminConfigure}
    />
  )
}
