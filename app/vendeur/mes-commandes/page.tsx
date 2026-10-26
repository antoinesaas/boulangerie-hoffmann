import type { Metadata } from "next"
import { ListeCommandes } from "@/components/commandes/ListeCommandes"
import { exigerRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import type { PointDeVente, Produit } from "@/types"

export const metadata: Metadata = { title: "Mes commandes" }

export default async function PageMesCommandes() {
  const { profil, pointDeVente } = await exigerRole("vendeur", "admin", "appareil")
  const supabase = await createClient()
  const [{ data: pointsDeVente }, { data: produits }] = await Promise.all([
    supabase.from("points_de_vente").select("id, nom").order("ordre").order("nom"),
    supabase.from("produits").select("id, nom, unite").order("ordre").order("nom"),
  ])

  return (
    <ListeCommandes
      role={profil.role}
      pointDeVenteId={profil.role === "admin" ? null : (pointDeVente?.id ?? null)}
      pointsDeVente={(pointsDeVente ?? []) as Pick<PointDeVente, "id" | "nom">[]}
      produits={(produits ?? []) as Pick<Produit, "id" | "nom" | "unite">[]}
    />
  )
}
