import { StoreIcon } from "lucide-react"
import { BandeauHorsLigne } from "@/components/layout/BandeauHorsLigne"
import { EnregistrementSW } from "@/components/layout/EnregistrementSW"
import { MenuUtilisateur } from "@/components/layout/MenuUtilisateur"
import { NavVendeur } from "@/components/layout/NavVendeur"
import { exigerRole } from "@/lib/auth"

export default async function LayoutVendeur({ children }: LayoutProps<"/vendeur">) {
  const { profil, pointDeVente } = await exigerRole("vendeur", "admin")
  const libellePdv = pointDeVente?.nom ?? (profil.role === "admin" ? "Tous les points de vente" : "Aucun point de vente")

  return (
    <div className="flex min-h-dvh flex-col bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4">
          <StoreIcon className="size-5 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold leading-tight">{libellePdv}</div>
            <div className="truncate text-xs text-muted-foreground">{profil.nom}</div>
          </div>
          <MenuUtilisateur nom={profil.nom} role={profil.role} detail={pointDeVente?.nom} />
        </div>
        <BandeauHorsLigne />
      </header>
      <div className="mx-auto w-full max-w-2xl flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">{children}</div>
      <NavVendeur />
      <EnregistrementSW />
    </div>
  )
}
