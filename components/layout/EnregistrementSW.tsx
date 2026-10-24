"use client"

import { useEffect } from "react"

/** Enregistre le service worker (cache des pages vendeur pour l'usage hors ligne). */
export function EnregistrementSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Pas de service worker (navigation privée…) : la file localStorage suffit.
    })
  }, [])
  return null
}
