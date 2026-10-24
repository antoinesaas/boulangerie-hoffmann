"use client"

import {
  ChartColumnIcon,
  ClipboardListIcon,
  CroissantIcon,
  FlameIcon,
  LayoutDashboardIcon,
  PlusCircleIcon,
  SmartphoneIcon,
  StoreIcon,
  UserCogIcon,
  UsersIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export const LIENS_ADMIN = [
  { href: "/admin", libelle: "Tableau de bord", icone: LayoutDashboardIcon },
  { href: "/admin/commandes", libelle: "Commandes", icone: ClipboardListIcon },
  { href: "/admin/ca", libelle: "Chiffre d'affaires", icone: ChartColumnIcon },
  { href: "/admin/produits", libelle: "Produits", icone: CroissantIcon },
  { href: "/admin/clients", libelle: "Clients", icone: UsersIcon },
  { href: "/admin/points-de-vente", libelle: "Points de vente", icone: StoreIcon },
  { href: "/admin/appareils", libelle: "Appareils", icone: SmartphoneIcon },
  { href: "/admin/utilisateurs", libelle: "Comptes patron", icone: UserCogIcon },
] as const

const RACCOURCIS = [
  { href: "/vendeur/commande", libelle: "Saisir une commande", icone: PlusCircleIcon },
  { href: "/fornil", libelle: "Vue fornil", icone: FlameIcon },
] as const

function estActif(chemin: string, href: string) {
  return href === "/admin" ? chemin === "/admin" : chemin === href || chemin.startsWith(`${href}/`)
}

/** Barre latérale (bureau). */
export function NavAdminLaterale() {
  const chemin = usePathname()
  return (
    <nav className="flex flex-col gap-1 p-3">
      {LIENS_ADMIN.map(({ href, libelle, icone: Icone }) => (
        <Link
          key={href}
          href={href}
          aria-current={estActif(chemin, href) ? "page" : undefined}
          className={cn(
            "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
            estActif(chemin, href) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Icone className="size-4" />
          {libelle}
        </Link>
      ))}
      <div className="my-2 border-t" />
      {RACCOURCIS.map(({ href, libelle, icone: Icone }) => (
        <Link
          key={href}
          href={href}
          className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Icone className="size-4" />
          {libelle}
        </Link>
      ))}
    </nav>
  )
}

/** Onglets défilants (mobile). */
export function NavAdminMobile() {
  const chemin = usePathname()
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
      {[...LIENS_ADMIN, ...RACCOURCIS].map(({ href, libelle }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-medium",
            estActif(chemin, href) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {libelle}
        </Link>
      ))}
    </nav>
  )
}
