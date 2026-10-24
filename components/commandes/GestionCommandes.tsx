"use client"

import { ChevronDownIcon, ChevronRightIcon, Loader2Icon, PlusCircleIcon, SearchIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { Fragment, useState } from "react"
import { toast } from "sonner"
import { PastilleTempsReel } from "@/components/ca/DashboardCA"
import { EnTetePage } from "@/components/layout/EnTetePage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { changerStatut, useCommandes } from "@/lib/hooks/useCommandes"
import { createClient } from "@/lib/supabase/client"
import {
  ajouterJours,
  aujourdhui,
  cn,
  formatDateCourte,
  formatDateHeure,
  formatPrix,
  formatQuantite,
  formatUnite,
  normaliser,
} from "@/lib/utils"
import {
  LIBELLES_STATUT,
  LIBELLES_TYPE_CLIENT,
  type CommandeDetail,
  type PointDeVente,
  type StatutCommande,
} from "@/types"
import { BadgeStatut } from "./BadgeStatut"

type Preset = "aujourdhui" | "demain" | "a_venir" | "passe" | "perso"
const STATUTS: StatutCommande[] = ["en_attente", "preparee", "livree", "annulee"]
const num = "text-right tabular-nums"

export function GestionCommandes({ pointsDeVente }: { pointsDeVente: Pick<PointDeVente, "id" | "nom">[] }) {
  const jour = aujourdhui()
  const [preset, setPreset] = useState<Preset>("aujourdhui")
  const [persoDebut, setPersoDebut] = useState(jour)
  const [persoFin, setPersoFin] = useState(ajouterJours(jour, 7))
  const [pdv, setPdv] = useState("tous")
  const [statut, setStatut] = useState<"tous" | StatutCommande>("tous")
  const [recherche, setRecherche] = useState("")
  const [ouverte, setOuverte] = useState<string | null>(null)

  const bornes: Record<Preset, [string, string]> = {
    aujourdhui: [jour, jour],
    demain: [ajouterJours(jour, 1), ajouterJours(jour, 1)],
    a_venir: [jour, ajouterJours(jour, 7)],
    passe: [ajouterJours(jour, -7), jour],
    perso: persoDebut <= persoFin ? [persoDebut, persoFin] : [persoFin, persoDebut],
  }
  const [debut, fin] = bornes[preset]

  const { commandes, chargement, erreur, realtime, majLocale, recharger } = useCommandes({
    dateDebut: debut,
    dateFin: fin,
    pointDeVenteId: pdv === "tous" ? null : pdv,
    statuts: statut === "tous" ? undefined : [statut],
  })

  const q = normaliser(recherche)
  const visibles = q
    ? commandes.filter(
        (c) => normaliser(c.client?.nom ?? "").includes(q) || normaliser(c.notes ?? "").includes(q),
      )
    : commandes
  const actives = visibles.filter((c) => c.statut !== "annulee")
  const totalTTC = actives.reduce((s, c) => s + Number(c.total_ttc), 0)
  const totalHT = actives.reduce((s, c) => s + Number(c.total_ht), 0)

  async function modifierStatut(c: CommandeDetail, nouveau: StatutCommande) {
    const precedent = c.statut
    majLocale(c.id, { statut: nouveau })
    const err = await changerStatut(c.id, nouveau)
    if (err) {
      majLocale(c.id, { statut: precedent })
      toast.error("Mise à jour impossible", { description: err.message })
    }
  }

  async function supprimer(c: CommandeDetail) {
    if (!window.confirm(`Supprimer définitivement la commande de ${c.client?.nom} ? (Préférez « Annulée » pour garder l'historique.)`)) {
      return
    }
    const { error } = await createClient().from("commandes").delete().eq("id", c.id)
    if (error) toast.error("Suppression impossible", { description: error.message })
    else {
      toast.success("Commande supprimée")
      void recharger()
    }
  }

  return (
    <div>
      <EnTetePage
        titre="Commandes"
        description={
          <span className="inline-flex items-center gap-2">
            <PastilleTempsReel etat={realtime} /> Toutes les commandes, mises à jour en temps réel
          </span>
        }
        actions={
          <Button asChild className="h-10">
            <Link href="/vendeur/commande">
              <PlusCircleIcon /> Nouvelle commande
            </Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Période">
          {(
            [
              ["aujourdhui", "Aujourd'hui"],
              ["demain", "Demain"],
              ["a_venir", "7 prochains jours"],
              ["passe", "7 derniers jours"],
              ["perso", "Personnalisée"],
            ] as const
          ).map(([valeur, libelle]) => (
            <button
              key={valeur}
              role="radio"
              aria-checked={preset === valeur}
              onClick={() => setPreset(valeur)}
              className={cn(
                "min-h-9 rounded-md px-3 text-sm font-medium",
                preset === valeur ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {libelle}
            </button>
          ))}
        </div>
        {preset === "perso" && (
          <div className="flex items-center gap-2 text-sm">
            <input
              type="date"
              aria-label="Début"
              value={persoDebut}
              onChange={(e) => e.target.value && setPersoDebut(e.target.value)}
              className="h-10 rounded-md border bg-background px-2"
            />
            <span>→</span>
            <input
              type="date"
              aria-label="Fin"
              value={persoFin}
              onChange={(e) => e.target.value && setPersoFin(e.target.value)}
              className="h-10 rounded-md border bg-background px-2"
            />
          </div>
        )}
        <Select value={pdv} onValueChange={setPdv}>
          <SelectTrigger className="h-10 w-48" aria-label="Point de vente">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous les points de vente</SelectItem>
            {pointsDeVente.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statut} onValueChange={(v) => setStatut(v as typeof statut)}>
          <SelectTrigger className="h-10 w-40" aria-label="Statut">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous les statuts</SelectItem>
            {STATUTS.map((s) => (
              <SelectItem key={s} value={s}>
                {LIBELLES_STATUT[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative min-w-48 flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Client ou note…"
            className="h-10 pl-9"
          />
        </div>
      </div>

      <p className="mb-3 text-sm text-muted-foreground">
        {visibles.length} commande{visibles.length > 1 ? "s" : ""} · {formatPrix(totalHT)} HT ·{" "}
        <strong className="text-foreground">{formatPrix(totalTTC)} TTC</strong> (hors annulées)
      </p>

      {erreur && <p className="mb-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{erreur}</p>}

      <div className={cn("overflow-x-auto rounded-xl border bg-background", chargement && commandes.length > 0 && "opacity-60")}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Livraison</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Point de vente</TableHead>
              <TableHead>Produits</TableHead>
              <TableHead className={num}>Total TTC</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {chargement && commandes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center">
                  <Loader2Icon className="mx-auto animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : visibles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Aucune commande pour ces filtres.
                </TableCell>
              </TableRow>
            ) : (
              visibles.map((c) => {
                const estOuverte = ouverte === c.id
                return (
                  <Fragment key={c.id}>
                    <TableRow
                      className={cn("cursor-pointer", c.statut === "annulee" && "text-muted-foreground")}
                      onClick={() => setOuverte(estOuverte ? null : c.id)}
                    >
                      <TableCell>
                        {estOuverte ? <ChevronDownIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
                      </TableCell>
                      <TableCell className="whitespace-nowrap first-letter:uppercase">
                        {formatDateCourte(c.date_livraison)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{c.client?.nom}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.client ? LIBELLES_TYPE_CLIENT[c.client.type] : ""}
                        </div>
                      </TableCell>
                      <TableCell>{c.point_de_vente?.nom ?? "—"}</TableCell>
                      <TableCell className="max-w-72 truncate text-muted-foreground">
                        {c.lignes.map((l) => `${formatQuantite(l.quantite)} ${l.produit?.nom ?? "?"}`).join(", ")}
                      </TableCell>
                      <TableCell className={num}>{formatPrix(c.total_ttc)}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select value={c.statut} onValueChange={(v) => void modifierStatut(c, v as StatutCommande)}>
                          <SelectTrigger className="h-9 w-36 border-0 bg-transparent px-1 shadow-none" aria-label="Changer le statut">
                            <BadgeStatut statut={c.statut} />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUTS.map((s) => (
                              <SelectItem key={s} value={s}>
                                {LIBELLES_STATUT[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                    {estOuverte && (
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableCell />
                        <TableCell colSpan={6}>
                          <DetailCommande commande={c} surSupprimer={() => void supprimer(c)} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function DetailCommande({ commande, surSupprimer }: { commande: CommandeDetail; surSupprimer: () => void }) {
  return (
    <div className="grid gap-4 py-2 md:grid-cols-[1fr_auto]">
      <div className="space-y-2">
        <table className="w-full max-w-xl text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-1 text-left font-medium">Produit</th>
              <th className="py-1 text-right font-medium">Qté</th>
              <th className="py-1 text-right font-medium">PU HT</th>
              <th className="py-1 text-right font-medium">TVA</th>
              <th className="py-1 text-right font-medium">Total TTC</th>
            </tr>
          </thead>
          <tbody>
            {commande.lignes.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="py-1">{l.produit?.nom}</td>
                <td className="py-1 text-right tabular-nums">
                  {formatQuantite(l.quantite)}
                  {l.produit && l.produit.unite !== "pièce" ? ` ${formatUnite(l.produit.unite, l.quantite)}` : ""}
                </td>
                <td className="py-1 text-right tabular-nums">{formatPrix(l.prix_unitaire_ht)}</td>
                <td className="py-1 text-right tabular-nums">{String(l.tva).replace(".", ",")} %</td>
                <td className="py-1 text-right tabular-nums">
                  {formatPrix(l.quantite * l.prix_unitaire_ht * (1 + l.tva / 100))}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t font-semibold">
              <td className="py-1" colSpan={4}>
                Total ({formatPrix(commande.total_ht)} HT)
              </td>
              <td className="py-1 text-right tabular-nums">{formatPrix(commande.total_ttc)}</td>
            </tr>
          </tfoot>
        </table>
        {commande.notes && <p className="text-sm italic">« {commande.notes} »</p>}
        <p className="text-xs text-muted-foreground">
          Saisie le {formatDateHeure(commande.cree_le)}
          {commande.prepare_le && ` · préparée le ${formatDateHeure(commande.prepare_le)}`}
          {commande.client?.telephone && ` · tél. ${commande.client.telephone}`} · prix figés à la saisie
        </p>
      </div>
      <div>
        <Button variant="destructive" size="sm" onClick={surSupprimer}>
          <Trash2Icon /> Supprimer
        </Button>
      </div>
    </div>
  )
}
