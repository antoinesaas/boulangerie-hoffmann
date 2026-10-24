"use client"

import { ArrowDownIcon, ArrowUpIcon, PencilIcon, PlusIcon, SearchIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { EnTetePage } from "@/components/layout/EnTetePage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createClient } from "@/lib/supabase/client"
import { calcTTC, cn, formatPrix, formatTVA, normaliser } from "@/lib/utils"
import { CATEGORIES, LIBELLES_CATEGORIE, type Categorie, type Produit } from "@/types"
import { FormProduit } from "./FormProduit"

const num = "text-right tabular-nums"

export function TableProduits({ produitsInitiaux }: { produitsInitiaux: Produit[] }) {
  const [produits, setProduits] = useState(produitsInitiaux)
  const [categorie, setCategorie] = useState<"toutes" | Categorie>("toutes")
  const [recherche, setRecherche] = useState("")
  const [edition, setEdition] = useState<Produit | null>(null)
  const [modal, setModal] = useState(false)

  const tries = [...produits].sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, "fr"))
  const q = normaliser(recherche)
  const visibles = tries.filter(
    (p) => (categorie === "toutes" || p.categorie === categorie) && (!q || normaliser(p.nom).includes(q)),
  )

  function remplacer(p: Produit) {
    setProduits((liste) => (liste.some((x) => x.id === p.id) ? liste.map((x) => (x.id === p.id ? p : x)) : [...liste, p]))
  }

  async function basculerActif(p: Produit, actif: boolean) {
    remplacer({ ...p, actif })
    const { error } = await createClient().from("produits").update({ actif }).eq("id", p.id)
    if (error) {
      remplacer(p)
      toast.error("Mise à jour impossible", { description: error.message })
    }
  }

  /** Échange l'ordre d'affichage avec le voisin (ordre de saisie vendeur et fornil). */
  async function deplacer(p: Produit, sens: -1 | 1) {
    const index = tries.findIndex((x) => x.id === p.id)
    const voisin = tries[index + sens]
    if (!voisin) return
    const ordreA = voisin.ordre === p.ordre ? p.ordre + sens : voisin.ordre
    const ordreB = p.ordre
    remplacer({ ...p, ordre: ordreA })
    remplacer({ ...voisin, ordre: ordreB })
    const supabase = createClient()
    const [r1, r2] = await Promise.all([
      supabase.from("produits").update({ ordre: ordreA }).eq("id", p.id),
      supabase.from("produits").update({ ordre: ordreB }).eq("id", voisin.id),
    ])
    if (r1.error || r2.error) {
      remplacer(p)
      remplacer(voisin)
      toast.error("Réorganisation impossible")
    }
  }

  const ordreSuivant = Math.max(0, ...produits.map((p) => p.ordre)) + 1

  return (
    <div>
      <EnTetePage
        titre="Catalogue produits"
        description="Prix modifiables à tout moment : les commandes déjà saisies gardent leur prix."
        actions={
          <Button
            className="h-10"
            onClick={() => {
              setEdition(null)
              setModal(true)
            }}
          >
            <PlusIcon /> Ajouter un produit
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Catégorie">
          {(["toutes", ...CATEGORIES] as const).map((c) => (
            <button
              key={c}
              role="radio"
              aria-checked={categorie === c}
              onClick={() => setCategorie(c)}
              className={cn(
                "min-h-9 rounded-md px-3 text-sm font-medium",
                categorie === c ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {c === "toutes" ? "Toutes" : LIBELLES_CATEGORIE[c]}
            </button>
          ))}
        </div>
        <div className="relative min-w-48 flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher…" className="h-10 pl-9" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Ordre</TableHead>
              <TableHead>Produit</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Unité</TableHead>
              <TableHead className={num}>Prix HT</TableHead>
              <TableHead className={num}>TVA</TableHead>
              <TableHead className={num}>Prix TTC</TableHead>
              <TableHead>Actif</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  Aucun produit.
                </TableCell>
              </TableRow>
            ) : (
              visibles.map((p) => (
                <TableRow key={p.id} className={cn(!p.actif && "text-muted-foreground")}>
                  <TableCell>
                    <div className="flex">
                      <Button variant="ghost" size="icon-sm" aria-label="Monter" onClick={() => void deplacer(p, -1)}>
                        <ArrowUpIcon />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Descendre" onClick={() => void deplacer(p, 1)}>
                        <ArrowDownIcon />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{p.nom}</TableCell>
                  <TableCell>{LIBELLES_CATEGORIE[p.categorie]}</TableCell>
                  <TableCell>{p.unite}</TableCell>
                  <TableCell className={num}>{formatPrix(p.prix_ht)}</TableCell>
                  <TableCell className={num}>{formatTVA(p.tva)}</TableCell>
                  <TableCell className={cn(num, "font-semibold")}>{formatPrix(calcTTC(p.prix_ht, p.tva))}</TableCell>
                  <TableCell>
                    <Switch
                      checked={p.actif}
                      onCheckedChange={(v) => void basculerActif(p, v)}
                      aria-label={p.actif ? `Désactiver ${p.nom}` : `Activer ${p.nom}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Modifier ${p.nom}`}
                      onClick={() => {
                        setEdition(p)
                        setModal(true)
                      }}
                    >
                      <PencilIcon />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <FormProduit
        produit={edition}
        ouvert={modal}
        surChangementOuvert={setModal}
        surEnregistre={remplacer}
        ordreSuivant={ordreSuivant}
      />
    </div>
  )
}
