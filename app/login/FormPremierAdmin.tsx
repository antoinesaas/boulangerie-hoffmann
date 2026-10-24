"use client"

import { Loader2Icon } from "lucide-react"
import { useActionState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { creerPremierAdmin, type EtatPremierAdmin } from "./actions"

/** Affiché tant qu'aucun compte patron n'existe. */
export function FormPremierAdmin() {
  const [etat, action, enCours] = useActionState<EtatPremierAdmin, FormData>(creerPremierAdmin, {})

  return (
    <Card>
      <CardContent>
        <form action={action} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Première ouverture : créez le compte du patron. C&apos;est le seul compte avec mot de passe ; les
            boutiques et le fornil n&apos;en ont pas besoin.
          </p>
          <div className="space-y-2">
            <Label htmlFor="nom">Votre nom</Label>
            <Input id="nom" name="nom" required defaultValue={etat.nom} className="h-12 text-base" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              defaultValue={etat.email}
              className="h-12 text-base"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mot_de_passe">Mot de passe (8 caractères minimum)</Label>
            <Input
              id="mot_de_passe"
              name="mot_de_passe"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              className="h-12 text-base"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmation">Retapez le mot de passe</Label>
            <Input
              id="confirmation"
              name="confirmation"
              type="password"
              autoComplete="new-password"
              minLength={8}
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
            Créer le compte patron
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
