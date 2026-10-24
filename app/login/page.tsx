import type { Metadata } from "next"
import { WheatIcon } from "lucide-react"
import { FormConnexion } from "./FormConnexion"

export const metadata: Metadata = { title: "Connexion" }

export default function PageConnexion() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <WheatIcon className="size-7" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Boulangerie Hoffmann</h1>
            <p className="text-sm text-muted-foreground">Gestion des commandes</p>
          </div>
        </div>
        <FormConnexion />
      </div>
    </main>
  )
}
