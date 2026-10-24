"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { StatutCommande } from "@/types"
import { useRealtime } from "./useRealtime"

export interface CompteJour {
  total: number
  enAttente: number
}

const TAILLE_PAGE = 1000

/** Nombre de commandes (hors annulées) par jour de livraison, pour le calendrier. */
export function useComptesJours(debut: string, fin: string, pointDeVenteId?: string | null) {
  const [comptes, setComptes] = useState<Map<string, CompteJour>>(new Map())

  const charger = useCallback(async () => {
    const supabase = createClient()
    const lignes: { date_livraison: string; statut: StatutCommande }[] = []
    for (let page = 0; ; page++) {
      let requete = supabase
        .from("commandes")
        .select("date_livraison, statut")
        .gte("date_livraison", debut)
        .lte("date_livraison", fin)
        .neq("statut", "annulee")
        .order("date_livraison")
        .range(page * TAILLE_PAGE, (page + 1) * TAILLE_PAGE - 1)
      if (pointDeVenteId) requete = requete.eq("point_de_vente_id", pointDeVenteId)
      const { data, error } = await requete
      if (error || !data) return
      lignes.push(...(data as typeof lignes))
      if (data.length < TAILLE_PAGE) break
    }
    const resultat = new Map<string, CompteJour>()
    for (const l of lignes) {
      const c = resultat.get(l.date_livraison) ?? { total: 0, enAttente: 0 }
      c.total++
      if (l.statut === "en_attente") c.enAttente++
      resultat.set(l.date_livraison, c)
    }
    setComptes(resultat)
  }, [debut, fin, pointDeVenteId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void charger()
  }, [charger])

  useRealtime(["commandes"], charger, { delai: 800 })

  return comptes
}
