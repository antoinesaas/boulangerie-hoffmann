"use server"

import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth"
import { estRole } from "@/lib/roles"
import { adminConfigure, createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import type { Role } from "@/types"

export interface Resultat {
  ok: boolean
  erreur?: string
}

const BAN_PERMANENT = "876000h"

async function verifierAdmin() {
  const session = await getSession()
  if (session?.profil.role !== "admin") throw new Error("Accès réservé au patron.")
  if (!adminConfigure) throw new Error("SUPABASE_SECRET_KEY n'est pas configurée sur le serveur.")
  return session
}

function echec(e: unknown): Resultat {
  return { ok: false, erreur: e instanceof Error ? e.message : String(e) }
}

function lireRole(valeur: FormDataEntryValue | null): Role {
  const role = String(valeur ?? "")
  if (!estRole(role)) throw new Error("Rôle invalide.")
  return role
}

function lirePdv(role: Role, valeur: FormDataEntryValue | null): string | null {
  const pdv = String(valeur ?? "")
  if (role === "vendeur" && !pdv) throw new Error("Un vendeur doit être rattaché à un point de vente.")
  return role === "vendeur" ? pdv : null
}

export async function creerUtilisateur(formData: FormData): Promise<Resultat> {
  try {
    await verifierAdmin()
    const email = String(formData.get("email") ?? "").trim().toLowerCase()
    const motDePasse = String(formData.get("mot_de_passe") ?? "")
    const nom = String(formData.get("nom") ?? "").trim()
    const role = lireRole(formData.get("role"))
    const pdv = lirePdv(role, formData.get("point_de_vente_id"))
    if (!email || !nom) throw new Error("Nom et email requis.")
    if (motDePasse.length < 8) throw new Error("Le mot de passe doit faire au moins 8 caractères.")

    const admin = createAdminClient()
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: motDePasse,
      email_confirm: true,
      user_metadata: { nom },
      app_metadata: { role, point_de_vente_id: pdv },
    })
    if (error) throw new Error(error.message === "A user with this email address has already been registered" ? "Cet email a déjà un compte." : error.message)

    // Le trigger crée le profil ; on le complète (cas d'un trigger déjà passé ou ancien compte).
    const { error: errProfil } = await admin
      .from("profils")
      .upsert({ id: data.user.id, email, nom, role, point_de_vente_id: pdv, actif: true })
    if (errProfil) throw new Error(errProfil.message)

    revalidatePath("/admin/utilisateurs")
    return { ok: true }
  } catch (e) {
    return echec(e)
  }
}

export async function modifierUtilisateur(
  id: string,
  valeurs: { nom?: string; role?: Role; point_de_vente_id?: string | null; actif?: boolean },
): Promise<Resultat> {
  try {
    const session = await verifierAdmin()
    if (id === session.profil.id && (valeurs.role && valeurs.role !== "admin")) {
      throw new Error("Vous ne pouvez pas retirer votre propre rôle de patron.")
    }
    if (id === session.profil.id && valeurs.actif === false) {
      throw new Error("Vous ne pouvez pas désactiver votre propre compte.")
    }
    if (valeurs.role !== undefined && !estRole(valeurs.role)) throw new Error("Rôle invalide.")

    // Uniquement les champs modifiables (les valeurs viennent du navigateur).
    const patch: Record<string, unknown> = {}
    if (valeurs.nom !== undefined) patch.nom = String(valeurs.nom).trim()
    if (valeurs.role !== undefined) patch.role = valeurs.role
    if (valeurs.point_de_vente_id !== undefined) patch.point_de_vente_id = valeurs.point_de_vente_id || null
    if (valeurs.actif !== undefined) patch.actif = Boolean(valeurs.actif)
    if (valeurs.role && valeurs.role !== "vendeur") patch.point_de_vente_id = null

    const supabase = await createClient()
    const { data: profil, error } = await supabase.from("profils").update(patch).eq("id", id).select().single()
    if (error) throw new Error(error.message)

    const admin = createAdminClient()
    const { error: errAuth } = await admin.auth.admin.updateUserById(id, {
      app_metadata: { role: profil.role, point_de_vente_id: profil.point_de_vente_id },
      ...(valeurs.actif !== undefined ? { ban_duration: valeurs.actif ? "none" : BAN_PERMANENT } : {}),
      ...(valeurs.nom ? { user_metadata: { nom: valeurs.nom } } : {}),
    })
    if (errAuth) throw new Error(errAuth.message)

    revalidatePath("/admin/utilisateurs")
    return { ok: true }
  } catch (e) {
    return echec(e)
  }
}

export async function changerMotDePasse(id: string, motDePasse: string): Promise<Resultat> {
  try {
    await verifierAdmin()
    if (motDePasse.length < 8) throw new Error("Le mot de passe doit faire au moins 8 caractères.")
    const { error } = await createAdminClient().auth.admin.updateUserById(id, { password: motDePasse })
    if (error) throw new Error(error.message)
    return { ok: true }
  } catch (e) {
    return echec(e)
  }
}

export async function supprimerUtilisateur(id: string): Promise<Resultat> {
  try {
    const session = await verifierAdmin()
    if (id === session.profil.id) throw new Error("Vous ne pouvez pas supprimer votre propre compte.")
    const { error } = await createAdminClient().auth.admin.deleteUser(id)
    if (error) throw new Error(error.message)
    revalidatePath("/admin/utilisateurs")
    return { ok: true }
  } catch (e) {
    return echec(e)
  }
}
