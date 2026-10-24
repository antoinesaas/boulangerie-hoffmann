"use client"

import { Loader2Icon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { createClient } from "@/lib/supabase/client"
import { calcTTC, formatPrix } from "@/lib/utils"
import {
  CATEGORIES,
  LIBELLES_CATEGORIE,
  TAUX_TVA,
  UNITES,
  type Categorie,
  type Produit,
  type TauxTVA,
  type Unite,
} from "@/types"

const TVA_PAR_DEFAUT: Record<Categorie, TauxTVA> = { pain: 5.5, viennoiserie: 10, pâtisserie: 10, autre: 10 }

interface Props {
  produit: Produit | null
  ouvert: boolean
  surChangementOuvert: (ouvert: boolean) => void
  surEnregistre: (produit: Produit) => void
  ordreSuivant: number
}

/** Création / modification d'un produit. Les commandes existantes gardent leur prix (figé à la saisie). */
export function FormProduit({ produit, ouvert, surChangementOuvert, surEnregistre, ordreSuivant }: Props) {
  return (
    <Dialog open={ouvert} onOpenChange={surChangementOuvert}>
      <DialogContent className="sm:max-w-lg">
        {ouvert && (
          <Formulaire
            produit={produit}
            ordreSuivant={ordreSuivant}
            surEnregistre={(p) => {
              surEnregistre(p)
              surChangementOuvert(false)
            }}
            surAnnuler={() => surChangementOuvert(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function Formulaire({
  produit,
  ordreSuivant,
  surEnregistre,
  surAnnuler,
}: {
  produit: Produit | null
  ordreSuivant: number
  surEnregistre: (p: Produit) => void
  surAnnuler: () => void
}) {
  const [nom, setNom] = useState(produit?.nom ?? "")
  const [categorie, setCategorie] = useState<Categorie>(produit?.categorie ?? "pain")
  const [unite, setUnite] = useState<Unite>(produit?.unite ?? "pièce")
  const [prix, setPrix] = useState(produit ? String(produit.prix_ht).replace(".", ",") : "")
  const [tva, setTva] = useState<TauxTVA>(produit?.tva ?? 5.5)
  const [actif, setActif] = useState(produit?.actif ?? true)
  const [enCours, setEnCours] = useState(false)

  const prixHT = Number(prix.replace(",", "."))
  const prixValide = prix.trim() !== "" && Number.isFinite(prixHT) && prixHT >= 0

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault()
    if (!nom.trim() || !prixValide) return
    setEnCours(true)
    const valeurs = { nom: nom.trim(), categorie, unite, prix_ht: Math.round(prixHT * 100) / 100, tva, actif }
    const supabase = createClient()
    const { data, error } = produit
      ? await supabase.from("produits").update(valeurs).eq("id", produit.id).select().single()
      : await supabase
          .from("produits")
          .insert({ ...valeurs, ordre: ordreSuivant })
          .select()
          .single()
    setEnCours(false)
    if (error) {
      toast.error("Enregistrement impossible", { description: error.message })
      return
    }
    toast.success(produit ? "Produit mis à jour" : "Produit ajouté")
    surEnregistre(data as Produit)
  }

  return (
    <form onSubmit={enregistrer} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{produit ? "Modifier le produit" : "Ajouter un produit"}</DialogTitle>
        {produit && (
          <DialogDescription>
            Un nouveau prix s&apos;applique aux prochaines commandes uniquement : l&apos;historique garde le prix de la saisie.
          </DialogDescription>
        )}
      </DialogHeader>

      <div className="space-y-2">
        <Label htmlFor="p-nom">Nom</Label>
        <Input id="p-nom" value={nom} onChange={(e) => setNom(e.target.value)} required autoFocus className="h-11" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Catégorie</Label>
          <Select
            value={categorie}
            onValueChange={(v) => {
              const c = v as Categorie
              setCategorie(c)
              if (!produit) setTva(TVA_PAR_DEFAUT[c])
            }}
          >
            <SelectTrigger className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {LIBELLES_CATEGORIE[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Unité</Label>
          <Select value={unite} onValueChange={(v) => setUnite(v as Unite)}>
            <SelectTrigger className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNITES.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-prix">Prix unitaire HT (€)</Label>
          <Input
            id="p-prix"
            inputMode="decimal"
            value={prix}
            onChange={(e) => setPrix(e.target.value)}
            required
            placeholder="1,20"
            aria-invalid={prix !== "" && !prixValide}
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label>TVA</Label>
          <Select value={String(tva)} onValueChange={(v) => setTva(Number(v) as TauxTVA)}>
            <SelectTrigger className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TAUX_TVA.map((t) => (
                <SelectItem key={t} value={String(t)}>
                  {String(t).replace(".", ",")} %{t === 5.5 ? " (pain)" : " (viennoiseries)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
        <span>Prix TTC</span>
        <strong className="tabular-nums">{prixValide ? formatPrix(calcTTC(prixHT, tva)) : "—"}</strong>
      </div>

      <div className="flex items-center gap-3">
        <Switch id="p-actif" checked={actif} onCheckedChange={setActif} />
        <Label htmlFor="p-actif">Actif (proposé à la saisie)</Label>
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={surAnnuler}>
          Annuler
        </Button>
        <Button type="submit" disabled={enCours || !nom.trim() || !prixValide}>
          {enCours && <Loader2Icon className="animate-spin" />}
          Enregistrer
        </Button>
      </DialogFooter>
    </form>
  )
}
