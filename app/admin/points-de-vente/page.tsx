import type { Metadata } from "next"
import { GestionPointsDeVente } from "@/components/pointsDeVente/GestionPointsDeVente"
import { exigerRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import type { PointDeVente } from "@/types"

export const metadata: Metadata = { title: "Points de vente" }

export default async function PagePointsDeVente() {
  await exigerRole("admin")
  const supabase = await createClient()
  const { data } = await supabase.from("points_de_vente").select("*").order("ordre").order("nom")
  return <GestionPointsDeVente initiaux={(data ?? []) as PointDeVente[]} />
}
