"use client"

import { LogOutIcon, MoonIcon, SunIcon, UserIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { deconnexion } from "@/app/login/actions"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { lireFile } from "@/lib/offline/fileAttente"
import { LIBELLES_ROLE, type Role } from "@/types"

export function MenuUtilisateur({ nom, role, detail }: { nom: string; role: Role; detail?: string }) {
  const { resolvedTheme, setTheme } = useTheme()

  async function seDeconnecter() {
    const enAttente = lireFile().filter((o) => !o.erreur).length
    if (
      enAttente > 0 &&
      !window.confirm(
        `${enAttente} envoi(s) en attente sur cet appareil. Ils partiront à la prochaine connexion sur ce téléphone. Se déconnecter quand même ?`,
      )
    ) {
      return
    }
    try {
      const cles = await caches.keys()
      await Promise.all(cles.map((c) => caches.delete(c)))
    } catch {
      // Cache Storage indisponible : rien à nettoyer.
    }
    await deconnexion()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-lg" aria-label="Menu du compte" className="size-11">
          <UserIcon className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="space-y-0.5">
          <div className="font-medium text-foreground">{nom || "Mon compte"}</div>
          <div className="text-xs font-normal text-muted-foreground">
            {LIBELLES_ROLE[role]}
            {detail ? ` · ${detail}` : ""}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="min-h-11"
          onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {resolvedTheme === "dark" ? <SunIcon /> : <MoonIcon />}
          {resolvedTheme === "dark" ? "Mode jour" : "Mode nuit"}
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11" variant="destructive" onSelect={() => void seDeconnecter()}>
          <LogOutIcon />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
