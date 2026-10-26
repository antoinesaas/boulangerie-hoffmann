"use client"

import { useCallback, useEffect, useState } from "react"
import { cleProduction } from "@/lib/fornil"
import { createClient } from "@/lib/supabase/client"
import { useRealtime } from "./useRealtime"

/**
 * Quantités validées « finies » au fornil pour un jour, par magasin (ou client livré) et par produit,
 * partagées en temps réel entre appareils.
 */
export function useProduction(jour: string) {
  const [pointees, setPointees] = useState<Map<string, number>>(new Map())

  const charger = useCallback(async () => {
    const { data } = await createClient()
      .from("production_faite")
      .select("destination, produit_id, quantite")
      .eq("date_production", jour)
    setPointees(
      new Map((data ?? []).map((l) => [cleProduction(l.destination as string, l.produit_id as string), Number(l.quantite)])),
    )
  }, [jour])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void charger()
  }, [charger])
  useRealtime(["production_faite"], charger, { delai: 200 })

  const pointer = useCallback(
    async (destination: string, produitId: string, quantite: number) => {
      setPointees((m) => new Map(m).set(cleProduction(destination, produitId), quantite))
      const { error } = await createClient()
        .from("production_faite")
        .upsert(
          {
            date_production: jour,
            destination,
            produit_id: produitId,
            quantite: Math.max(0, quantite),
            maj_le: new Date().toISOString(),
          },
          { onConflict: "date_production,destination,produit_id" },
        )
      if (error) void charger()
      return error
    },
    [jour, charger],
  )

  return { pointees, pointer }
}
