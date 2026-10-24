"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export type EtatRealtime = "connexion" | "connecte" | "deconnecte"

/**
 * S'abonne aux changements Postgres des tables données et appelle `surChangement`
 * (regroupé sur `delai` ms pour éviter les rafales : une commande = 1 insert + N lignes).
 */
export function useRealtime(
  tables: string[],
  surChangement: () => void,
  { delai = 300, actif = true }: { delai?: number; actif?: boolean } = {},
): EtatRealtime {
  const [etat, setEtat] = useState<EtatRealtime>("connexion")
  const rappel = useRef(surChangement)
  const cleTables = tables.join(",")

  useEffect(() => {
    rappel.current = surChangement
  })

  useEffect(() => {
    if (!actif) return
    const supabase = createClient()
    let minuteur: ReturnType<typeof setTimeout> | undefined
    const declencher = () => {
      clearTimeout(minuteur)
      minuteur = setTimeout(() => rappel.current(), delai)
    }

    let canal = supabase.channel(`rt-${cleTables}-${Math.random().toString(36).slice(2)}`)
    for (const table of cleTables.split(",")) {
      canal = canal.on("postgres_changes", { event: "*", schema: "public", table }, declencher)
    }
    canal.subscribe((statut) => {
      if (statut === "SUBSCRIBED") {
        setEtat("connecte")
        // Rattrape ce qui a pu être manqué pendant une coupure.
        declencher()
      } else if (statut === "CHANNEL_ERROR" || statut === "TIMED_OUT" || statut === "CLOSED") {
        setEtat("deconnecte")
      }
    })

    return () => {
      clearTimeout(minuteur)
      supabase.removeChannel(canal)
    }
  }, [cleTables, delai, actif])

  return etat
}
