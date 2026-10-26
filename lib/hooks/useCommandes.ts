"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { CommandeDetail, StatutCommande } from "@/types"
import { useRealtime, type EtatRealtime } from "./useRealtime"

export const SELECT_COMMANDE_DETAIL = `
  *,
  client:clients(id, nom, type, telephone),
  point_de_vente:points_de_vente(id, nom),
  lignes:lignes_commande(*, produit:produits(id, nom, unite, categorie, ordre))
`

export interface FiltresCommandes {
  dateDebut: string
  dateFin: string
  pointDeVenteId?: string | null
  statuts?: StatutCommande[]
}

/** Commandes détaillées sur une période, rafraîchies en temps réel. */
export function useCommandes(filtres: FiltresCommandes) {
  const [commandes, setCommandes] = useState<CommandeDetail[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const { dateDebut, dateFin, pointDeVenteId } = filtres
  const cleStatuts = filtres.statuts?.join(",") ?? ""

  const charger = useCallback(async () => {
    const supabase = createClient()
    // Crée à l'avance les commandes habituelles de la période (sans effet si déjà faites).
    await supabase.rpc("generer_recurrences", { p_jusqu_au: dateFin })
    let requete = supabase
      .from("commandes")
      .select(SELECT_COMMANDE_DETAIL)
      .gte("date_livraison", dateDebut)
      .lte("date_livraison", dateFin)
      .order("date_livraison", { ascending: true })
      .order("cree_le", { ascending: true })
    if (pointDeVenteId) requete = requete.eq("point_de_vente_id", pointDeVenteId)
    if (cleStatuts) requete = requete.in("statut", cleStatuts.split(","))

    const { data, error } = await requete
    if (error) {
      setErreur(error.message)
    } else {
      setErreur(null)
      setCommandes(trierLignes(data as CommandeDetail[]))
    }
    setChargement(false)
  }, [dateDebut, dateFin, pointDeVenteId, cleStatuts])

  useEffect(() => {
    // Chargement initial + à chaque changement de filtres.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void charger()
  }, [charger])

  const realtime: EtatRealtime = useRealtime(["commandes", "lignes_commande"], charger)

  /** Mise à jour optimiste locale (avant confirmation realtime). */
  const majLocale = useCallback((id: string, patch: Partial<CommandeDetail>) => {
    setCommandes((liste) => liste.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }, [])

  return { commandes, chargement, erreur, recharger: charger, realtime, majLocale }
}

function trierLignes(commandes: CommandeDetail[]): CommandeDetail[] {
  for (const c of commandes) {
    c.lignes?.sort((a, b) => (a.produit?.ordre ?? 0) - (b.produit?.ordre ?? 0))
  }
  return commandes
}

/** Change le statut d'une commande (RLS + trigger garde_commandes côté base). */
export async function changerStatut(id: string, statut: StatutCommande) {
  const supabase = createClient()
  const { error } = await supabase.from("commandes").update({ statut }).eq("id", id)
  return error
}
