import type { Metadata } from "next"
import { FormulaireCommande } from "@/components/commandes/FormulaireCommande"
import { exigerRole } from "@/lib/auth"
import { toutesLesPages } from "@/lib/supabase/pagination"
import { createClient } from "@/lib/supabase/server"
import type { Client, PointDeVente, Produit } from "@/types"

export const metadata: Metadata = { title: "Nouvelle commande" }

export default async function PageNouvelleCommande() {
  const { profil, pointDeVente } = await exigerRole("vendeur", "admin")
  const supabase = await createClient()

  // Pros et réguliers : tous. Occasionnels : les plus récents (les autres via la recherche serveur).
  const [produits, habituels, occasionnels, pointsDeVente] = await Promise.all([
    supabase.from("produits").select("*").eq("actif", true).order("ordre").order("nom"),
    toutesLesPages<Client>((debut, fin) =>
      supabase.from("clients").select("*").eq("actif", true).neq("type", "occasionnel").order("nom").order("id").range(debut, fin),
    ),
    supabase
      .from("clients")
      .select("*")
      .eq("actif", true)
      .eq("type", "occasionnel")
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("points_de_vente").select("id, nom").eq("actif", true).order("ordre").order("nom"),
  ])
  const clients = [...habituels, ...((occasionnels.data ?? []) as Client[])]

  if (profil.role === "vendeur" && !pointDeVente) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Aucun point de vente n&apos;est associé à votre compte. Demandez au patron de vous en attribuer un.
      </div>
    )
  }

  return (
    <FormulaireCommande
      produits={(produits.data ?? []) as Produit[]}
      clients={clients}
      pointsDeVente={(pointsDeVente.data ?? []) as Pick<PointDeVente, "id" | "nom">[]}
      pointDeVenteFixe={profil.role === "vendeur" ? pointDeVente : null}
    />
  )
}
