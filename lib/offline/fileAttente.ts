"use client"

import type { PostgrestError } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import type { OperationEnAttente } from "@/types"

// File d'attente hors ligne : les opérations (nouveau client, commande) sont d'abord
// écrites dans localStorage puis envoyées dans l'ordre. Une coupure réseau laisse
// l'opération dans la file ; une erreur métier la marque en erreur (action manuelle).

const CLE = "bg:file-attente:v1"
const VIDE: OperationEnAttente[] = []

let cache: OperationEnAttente[] | null = null
const ecouteurs = new Set<() => void>()

export function lireFile(): OperationEnAttente[] {
  if (cache) return cache
  try {
    const brut = localStorage.getItem(CLE)
    cache = brut ? (JSON.parse(brut) as OperationEnAttente[]) : VIDE
  } catch {
    cache = VIDE
  }
  return cache
}

export function lireFileServeur(): OperationEnAttente[] {
  return VIDE
}

function ecrire(file: OperationEnAttente[]) {
  cache = file
  try {
    localStorage.setItem(CLE, JSON.stringify(file))
  } catch {
    // Stockage plein ou bloqué : la file reste en mémoire pour la session.
  }
  ecouteurs.forEach((e) => e())
}

export function abonner(ecouteur: () => void) {
  ecouteurs.add(ecouteur)
  const surStockage = (e: StorageEvent) => {
    if (e.key === CLE) {
      cache = null
      ecouteur()
    }
  }
  window.addEventListener("storage", surStockage)
  return () => {
    ecouteurs.delete(ecouteur)
    window.removeEventListener("storage", surStockage)
  }
}

export function ajouterOperation(op: OperationEnAttente) {
  ecrire([...lireFile().filter((o) => o.id !== op.id), op])
}

export function retirerOperation(id: string) {
  ecrire(lireFile().filter((o) => o.id !== id))
}

function marquerErreur(id: string, erreur: string) {
  ecrire(lireFile().map((o) => (o.id === id ? { ...o, erreur } : o)))
}

/** Remet une opération en erreur dans le circuit d'envoi. */
export function reessayerOperation(id: string) {
  ecrire(lireFile().map((o) => (o.id === id ? { ...o, erreur: undefined } : o)))
}

/** Erreur transitoire (réseau, serveur, jeton expiré) : on réessaiera plus tard. */
export function estErreurTransitoire(erreur: Pick<PostgrestError, "code" | "message">): boolean {
  if (!erreur.code) return true
  if (erreur.code.startsWith("PGRST3")) return true
  return /fetch|network|load failed/i.test(erreur.message)
}

export interface ResultatSynchro {
  envoyees: string[]
  restantes: number
  horsLigne: boolean
}

let synchroEnCours: Promise<ResultatSynchro> | null = null

/** Envoie la file dans l'ordre. Appels concurrents fusionnés. */
export function synchroniser(): Promise<ResultatSynchro> {
  synchroEnCours ??= executerSynchro().finally(() => {
    synchroEnCours = null
  })
  return synchroEnCours
}

async function executerSynchro(): Promise<ResultatSynchro> {
  const supabase = createClient()
  const envoyees: string[] = []
  let horsLigne = false

  for (const op of lireFile()) {
    if (op.erreur) continue

    let erreur: PostgrestError | null = null
    try {
      if (op.type === "client") {
        ;({ error: erreur } = await supabase
          .from("clients")
          .upsert(op.data, { onConflict: "id", ignoreDuplicates: true }))
      } else {
        ;({ error: erreur } = await supabase.rpc("creer_commande", op.data))
      }
    } catch (e) {
      erreur = { code: "", message: String(e), details: "", hint: "", name: "PostgrestError" } as PostgrestError
    }

    if (!erreur) {
      retirerOperation(op.id)
      envoyees.push(op.id)
    } else if (estErreurTransitoire(erreur)) {
      horsLigne = true
      break
    } else {
      marquerErreur(op.id, erreur.message)
    }
  }

  return { envoyees, restantes: lireFile().length, horsLigne }
}
