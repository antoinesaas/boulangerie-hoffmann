import { WheatIcon } from "lucide-react"
import Link from "next/link"
import { MenuUtilisateur } from "@/components/layout/MenuUtilisateur"
import { NavAdminLaterale, NavAdminMobile } from "@/components/layout/NavAdmin"
import { exigerRole } from "@/lib/auth"

export default async function LayoutAdmin({ children }: LayoutProps<"/admin">) {
  const { profil } = await exigerRole("admin")

  return (
    <div className="flex min-h-dvh bg-muted/30">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-background md:flex">
        <Link href="/admin" className="flex h-16 items-center gap-2 border-b px-5 font-semibold">
          <WheatIcon className="size-5" />
          Boulangerie Guillaume
        </Link>
        <div className="flex-1 overflow-y-auto">
          <NavAdminLaterale />
        </div>
        <div className="flex items-center gap-2 border-t p-3">
          <div className="min-w-0 flex-1 truncate text-sm">
            <div className="truncate font-medium">{profil.nom}</div>
            <div className="truncate text-xs text-muted-foreground">{profil.email}</div>
          </div>
          <MenuUtilisateur nom={profil.nom} role={profil.role} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur md:hidden">
          <div className="flex h-14 items-center gap-2 px-4">
            <WheatIcon className="size-5" />
            <span className="flex-1 truncate font-semibold">Boulangerie Guillaume</span>
            <MenuUtilisateur nom={profil.nom} role={profil.role} />
          </div>
          <NavAdminMobile />
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}
