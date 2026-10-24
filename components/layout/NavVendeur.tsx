"use client"

import { ClipboardListIcon, PlusCircleIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const LIENS = [
  { href: "/vendeur/commande", libelle: "Nouvelle commande", icone: PlusCircleIcon },
  { href: "/vendeur/mes-commandes", libelle: "Mes commandes", icone: ClipboardListIcon },
] as const

/** Barre de navigation basse, atteignable au pouce. */
export function NavVendeur() {
  const chemin = usePathname()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)] print:hidden">
      <div className="mx-auto grid max-w-2xl grid-cols-2">
        {LIENS.map(({ href, libelle, icone: Icone }) => {
          const actif = chemin === href
          return (
            <Link
              key={href}
              href={href}
              aria-current={actif ? "page" : undefined}
              className={cn(
                "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                actif ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <Icone className={cn("size-6", actif && "stroke-[2.5]")} />
              {libelle}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
