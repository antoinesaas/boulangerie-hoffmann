import type { Metadata } from "next"
import { VueFornil } from "@/components/fornil/VueFornil"
import { exigerRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import type { PointDeVente } from "@/types"

export const metadata: Metadata = { title: "Fornil" }

export default async function PageFornil() {
  const { profil } = await exigerRole("boulanger", "admin", "appareil")
  const supabase = await createClient()
  const { data: pointsDeVente } = await supabase
    .from("points_de_vente")
    .select("id, nom")
    .order("ordre")
    .order("nom")

  return (
    <VueFornil
      pointsDeVente={(pointsDeVente ?? []) as Pick<PointDeVente, "id" | "nom">[]}
      utilisateur={{ nom: profil.nom, role: profil.role }}
    />
  )
}
