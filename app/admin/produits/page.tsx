import type { Metadata } from "next"
import { TableProduits } from "@/components/produits/TableProduits"
import { exigerRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import type { Produit } from "@/types"

export const metadata: Metadata = { title: "Produits" }

export default async function PageProduits() {
  await exigerRole("admin")
  const supabase = await createClient()
  const { data } = await supabase.from("produits").select("*").order("ordre").order("nom")
  return <TableProduits produitsInitiaux={(data ?? []) as Produit[]} />
}
