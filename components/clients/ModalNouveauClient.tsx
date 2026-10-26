"use client"

import { Loader2Icon, UserPlusIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ajouterOperation, estErreurTransitoire } from "@/lib/offline/fileAttente"
import { createClient } from "@/lib/supabase/client"
import { cn, normaliser, uuid } from "@/lib/utils"
import type { Client, TypeClientVendeur } from "@/types"

interface Props {
  ouvert: boolean
  surChangementOuvert: (ouvert: boolean) => void
  surCree: (client: Client) => void
  clientsExistants: Client[]
  nomInitial?: string
}

/** Ajout d'un client particulier à la volée (sans compte utilisateur). Fonctionne hors ligne. */
export function ModalNouveauClient({ ouvert, surChangementOuvert, surCree, clientsExistants, nomInitial = "" }: Props) {
  return (
    <Dialog open={ouvert} onOpenChange={surChangementOuvert}>
      <DialogContent className="top-4 translate-y-0 sm:top-1/2 sm:-translate-y-1/2">
        {ouvert && (
          <FormNouveauClient
            nomInitial={nomInitial}
            clientsExistants={clientsExistants}
            surCree={(c) => {
              surCree(c)
              surChangementOuvert(false)
            }}
            surAnnuler={() => surChangementOuvert(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function FormNouveauClient({
  nomInitial,
  clientsExistants,
  surCree,
  surAnnuler,
}: {
  nomInitial: string
  clientsExistants: Client[]
  surCree: (client: Client) => void
  surAnnuler: () => void
}) {
  const [nom, setNom] = useState(nomInitial)
  const [telephone, setTelephone] = useState("")
  const [type, setType] = useState<TypeClientVendeur>("occasionnel")
  const [enCours, setEnCours] = useState(false)

  const doublons = useMemo(() => {
    const n = normaliser(nom)
    if (n.length < 3) return []
    return clientsExistants.filter((c) => normaliser(c.nom).includes(n)).slice(0, 3)
  }, [nom, clientsExistants])

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault()
    const nomPropre = nom.trim()
    if (!nomPropre) return
    setEnCours(true)

    const nouveau = {
      id: uuid(),
      nom: nomPropre,
      telephone: telephone.trim() || null,
      type,
    }
    const local: Client = { ...nouveau, note: null, actif: true, cree_par: null, created_at: new Date().toISOString() }

    const supabase = createClient()
    const { data, error } = await supabase.from("clients").insert(nouveau).select().single()
    setEnCours(false)

    if (!error) {
      toast.success(`Client « ${nomPropre} » ajouté`)
      surCree(data as Client)
    } else if (estErreurTransitoire(error)) {
      ajouterOperation({ type: "client", id: nouveau.id, data: nouveau, creeLe: local.created_at })
      toast.info("Hors ligne : client enregistré sur l'appareil, il sera envoyé avec la commande.")
      surCree(local)
    } else {
      toast.error(`Impossible d'ajouter le client : ${error.message}`)
    }
  }

  return (
    <form onSubmit={enregistrer} className="space-y-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <UserPlusIcon className="size-5" /> Nouveau client
        </DialogTitle>
        <DialogDescription>Particulier ou client livré en tournée, sans compte. Il sera retrouvable pour les prochaines commandes.</DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <Label htmlFor="nc-nom">Nom</Label>
        <Input
          id="nc-nom"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          autoFocus
          required
          autoComplete="off"
          autoCapitalize="words"
          className="h-12 text-base"
          placeholder="Mme Martin"
        />
        {doublons.length > 0 && (
          <div className="rounded-md bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            Déjà enregistré ?
            <div className="mt-1 flex flex-wrap gap-2">
              {doublons.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => surCree(c)}
                  className="min-h-11 rounded-md border border-amber-300 bg-background px-3 text-left text-foreground dark:border-amber-800"
                >
                  {c.nom}
                  {c.telephone ? ` · ${c.telephone}` : ""}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="nc-tel">Téléphone (optionnel)</Label>
        <Input
          id="nc-tel"
          type="tel"
          inputMode="tel"
          value={telephone}
          onChange={(e) => setTelephone(e.target.value)}
          autoComplete="off"
          className="h-12 text-base"
          placeholder="06 12 34 56 78"
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Type</legend>
        <div className="grid grid-cols-3 gap-2">
          {(["regulier", "occasionnel", "tournee"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={type === t}
              onClick={() => setType(t)}
              className={cn(
                "min-h-12 rounded-lg border px-3 text-sm font-medium transition-colors",
                type === t ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
              )}
            >
              {t === "regulier" ? "Régulier" : t === "occasionnel" ? "Occasionnel" : "Tournée"}
              <span className="block text-xs font-normal opacity-80">
                {t === "regulier" ? "Chaque semaine" : t === "occasionnel" ? "De temps en temps" : "Livré en tournée"}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" className="h-12" onClick={surAnnuler}>
          Annuler
        </Button>
        <Button type="submit" className="h-12" disabled={enCours || !nom.trim()}>
          {enCours && <Loader2Icon className="animate-spin" />}
          Enregistrer et sélectionner
        </Button>
      </DialogFooter>
    </form>
  )
}
