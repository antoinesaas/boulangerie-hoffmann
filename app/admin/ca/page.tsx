import type { Metadata } from "next"
import { DashboardCA } from "@/components/ca/DashboardCA"
import { exigerRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { TYPES_CLIENT_PRO, type Client, type PointDeVente } from "@/types"

export const metadata: Metadata = { title: "Chiffre d'affaires" }

export default async function PageCA() {
  await exigerRole("admin")
  const supabase = await createClient()
  const [pdv, clients] = await Promise.all([
    supabase.from("points_de_vente").select("id, nom").order("ordre").order("nom"),
    supabase.from("clients").select("id, nom, type").eq("actif", true).in("type", TYPES_CLIENT_PRO).order("nom"),
  ])

  return (
    <DashboardCA
      pointsDeVente={(pdv.data ?? []) as Pick<PointDeVente, "id" | "nom">[]}
      clientsPros={(clients.data ?? []) as Pick<Client, "id" | "nom" | "type">[]}
    />
  )
}
