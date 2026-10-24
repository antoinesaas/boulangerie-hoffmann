"use client"

import { DownloadIcon, PlusSquareIcon, ShareIcon } from "lucide-react"
import { useEffect, useState, useSyncExternalStore } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface EvenementInstallation extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const sAbonner = () => () => {}

function lireEnvironnement() {
  const nav = navigator as Navigator & { standalone?: boolean }
  const installe = window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true
  const ios = /iphone|ipad|ipod/i.test(nav.userAgent) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1)
  return `${installe ? 1 : 0}${ios ? 1 : 0}`
}

/** L'app s'exécute-t-elle en mode installé (icône d'écran d'accueil) ? */
export function useEnvironnement() {
  const brut = useSyncExternalStore(sAbonner, lireEnvironnement, () => "00")
  return { installe: brut[0] === "1", ios: brut[1] === "1" }
}

/** Bouton « Installer l'application » (Android, ordinateur) ou mode d'emploi iPhone / iPad. */
export function BoutonInstaller({ className }: { className?: string }) {
  const { installe, ios } = useEnvironnement()
  const [invite, setInvite] = useState<EvenementInstallation | null>(null)
  const [fait, setFait] = useState(false)

  useEffect(() => {
    const surInvite = (e: Event) => {
      e.preventDefault()
      setInvite(e as EvenementInstallation)
    }
    const surInstalle = () => setFait(true)
    window.addEventListener("beforeinstallprompt", surInvite)
    window.addEventListener("appinstalled", surInstalle)
    return () => {
      window.removeEventListener("beforeinstallprompt", surInvite)
      window.removeEventListener("appinstalled", surInstalle)
    }
  }, [])

  if (installe) return null

  if (fait) {
    return (
      <p className={cn("rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100", className)}>
        Application installée : ouvrez-la depuis l&apos;icône « Hoffmann » sur l&apos;écran d&apos;accueil.
      </p>
    )
  }

  if (invite) {
    return (
      <Button
        className={cn("h-14 w-full text-lg", className)}
        onClick={async () => {
          await invite.prompt()
          const { outcome } = await invite.userChoice
          if (outcome === "accepted") setFait(true)
          setInvite(null)
        }}
      >
        <DownloadIcon className="size-5" /> Installer l&apos;application
      </Button>
    )
  }

  return (
    <div className={cn("rounded-xl border bg-background p-4 text-sm", className)}>
      <p className="mb-2 font-semibold">Installer l&apos;application sur cet appareil</p>
      {ios ? (
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>
            Ouvrez cette page dans <strong>Safari</strong>.
          </li>
          <li>
            Touchez <ShareIcon className="inline size-4 align-text-bottom" /> <strong>Partager</strong> en bas de
            l&apos;écran.
          </li>
          <li>
            Choisissez <PlusSquareIcon className="inline size-4 align-text-bottom" />{" "}
            <strong>Sur l&apos;écran d&apos;accueil</strong>, puis <strong>Ajouter</strong>.
          </li>
          <li>Ouvrez l&apos;app depuis la nouvelle icône « Hoffmann ».</li>
        </ol>
      ) : (
        <p className="text-muted-foreground">
          Dans le menu du navigateur (⋮), choisissez <strong>Installer l&apos;application</strong> ou{" "}
          <strong>Ajouter à l&apos;écran d&apos;accueil</strong>, puis ouvrez l&apos;app depuis la nouvelle icône.
        </p>
      )}
    </div>
  )
}
