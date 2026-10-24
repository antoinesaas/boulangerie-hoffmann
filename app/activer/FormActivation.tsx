"use client"

import { KeyRoundIcon, Loader2Icon } from "lucide-react"
import { useActionState } from "react"
import { BoutonInstaller, useEnvironnement } from "@/components/layout/BoutonInstaller"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { activerAppareil, type EtatActivation } from "./actions"

export function FormActivation() {
  const [etat, action, enCours] = useActionState<EtatActivation, FormData>(activerAppareil, {})
  const { installe, ios } = useEnvironnement()
  // Sur iPhone, l'app installée a sa propre mémoire : il faut l'activer depuis l'icône.
  const installerDabord = ios && !installe

  return (
    <div className="space-y-4">
      {!installe && <BoutonInstaller />}

      {installerDabord ? (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-950/50 dark:text-amber-100">
          Installez d&apos;abord l&apos;app, puis ouvrez-la depuis l&apos;icône pour l&apos;activer.
        </p>
      ) : (
        <Card>
          <CardContent>
            <form action={action} className="space-y-4">
              <div className="space-y-1 text-center">
                <h2 className="flex items-center justify-center gap-2 text-lg font-semibold">
                  <KeyRoundIcon className="size-5" /> Activer cet appareil
                </h2>
                <p className="text-sm text-muted-foreground">
                  Une seule fois. Le patron obtient le code dans <strong>Appareils</strong>.
                </p>
              </div>
              <input
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]*"
                maxLength={7}
                required
                placeholder="000000"
                aria-label="Code d'activation à 6 chiffres"
                className="h-16 w-full rounded-xl border bg-background text-center font-mono text-3xl tracking-[0.4em] outline-none focus:ring-2 focus:ring-ring"
              />
              {etat.erreur && (
                <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {etat.erreur}
                </p>
              )}
              <Button type="submit" className="h-14 w-full text-lg" disabled={enCours}>
                {enCours && <Loader2Icon className="animate-spin" />}
                Activer
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
