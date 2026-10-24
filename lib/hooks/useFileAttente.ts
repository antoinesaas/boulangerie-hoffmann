"use client"

import { useEffect, useSyncExternalStore } from "react"
import { abonner, lireFile, lireFileServeur, synchroniser } from "@/lib/offline/fileAttente"

const abonnerReseau = (e: () => void) => {
  window.addEventListener("online", e)
  window.addEventListener("offline", e)
  return () => {
    window.removeEventListener("online", e)
    window.removeEventListener("offline", e)
  }
}

export function useEnLigne(): boolean {
  return useSyncExternalStore(
    abonnerReseau,
    () => navigator.onLine,
    () => true,
  )
}

export function useFileAttente() {
  return useSyncExternalStore(abonner, lireFile, lireFileServeur)
}

/** Relance l'envoi de la file : au montage, au retour du réseau, et toutes les 20 s. */
export function useSynchroAuto() {
  const file = useFileAttente()
  const aEnvoyer = file.some((o) => !o.erreur)

  useEffect(() => {
    const lancer = () => void synchroniser()
    lancer()
    window.addEventListener("online", lancer)
    const surVisibilite = () => document.visibilityState === "visible" && lancer()
    document.addEventListener("visibilitychange", surVisibilite)
    return () => {
      window.removeEventListener("online", lancer)
      document.removeEventListener("visibilitychange", surVisibilite)
    }
  }, [])

  useEffect(() => {
    if (!aEnvoyer) return
    const intervalle = setInterval(() => void synchroniser(), 20_000)
    return () => clearInterval(intervalle)
  }, [aEnvoyer])

  return file
}
