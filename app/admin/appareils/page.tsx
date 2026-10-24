import type { Metadata } from "next"
import { GestionAppareils } from "@/components/appareils/GestionAppareils"
import { exigerRole } from "@/lib/auth"
import { adminConfigure } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import type { Profil } from "@/types"

export const metadata: Metadata = { title: "Appareils" }

export default async function PageAppareils() {
  await exigerRole("admin")
  const supabase = await createClient()
  const { data } = await supabase
    .from("profils")
    .select("*")
    .eq("role", "appareil")
    .order("created_at", { ascending: false })

  return <GestionAppareils appareils={(data ?? []) as Profil[]} gestionActive={adminConfigure} />
}
