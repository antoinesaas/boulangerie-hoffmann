"use server"

import { revalidatePath } from "next/cache"
import { DUREE_CODE_MINUTES, hacherCode, nouveauCode } from "@/lib/appareils"
import { getSession } from "@/lib/auth"
import { adminConfigure, createAdminClient } from "@/lib/supabase/admin"

async function verifierAdmin() {
  const session = await getSession()
  if (session?.profil.role !== "admin") throw new Error("Accès réservé au patron.")
  if (!adminConfigure) throw new Error("SUPABASE_SECRET_KEY n'est pas configurée sur le serveur.")
  return session
}

export type ResultatCode = { ok: true; code: string; expireLe: string; nom: string } | { ok: false; erreur: string }

/** Génère un code d'activation à usage unique, valable quelques minutes. */
export async function genererCode(nomAppareil: string): Promise<ResultatCode> {
  try {
    const session = await verifierAdmin()
    const nom = nomAppareil.trim().slice(0, 60)
    if (!nom) throw new Error("Donnez un nom à l'appareil (ex. « Téléphone Coffret »).")
    const code = nouveauCode()
    const expireLe = new Date(Date.now() + DUREE_CODE_MINUTES * 60_000).toISOString()
    const { error } = await createAdminClient()
      .from("codes_activation")
      .insert({ code_hash: hacherCode(code), nom_appareil: nom, expire_le: expireLe, cree_par: session.profil.id })
    if (error) throw new Error(error.message)
    return { ok: true, code, expireLe, nom }
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : String(e) }
  }
}

/** Retire l'accès d'un appareil (perdu, volé, remplacé). Effet immédiat. */
export async function desactiverAppareil(id: string): Promise<{ ok: boolean; erreur?: string }> {
  try {
    await verifierAdmin()
    const admin = createAdminClient()
    const { data: profil } = await admin.from("profils").select("role").eq("id", id).maybeSingle()
    if (profil?.role !== "appareil") throw new Error("Cet identifiant n'est pas un appareil.")
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) throw new Error(error.message)
    revalidatePath("/admin/appareils")
    return { ok: true }
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : String(e) }
  }
}
