import type { Metadata } from "next"
import { FlameIcon, StoreIcon, WheatIcon } from "lucide-react"
import Link from "next/link"
import { exigerRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import { choisirMode } from "./actions"

export const metadata: Metadata = { title: "Choisir le mode" }

/** Écran d'accueil d'un appareil activé : un seul toucher pour choisir son poste. */
export default async function PageMode() {
  const { profil, pointDeVente } = await exigerRole("appareil", "admin")
  const supabase = await createClient()
  const { data: boutiques } = await supabase
    .from("points_de_vente")
    .select("id, nom")
    .eq("actif", true)
    .order("ordre")
    .order("nom")

  return (
    <main className="flex min-h-dvh flex-col bg-muted/40 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))]">
      <div className="mx-auto w-full max-w-md flex-1 space-y-8">
        <header className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <WheatIcon className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold leading-tight">Boulangerie Hoffmann</h1>
            <p className="text-sm text-muted-foreground">{profil.role === "appareil" ? profil.nom : "Patron"}</p>
          </div>
        </header>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <StoreIcon className="size-4" /> Vendeur — choisissez la boutique
          </h2>
          {(boutiques ?? []).map((b) => (
            <form key={b.id} action={choisirMode}>
              <input type="hidden" name="mode" value="vendeur" />
              <input type="hidden" name="boutique" value={b.id} />
              <button
                type="submit"
                className={cn(
                  "flex min-h-20 w-full items-center justify-between rounded-2xl border-2 bg-background px-5 text-left text-2xl font-semibold shadow-sm transition-colors active:bg-muted",
                  pointDeVente?.id === b.id ? "border-primary" : "border-transparent",
                )}
              >
                {b.nom}
                {pointDeVente?.id === b.id && (
                  <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
                    dernier choix
                  </span>
                )}
              </button>
            </form>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <FlameIcon className="size-4" /> Fornil
          </h2>
          <form action={choisirMode}>
            <input type="hidden" name="mode" value="fornil" />
            <button
              type="submit"
              className="flex min-h-20 w-full items-center justify-center gap-3 rounded-2xl bg-primary px-5 text-2xl font-semibold text-primary-foreground shadow-sm active:opacity-90"
            >
              <FlameIcon className="size-7" /> Ouvrir le fornil
            </button>
          </form>
        </section>
      </div>

      {profil.role === "admin" && (
        <Link href="/admin" className="mx-auto mt-8 text-sm text-muted-foreground underline underline-offset-4">
          Retour à l&apos;espace patron
        </Link>
      )}
    </main>
  )
}
