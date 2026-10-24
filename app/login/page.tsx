import type { Metadata } from "next"
import { WheatIcon } from "lucide-react"
import Link from "next/link"
import { patronExiste } from "./actions"
import { FormConnexion } from "./FormConnexion"
import { FormPremierAdmin } from "./FormPremierAdmin"

export const metadata: Metadata = { title: "Connexion patron" }
export const dynamic = "force-dynamic"

export default async function PageConnexion() {
  const premiereFois = !(await patronExiste())

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <WheatIcon className="size-7" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Boulangerie Hoffmann</h1>
            <p className="text-sm text-muted-foreground">
              {premiereFois ? "Création du compte patron" : "Espace patron"}
            </p>
          </div>
        </div>
        {premiereFois ? <FormPremierAdmin /> : <FormConnexion />}
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/activer" className="underline underline-offset-4">
            Activer un appareil de boutique ou du fornil
          </Link>
        </p>
      </div>
    </main>
  )
}
