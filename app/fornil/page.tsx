import type { Metadata } from "next"
import { VueFornil } from "@/components/fornil/VueFornil"
import { exigerRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import type { PointDeVente, Produit } from "@/types"

export const metadata: Metadata = { title: "Fornil" }

export default async function PageFornil() {
  const { profil } = await exigerRole("boulanger", "admin", "appareil")
  const supabase = await createClient()
  const [{ data: pointsDeVente }, { data: produits }] = await Promise.all([
    supabase.from("points_de_vente").select("id, nom").order("ordre").order("nom"),
    supabase.from("produits").select("id, nom, unite, ordre").order("ordre").order("nom"),
  ])

  return (
    <VueFornil
      pointsDeVente={(pointsDeVente ?? []) as Pick<PointDeVente, "id" | "nom">[]}
      produits={(produits ?? []) as Pick<Produit, "id" | "nom" | "unite" | "ordre">[]}
      utilisateur={{ nom: profil.nom, role: profil.role }}
    />
  )
}
