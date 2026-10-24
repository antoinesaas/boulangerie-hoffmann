"use client"

import { Loader2Icon } from "lucide-react"
import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { connexion, type EtatConnexion } from "./actions"

export function FormConnexion() {
  const [etat, action, enCours] = useActionState<EtatConnexion, FormData>(connexion, {})

  return (
    <Card>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              required
              defaultValue={etat.email}
              className="h-12 text-base"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mot_de_passe">Mot de passe</Label>
            <Input
              id="mot_de_passe"
              name="mot_de_passe"
              type="password"
              autoComplete="current-password"
              required
              className="h-12 text-base"
            />
          </div>
          {etat.erreur && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {etat.erreur}
            </p>
          )}
          <Button type="submit" className="h-12 w-full text-base" disabled={enCours}>
            {enCours && <Loader2Icon className="animate-spin" />}
            Se connecter
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
