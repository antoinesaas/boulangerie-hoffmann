import type { Metadata } from "next"
import { GestionCommandes } from "@/components/commandes/GestionCommandes"
import { exigerRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import type { PointDeVente } from "@/types"

export const metadata: Metadata = { title: "Commandes" }

export default async function PageCommandes() {
  await exigerRole("admin")
  const supabase = await createClient()
  const { data } = await supabase.from("points_de_vente").select("id, nom").order("ordre").order("nom")
  return <GestionCommandes pointsDeVente={(data ?? []) as Pick<PointDeVente, "id" | "nom">[]} />
}
