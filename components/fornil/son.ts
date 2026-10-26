"use client"

import { useEffect, useMemo, useRef, useState } from "react"

const CLE_SON = "bg:fornil:son"

/** Petit carillon Web Audio (aucun fichier son). Préférence mémorisée sur l'appareil. */
export function useSon() {
  const [actif, setActif] = useState(false)
  const contexte = useRef<AudioContext | null>(null)

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(CLE_SON) === "1") setActif(true)
    } catch {
      // Stockage indisponible : son coupé par défaut.
    }
  }, [])

  // Les navigateurs exigent un geste utilisateur avant de jouer du son.
  useEffect(() => {
    if (!actif) return
    const deverrouiller = () => {
      contexte.current ??= new AudioContext()
      void contexte.current.resume()
    }
    window.addEventListener("pointerdown", deverrouiller, { once: true })
    return () => window.removeEventListener("pointerdown", deverrouiller)
  }, [actif])

  return useMemo(
    () => ({
      actif,
      basculer: () => {
        const suivant = !actif
        setActif(suivant)
        try {
          localStorage.setItem(CLE_SON, suivant ? "1" : "0")
        } catch {
          // Préférence non mémorisée : sans conséquence.
        }
        if (suivant) {
          contexte.current ??= new AudioContext()
          void contexte.current.resume()
          carillon(contexte.current)
        }
      },
      jouer: () => {
        if (actif && contexte.current) carillon(contexte.current)
      },
    }),
    [actif],
  )
}

function carillon(ctx: AudioContext) {
  const debut = ctx.currentTime
  ;[880, 1320].forEach((frequence, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.value = frequence
    const t = debut + i * 0.18
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.55)
  })
}
