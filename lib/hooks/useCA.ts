"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { LigneCAJour, LigneVenteProduitJour } from "@/types"
import { useRealtime } from "./useRealtime"

const TAILLE_PAGE = 1000

/** Lit une vue page par page (l'API Supabase plafonne à 1000 lignes par requête). */
async function toutesLesLignes<T>(vue: string, debut: string, fin: string): Promise<T[]> {
  const supabase = createClient()
  const lignes: T[] = []
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from(vue)
      .select("*")
      .gte("date_livraison", debut)
      .lte("date_livraison", fin)
      .order("date_livraison")
      .range(page * TAILLE_PAGE, (page + 1) * TAILLE_PAGE - 1)
    if (error) throw error
    lignes.push(...(data as T[]))
    if (!data || data.length < TAILLE_PAGE) return lignes
  }
}

/** Données CA agrégées sur une période, rafraîchies en temps réel. */
export function useCA(debut: string, fin: string, { produits = false }: { produits?: boolean } = {}) {
  const [ca, setCA] = useState<LigneCAJour[]>([])
  const [ventes, setVentes] = useState<LigneVenteProduitJour[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

  const charger = useCallback(async () => {
    setChargement(true)
    try {
      const [lignesCA, lignesProduits] = await Promise.all([
        toutesLesLignes<LigneCAJour>("vue_ca_jour", debut, fin),
        produits ? toutesLesLignes<LigneVenteProduitJour>("vue_ventes_produits_jour", debut, fin) : Promise.resolve([]),
      ])
      setCA(lignesCA)
      setVentes(lignesProduits)
      setErreur(null)
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String((e as { message?: string }).message ?? e))
    } finally {
      setChargement(false)
    }
  }, [debut, fin, produits])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void charger()
  }, [charger])

  const realtime = useRealtime(["commandes", "lignes_commande"], charger, { delai: 1_000 })

  return { ca, ventes, chargement, erreur, realtime }
}
