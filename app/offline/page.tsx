import type { Metadata } from "next"
import { CloudOffIcon } from "lucide-react"

export const metadata: Metadata = { title: "Hors ligne" }

export default function PageHorsLigne() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <CloudOffIcon className="size-12 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">Pas de réseau</h1>
      <p className="max-w-sm text-muted-foreground">
        Cette page n&apos;a pas encore été ouverte sur cet appareil. Ouvrez « Nouvelle commande » une fois avec du
        réseau : elle restera ensuite disponible hors ligne.
      </p>
      <a
        href="/vendeur/commande"
        className="inline-flex min-h-12 items-center rounded-lg bg-primary px-5 font-medium text-primary-foreground"
      >
        Réessayer
      </a>
    </main>
  )
}
