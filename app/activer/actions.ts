"use server"

import { redirect } from "next/navigation"
import { ESSAIS_MAX, hacherCode, identifiantsAppareil } from "@/lib/appareils"
import { adminConfigure, createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export interface EtatActivation {
  erreur?: string
}

/**
 * Active cet appareil avec un code à usage unique généré par le patron :
 * crée un compte technique "appareil" et ouvre une session qui reste active.
 */
export async function activerAppareil(_etat: EtatActivation, formData: FormData): Promise<EtatActivation> {
  const code = String(formData.get("code") ?? "").replace(/\D/g, "")
  if (code.length !== 6) return { erreur: "Le code fait 6 chiffres." }
  if (!adminConfigure) return { erreur: "Activation indisponible : configuration serveur incomplète." }

  const admin = createAdminClient()
  const { data: codes, error } = await admin
    .from("codes_activation")
    .select("id, code_hash, nom_appareil, essais")
    .is("utilise_le", null)
    .gt("expire_le", new Date().toISOString())
    .lt("essais", ESSAIS_MAX)
  if (error) return { erreur: "Activation impossible pour le moment. Réessayez." }

  const trouve = codes?.find((c) => c.code_hash === hacherCode(code))
  if (!trouve) {
    // Limite les essais au hasard : chaque erreur use tous les codes en cours.
    await Promise.all(
      (codes ?? []).map((c) => admin.from("codes_activation").update({ essais: c.essais + 1 }).eq("id", c.id)),
    )
    return { erreur: "Code incorrect ou expiré. Demandez un nouveau code au patron." }
  }

  const { data: consomme } = await admin
    .from("codes_activation")
    .update({ utilise_le: new Date().toISOString() })
    .eq("id", trouve.id)
    .is("utilise_le", null)
    .select("id")
  if (!consomme?.length) return { erreur: "Ce code vient d'être utilisé. Demandez-en un nouveau." }

  const { email, motDePasse } = identifiantsAppareil()
  const { data: cree, error: errCreation } = await admin.auth.admin.createUser({
    email,
    password: motDePasse,
    email_confirm: true,
    user_metadata: { nom: trouve.nom_appareil },
    app_metadata: { role: "appareil" },
  })
  if (errCreation || !cree.user) return { erreur: "Activation impossible pour le moment. Réessayez." }

  await admin
    .from("profils")
    .upsert({ id: cree.user.id, email, nom: trouve.nom_appareil, role: "appareil", point_de_vente_id: null, actif: true })

  const supabase = await createClient()
  const { error: errSession } = await supabase.auth.signInWithPassword({ email, password: motDePasse })
  if (errSession) return { erreur: "Activation impossible pour le moment. Réessayez." }

  redirect("/mode")
}
