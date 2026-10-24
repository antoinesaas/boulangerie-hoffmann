"use server"

import { redirect } from "next/navigation"
import { ACCUEIL_PAR_ROLE, estRole } from "@/lib/roles"
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
  redirect("/login")
}
