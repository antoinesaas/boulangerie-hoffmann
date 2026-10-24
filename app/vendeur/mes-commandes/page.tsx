import type { Metadata } from "next"
import { ListeCommandes } from "@/components/commandes/ListeCommandes"
import { exigerRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import type { PointDeVente } from "@/types"

export const metadata: Metadata = { title: "Mes commandes" }

export default async function PageMesCommandes() {
  const { profil, pointDeVente } = await exigerRole("vendeur", "admin")
  const supabase = await createClient()
  const { data: pointsDeVente } = await supabase.from("points_de_vente").select("id, nom").order("ordre").order("nom")

  return (
    <ListeCommandes
      role={profil.role}
      pointDeVenteId={profil.role === "vendeur" ? (pointDeVente?.id ?? null) : null}
      pointsDeVente={(pointsDeVente ?? []) as Pick<PointDeVente, "id" | "nom">[]}
    />
  )
}
