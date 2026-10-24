"use client"

import { DownloadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { telechargerFichier, totaliser, versCSV, type LigneLivraison, type LigneTopProduit, type Totaux } from "@/lib/ca"
import { cn, formatDateCourte, formatPrix, formatQuantite, formatUnite } from "@/lib/utils"

const num = "text-right tabular-nums"

/** Tableau du patron : CA par type de livraison + export CSV. */
export function TableauLivraisons({ lignes, nomFichier }: { lignes: LigneLivraison[]; nomFichier: string }) {
  const total = totaliser(lignes.map((l) => ({ nb_commandes: l.nb, total_ht: l.ht, total_ttc: l.ttc })))

  function exporter() {
    const csv = versCSV(
      ["Livraison", "Nb commandes", "CA HT", "CA TTC"],
      [...lignes.map((l) => [l.libelle, String(l.nb), l.ht, l.ttc]), ["TOTAL", String(total.nb), total.ht, total.ttc]],
    )
    telechargerFichier(nomFichier, csv)
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" className="h-10" onClick={exporter}>
          <DownloadIcon /> Export CSV
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Livraison</TableHead>
              <TableHead className={num}>Nb commandes</TableHead>
              <TableHead className={num}>CA HT</TableHead>
              <TableHead className={num}>CA TTC</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((l) => (
              <TableRow key={l.cle} className={cn(l.nb === 0 && "text-muted-foreground")}>
                <TableCell className="font-medium">{l.libelle}</TableCell>
                <TableCell className={num}>{l.nb}</TableCell>
                <TableCell className={num}>{formatPrix(l.ht)}</TableCell>
                <TableCell className={num}>{formatPrix(l.ttc)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <LigneTotal total={total} />
          </TableFooter>
        </Table>
      </div>
    </div>
  )
}

function LigneTotal({ total, libelle = "TOTAL" }: { total: Totaux; libelle?: string }) {
  return (
    <TableRow className="font-semibold">
      <TableCell>{libelle}</TableCell>
      <TableCell className={num}>{total.nb}</TableCell>
      <TableCell className={num}>{formatPrix(total.ht)}</TableCell>
      <TableCell className={num}>{formatPrix(total.ttc)}</TableCell>
    </TableRow>
  )
}

/** Vue tableau du graphique par jour (mêmes valeurs, accessibles sans survol). */
export function TableauJours({ jours }: { jours: (Totaux & { date: string })[] }) {
  const total = totaliser(jours.map((j) => ({ nb_commandes: j.nb, total_ht: j.ht, total_ttc: j.ttc })))
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead className={num}>Nb commandes</TableHead>
            <TableHead className={num}>CA HT</TableHead>
            <TableHead className={num}>CA TTC</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...jours].reverse().map((j) => (
            <TableRow key={j.date}>
              <TableCell className="first-letter:uppercase">{formatDateCourte(j.date)}</TableCell>
              <TableCell className={num}>{j.nb}</TableCell>
              <TableCell className={num}>{formatPrix(j.ht)}</TableCell>
              <TableCell className={num}>{formatPrix(j.ttc)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <LigneTotal total={total} libelle="Total 7 jours" />
        </TableFooter>
      </Table>
    </div>
  )
}

/** Classement des produits : quantité totale + CA, barre de magnitude d'une seule couleur. */
export function TableauTopProduits({ produits }: { produits: LigneTopProduit[] }) {
  if (produits.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Aucune vente sur la période.</p>
  }
  const max = Math.max(...produits.map((p) => p.quantite))
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>Produit</TableHead>
            <TableHead className="w-[30%] min-w-32">Quantité</TableHead>
            <TableHead className={num}>CA HT</TableHead>
            <TableHead className={num}>CA TTC</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {produits.map((p, i) => (
            <TableRow key={p.produit_id}>
              <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
              <TableCell className="font-medium">{p.nom}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(p.quantite / max) * 100}%`, background: "var(--viz-serie-1)" }}
                    />
                  </div>
                  <span className="w-24 text-right tabular-nums">
                    {formatQuantite(p.quantite)}
                    {p.unite !== "pièce" && <span className="text-muted-foreground"> {formatUnite(p.unite, p.quantite)}</span>}
                  </span>
                </div>
              </TableCell>
              <TableCell className={num}>{formatPrix(p.ht)}</TableCell>
              <TableCell className={num}>{formatPrix(p.ttc)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
