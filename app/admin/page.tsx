import type { Metadata } from "next"
import { TableauDeBord } from "@/components/commandes/TableauDeBord"
import { exigerRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import type { PointDeVente } from "@/types"

export const metadata: Metadata = { title: "Tableau de bord" }

export default async function PageAdmin() {
  await exigerRole("admin")
  const supabase = await createClient()
  const { data } = await supabase.from("points_de_vente").select("id, nom").order("ordre").order("nom")
  return <TableauDeBord pointsDeVente={(data ?? []) as Pick<PointDeVente, "id" | "nom">[]} />
}
