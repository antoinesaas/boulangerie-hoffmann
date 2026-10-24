import type { Metadata } from "next"
import { TableClients } from "@/components/clients/TableClients"
import { exigerRole } from "@/lib/auth"
import { toutesLesPages } from "@/lib/supabase/pagination"
import { createClient } from "@/lib/supabase/server"
import type { Client } from "@/types"

export const metadata: Metadata = { title: "Clients" }

export default async function PageClients() {
  await exigerRole("admin")
  const supabase = await createClient()
  const clients = await toutesLesPages<Client>((debut, fin) =>
    supabase.from("clients").select("*").order("nom").order("id").range(debut, fin),
  )
  return <TableClients clientsInitiaux={clients} />
}
