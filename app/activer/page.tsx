import type { Metadata } from "next"
import { WheatIcon } from "lucide-react"
import Link from "next/link"
import { FormActivation } from "./FormActivation"

export const metadata: Metadata = { title: "Activer l'appareil" }

export default function PageActivation() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <WheatIcon className="size-8" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Boulangerie Hoffmann</h1>
            <p className="text-sm text-muted-foreground">Commandes boutiques et fornil</p>
          </div>
        </div>
        <FormActivation />
        <p className="text-center text-sm text-muted-foreground">
          Vous êtes le patron ?{" "}
          <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
            Connexion patron
          </Link>
        </p>
      </div>
    </main>
  )
}
