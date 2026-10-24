"use server"

import { redirect } from "next/navigation"
import { ACCUEIL_PAR_ROLE, estRole } from "@/lib/roles"
import { adminConfigure, createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export interface EtatConnexion {
  erreur?: string
  email?: string
}

export async function connexion(_etat: EtatConnexion, formData: FormData): Promise<EtatConnexion> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const motDePasse = String(formData.get("mot_de_passe") ?? "")

  if (!email || !motDePasse) {
    return { erreur: "Email et mot de passe requis.", email }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: motDePasse })

  if (error || !data.user) {
    return {
      erreur:
        error?.code === "invalid_credentials"
          ? "Email ou mot de passe incorrect."
          : "Connexion impossible pour le moment. Réessayez.",
      email,
    }
  }

  const { data: profil } = await supabase
    .from("profils")
    .select("role, actif")
    .eq("id", data.user.id)
    .maybeSingle()

  if (!profil?.actif || !estRole(profil.role)) {
    await supabase.auth.signOut()
    return { erreur: "Ce compte n'a pas encore d'accès. Demandez au patron de lui attribuer un rôle.", email }
  }

  redirect(ACCUEIL_PAR_ROLE[profil.role])
}

export async function deconnexion() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/activer")
}

export interface EtatPremierAdmin {
  erreur?: string
  nom?: string
  email?: string
}

/** Création du tout premier compte patron. Fermée dès qu'un patron existe. */
export async function creerPremierAdmin(_etat: EtatPremierAdmin, formData: FormData): Promise<EtatPremierAdmin> {
  const nom = String(formData.get("nom") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const motDePasse = String(formData.get("mot_de_passe") ?? "")
  const confirmation = String(formData.get("confirmation") ?? "")
  const retour = { nom, email }

  if (!nom || !email) return { ...retour, erreur: "Nom et email requis." }
  if (motDePasse.length < 8) return { ...retour, erreur: "Le mot de passe doit faire au moins 8 caractères." }
  if (motDePasse !== confirmation) return { ...retour, erreur: "Les deux mots de passe sont différents." }
  if (!adminConfigure) return { ...retour, erreur: "Configuration serveur incomplète (clé secrète manquante)." }
  if (await patronExiste()) return { erreur: "Le compte patron existe déjà : connectez-vous." }

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: motDePasse,
    email_confirm: true,
    user_metadata: { nom },
    app_metadata: { role: "admin" },
  })
  if (error || !data.user) return { ...retour, erreur: error?.message ?? "Création impossible." }
  await admin.from("profils").upsert({ id: data.user.id, email, nom, role: "admin", point_de_vente_id: null, actif: true })

  const supabase = await createClient()
  await supabase.auth.signInWithPassword({ email, password: motDePasse })
  redirect("/admin")
}

export async function patronExiste(): Promise<boolean> {
  if (!adminConfigure) return true
  const { count } = await createAdminClient()
    .from("profils")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
  return (count ?? 0) > 0
}
